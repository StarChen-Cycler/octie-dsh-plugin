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
/**
 * Atomic file writer configuration
 */
export interface AtomicWriterConfig {
    /** Number of backups to keep (default: 5) */
    backupCount?: number;
    /** Directory for temporary files (default: OS temp directory) */
    tempDir?: string;
    /** Prefix for temporary files (default: '.octie-tmp-') */
    tempPrefix?: string;
}
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
export declare function renameWithRetry(op: () => Promise<void>, options?: {
    maxRetries?: number;
    baseDelayMs?: number;
}): Promise<number>;
/**
 * Atomic File Writer class
 *
 * Provides safe file write operations using atomic rename strategy.
 * Prevents data corruption by writing to temp file first, then renaming.
 */
export declare class AtomicFileWriter {
    private _config;
    /**
     * Create a new AtomicFileWriter
     * @param config - Optional configuration
     */
    constructor(config?: AtomicWriterConfig);
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
    write(filePath: string, data: string | Record<string, unknown>, options?: {
        createBackup?: boolean;
        indent?: number | string;
    }): Promise<void>;
    /**
     * Rename with retry on Windows EPERM
     *
     * Retries transient EPERM/EBUSY renames up to 5× with backoff
     * (100ms doubling, capped at 1.6s) — absorbs AV/backup lock windows.
     *
     * @private
     */
    private _renameWithRetry;
    /**
     * Read file contents
     * @param filePath - File path to read
     * @returns File contents as string
     * @throws {FileOperationError} If read fails
     */
    read(filePath: string): Promise<string>;
    /**
     * Read and parse JSON file
     * @param filePath - File path to read
     * @returns Parsed JSON object
     * @throws {FileOperationError} If read or parse fails
     */
    readJSON<T = Record<string, unknown>>(filePath: string): Promise<T>;
    /**
     * Append content to a file, creating parent directories if needed.
     * Used for append-only audit/history logs.
     *
     * @param filePath - Target file path
     * @param content - Content to append
     * @throws {FileOperationError} If append fails
     */
    append(filePath: string, content: string): Promise<void>;
    /**
     * Create backup of existing file
     * @param filePath - File to backup
     * @private
     */
    private _createBackup;
    /**
     * Rotate backup files, keeping only the configured number
     * @param filePath - Original file path
     * @private
     */
    private _rotateBackups;
    /**
     * Get backup file path
     * @param filePath - Original file path
     * @returns Backup file path
     * @private
     */
    private _getBackupPath;
    /**
     * Get temporary file path
     * @param filePath - Target file path
     * @returns Temporary file path
     * @private
     */
    private _getTempPath;
    /**
     * Get directory path from file path
     * @param filePath - File path
     * @returns Directory path
     * @private
     */
    private _getDirPath;
    /**
     * Get base name from file path (without extension)
     * @param filePath - File path
     * @returns Base name
     * @private
     */
    private _getBaseName;
    /**
     * Check if file exists
     * @param filePath - File path to check
     * @returns True if file exists
     */
    exists(filePath: string): Promise<boolean>;
    /**
     * Delete file
     * @param filePath - File path to delete
     * @throws {FileOperationError} If delete fails
     */
    delete(filePath: string): Promise<void>;
    /**
     * Ensure directory exists, create if missing
     * @param dirPath - Directory path
     * @throws {FileOperationError} If directory creation fails
     */
    ensureDir(dirPath: string): Promise<void>;
}
/**
 * Cross-platform path utilities
 */
export declare class PathUtils {
    /**
     * Normalize path for consistent storage
     * Converts backslashes to forward slashes, removes redundant separators
     * @param path - Path to normalize
     * @returns Normalized path
     */
    static normalizePath(path: string): string;
    /**
     * Join path segments
     * @param segments - Path segments to join
     * @returns Joined path
     */
    static join(...segments: string[]): string;
    /**
     * Check if path is absolute
     * @param path - Path to check
     * @returns True if path is absolute
     */
    static isAbsolute(path: string): boolean;
    /**
     * Make path relative to another path
     * @param from - Base path
     * @param to - Target path
     * @returns Relative path
     */
    static relative(from: string, to: string): string;
    /**
     * Get project configuration path
     * Platform-aware configuration directory
     * @param projectName - Project name
     * @returns Configuration path
     */
    static getConfigPath(projectName: string): string;
    /**
     * Get project data path
     * Platform-aware data directory
     * @param projectName - Project name
     * @returns Data path
     */
    static getDataPath(projectName: string): string;
    /**
     * Sanitize file path to prevent directory traversal
     * @param filePath - File path to sanitize
     * @param basePath - Base path to resolve against
     * @returns Sanitized, absolute path
     * @throws {FileOperationError} If path tries to escape base directory
     */
    static sanitizePath(filePath: string, basePath?: string): string;
}
//# sourceMappingURL=atomic-write.d.ts.map