/**
 * Atomic file write operations
 *
 * Implements safe file writes using temp file + rename strategy.
 * Ensures data integrity by:
 * 1. Writing to temporary file first
 * 2. Verifying write success
 * 3. Creating backup of existing file
 * 4. Atomic rename to final location
 *
 * @module core/storage/atomic-write
 */
import { promises as fs } from 'node:fs';
import { join, sep, normalize, isAbsolute, relative } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { FileOperationError } from '../../types/index.js';
/**
 * Default configuration for atomic writes
 */
const DEFAULT_CONFIG = {
    backupCount: 5,
    tempDir: tmpdir(),
    tempPrefix: '.octie-tmp-',
};
/**
 * Retry a transient-rename operation with backoff.
 *
 * On Windows, rename over an existing file can fail with EPERM/EBUSY when
 * an AV scanner, backup stream, or OS metadata cache holds a transient
 * handle on the target. Retries absorb locks up to ~3s; non-transient
 * errors fail fast.
 *
 * Exported as a pure helper so retry policy is unit-testable.
 */
export async function renameWithRetry(op, options = {}) {
    const maxRetries = options.maxRetries ?? 5;
    const baseDelayMs = options.baseDelayMs ?? 100;
    let delay = baseDelayMs;
    let attempts = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts = attempt + 1;
        try {
            await op();
            return attempts;
        }
        catch (err) {
            if (attempt === maxRetries)
                throw err;
            // Only retry on Windows transient lock errors; fail fast otherwise
            if (err.code !== 'EPERM' && err.code !== 'EBUSY')
                throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, 1600);
        }
    }
    return attempts;
}
/**
 * Atomic File Writer class
 *
 * Provides safe file write operations using atomic rename strategy.
 * Prevents data corruption by writing to temp file first, then renaming.
 */
export class AtomicFileWriter {
    _config;
    /**
     * Create a new AtomicFileWriter
     * @param config - Optional configuration
     */
    constructor(config = {}) {
        this._config = {
            backupCount: config.backupCount ?? DEFAULT_CONFIG.backupCount,
            tempDir: config.tempDir ?? DEFAULT_CONFIG.tempDir,
            tempPrefix: config.tempPrefix ?? DEFAULT_CONFIG.tempPrefix,
        };
    }
    /**
     * Write data to file atomically
     *
     * Process:
     * 1. Write to temporary file
     * 2. Verify write success (check file size)
     * 3. Create backup of existing file (if exists)
     * 4. Atomic rename to final location
     *
     * @param filePath - Target file path
     * @param data - Data to write (will be JSON stringified if object)
     * @param options - Write options
     * @throws {FileOperationError} If write operation fails
     */
    async write(filePath, data, options = {}) {
        const { createBackup = true, indent = 2 } = options;
        // Prepare content
        let content;
        if (typeof data === 'string') {
            content = data;
        }
        else {
            content = JSON.stringify(data, null, indent);
        }
        // Validate content is not empty
        if (content.length === 0) {
            throw new FileOperationError('Cannot write empty content', filePath);
        }
        // Generate temp file path
        const tempPath = this._getTempPath(filePath);
        try {
            // Step 1: Write to temporary file
            await fs.writeFile(tempPath, content, 'utf8');
            // Step 2: Verify write succeeded
            const stats = await fs.stat(tempPath);
            if (stats.size === 0) {
                throw new FileOperationError('Write produced empty file', filePath);
            }
            // Use Buffer.byteLength for proper Unicode handling
            const expectedBytes = Buffer.byteLength(content, 'utf8');
            if (stats.size !== expectedBytes) {
                throw new FileOperationError(`Write size mismatch: expected ${expectedBytes} bytes, got ${stats.size} bytes`, filePath);
            }
            // Step 3: Create backup if file exists and backup requested
            if (createBackup) {
                await this._createBackup(filePath);
            }
            // Step 4: Atomic rename to final location
            // ponytail: Windows EPERM retry — rename over existing file can fail
            // when AV, backup streams, or OS caching hold a transient handle on target.
            // Retry up to 3× with backoff before giving up.
            await this._renameWithRetry(tempPath, filePath);
        }
        catch (error) {
            // Cleanup temp file on failure
            try {
                await fs.unlink(tempPath);
            }
            catch {
                // Ignore cleanup errors
            }
            if (error instanceof FileOperationError) {
                throw error;
            }
            throw new FileOperationError(`Atomic write failed: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Rename with retry on Windows EPERM
     *
     * Retries transient EPERM/EBUSY renames up to 5× with backoff
     * (100ms doubling, capped at 1.6s) — absorbs AV/backup lock windows.
     *
     * @private
     */
    async _renameWithRetry(tempPath, filePath) {
        await renameWithRetry(() => fs.rename(tempPath, filePath));
    }
    /**
     * Read file contents
     * @param filePath - File path to read
     * @returns File contents as string
     * @throws {FileOperationError} If read fails
     */
    async read(filePath) {
        try {
            return await fs.readFile(filePath, 'utf8');
        }
        catch (error) {
            throw new FileOperationError(`Read failed: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Read and parse JSON file
     * @param filePath - File path to read
     * @returns Parsed JSON object
     * @throws {FileOperationError} If read or parse fails
     */
    async readJSON(filePath) {
        try {
            const content = await this.read(filePath);
            return JSON.parse(content);
        }
        catch (error) {
            if (error instanceof FileOperationError) {
                throw error;
            }
            throw new FileOperationError(`JSON parse failed: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Append content to a file, creating parent directories if needed.
     * Used for append-only audit/history logs.
     *
     * @param filePath - Target file path
     * @param content - Content to append
     * @throws {FileOperationError} If append fails
     */
    async append(filePath, content) {
        if (content.length === 0) {
            throw new FileOperationError('Cannot append empty content', filePath);
        }
        try {
            await this.ensureDir(this._getDirPath(filePath));
            await fs.appendFile(filePath, content, 'utf8');
        }
        catch (error) {
            throw new FileOperationError(`Append failed: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Create backup of existing file
     * @param filePath - File to backup
     * @private
     */
    async _createBackup(filePath) {
        try {
            // Check if file exists
            await fs.access(filePath);
            // Create backup path
            const backupPath = this._getBackupPath(filePath);
            // Copy to backup
            await fs.copyFile(filePath, backupPath);
            // Rotate old backups
            await this._rotateBackups(filePath);
        }
        catch (error) {
            // If file doesn't exist, that's ok - no backup needed
            if (error.code === 'ENOENT') {
                return;
            }
            // Log but don't fail on backup errors
            console.warn(`Backup creation failed for ${filePath}:`, error);
        }
    }
    /**
     * Rotate backup files, keeping only the configured number
     * @param filePath - Original file path
     * @private
     */
    async _rotateBackups(filePath) {
        const dir = this._getDirPath(filePath);
        const baseName = this._getBaseName(filePath);
        try {
            // List existing backup files
            const files = await fs.readdir(dir);
            const backupFiles = files
                .filter(f => f.startsWith(`${baseName}.bak`) || f.startsWith(`${baseName}.bak.`))
                .sort()
                .reverse(); // Newest first
            // Remove excess backups
            const backupsToDelete = backupFiles.slice(this._config.backupCount);
            for (const file of backupsToDelete) {
                await fs.unlink(join(dir, file));
            }
        }
        catch (error) {
            // Log but don't fail on rotation errors
            console.warn(`Backup rotation failed for ${filePath}:`, error);
        }
    }
    /**
     * Get backup file path
     * @param filePath - Original file path
     * @returns Backup file path
     * @private
     */
    _getBackupPath(filePath) {
        const dir = this._getDirPath(filePath);
        const baseName = this._getBaseName(filePath);
        const timestamp = Date.now();
        return join(dir, `${baseName}.bak.${timestamp}`);
    }
    /**
     * Get temporary file path
     * @param filePath - Target file path
     * @returns Temporary file path
     * @private
     */
    _getTempPath(filePath) {
        const dir = this._getDirPath(filePath);
        const baseName = this._getBaseName(filePath);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        // Use same directory as target file for cross-device compatibility (Windows EXDEV fix)
        return join(dir, `${this._config.tempPrefix}${baseName}-${timestamp}-${random}.tmp`);
    }
    /**
     * Get directory path from file path
     * @param filePath - File path
     * @returns Directory path
     * @private
     */
    _getDirPath(filePath) {
        const parts = filePath.split(sep);
        parts.pop(); // Remove file name
        return parts.join(sep) || '.';
    }
    /**
     * Get base name from file path (without extension)
     * @param filePath - File path
     * @returns Base name
     * @private
     */
    _getBaseName(filePath) {
        const parts = filePath.split(sep);
        const fileName = parts[parts.length - 1] || '';
        // Remove extension
        const lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }
    /**
     * Check if file exists
     * @param filePath - File path to check
     * @returns True if file exists
     */
    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Delete file
     * @param filePath - File path to delete
     * @throws {FileOperationError} If delete fails
     */
    async delete(filePath) {
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return; // Already deleted
            }
            throw new FileOperationError(`Delete failed: ${error instanceof Error ? error.message : String(error)}`, filePath);
        }
    }
    /**
     * Ensure directory exists, create if missing
     * @param dirPath - Directory path
     * @throws {FileOperationError} If directory creation fails
     */
    async ensureDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            throw new FileOperationError(`Directory creation failed: ${error instanceof Error ? error.message : String(error)}`, dirPath);
        }
    }
}
/**
 * Cross-platform path utilities
 */
export class PathUtils {
    /**
     * Normalize path for consistent storage
     * Converts backslashes to forward slashes, removes redundant separators
     * @param path - Path to normalize
     * @returns Normalized path
     */
    static normalizePath(path) {
        return normalize(path).split(sep).join('/');
    }
    /**
     * Join path segments
     * @param segments - Path segments to join
     * @returns Joined path
     */
    static join(...segments) {
        return join(...segments);
    }
    /**
     * Check if path is absolute
     * @param path - Path to check
     * @returns True if path is absolute
     */
    static isAbsolute(path) {
        return isAbsolute(path);
    }
    /**
     * Make path relative to another path
     * @param from - Base path
     * @param to - Target path
     * @returns Relative path
     */
    static relative(from, to) {
        return relative(from, to);
    }
    /**
     * Get project configuration path
     * Platform-aware configuration directory
     * @param projectName - Project name
     * @returns Configuration path
     */
    static getConfigPath(projectName) {
        const platform = process.platform;
        const homeDir = homedir();
        switch (platform) {
            case 'win32':
                return join(process.env.APPDATA || homeDir, projectName);
            case 'darwin':
                return join(homeDir, 'Library', 'Application Support', projectName);
            default: // linux and others
                return join(homeDir, '.config', projectName);
        }
    }
    /**
     * Get project data path
     * Platform-aware data directory
     * @param projectName - Project name
     * @returns Data path
     */
    static getDataPath(projectName) {
        const platform = process.platform;
        const homeDir = homedir();
        switch (platform) {
            case 'win32':
                return join(process.env.LOCALAPPDATA || join(homeDir, 'AppData', 'Local'), projectName);
            case 'darwin':
                return join(homeDir, 'Library', 'Application Support', projectName);
            default: // linux and others
                return join(homeDir, '.local', 'share', projectName);
        }
    }
    /**
     * Sanitize file path to prevent directory traversal
     * @param filePath - File path to sanitize
     * @param basePath - Base path to resolve against
     * @returns Sanitized, absolute path
     * @throws {FileOperationError} If path tries to escape base directory
     */
    static sanitizePath(filePath, basePath = process.cwd()) {
        const normalized = normalize(filePath);
        const resolved = join(basePath, normalized);
        // Check if resolved path is within base path
        const relativePath = this.relative(basePath, resolved);
        if (relativePath.startsWith('..')) {
            throw new FileOperationError('Path traversal detected: file path cannot escape base directory', filePath);
        }
        return resolved;
    }
}
//# sourceMappingURL=atomic-write.js.map