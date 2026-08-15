/**
 * Task Storage for file operations
 *
 * Manages persistent storage of task graphs using atomic file operations.
 * Handles project.json, backups, and .octie directory structure.
 *
 * Directory Structure:
 * .octie/
 * ├── project.json          # Main task storage
 * ├── project.json.bak      # Latest backup
 * ├── project.json.bak.{ts} # Rotated backups
 * ├── indexes/              # Pre-computed indexes
 * ├── cache/                # Serialized graph cache
 * └── config.json           # Project configuration
 *
 * @module core/storage
 */
import { createHash } from 'node:crypto';
import { open, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ConcurrentModificationError, FileOperationError, ValidationError } from '../../types/index.js';
import { AtomicFileWriter } from './atomic-write.js';
import { inferSnapshotWriteContext, ProjectHistoryStore, } from './history-store.js';
import { TaskGraphStore } from '../graph/index.js';
import { TaskNode } from '../models/task-node.js';
/**
 * Default project file name
 */
const DEFAULT_PROJECT_FILE = 'project.json';
/**
 * Default .octie directory name
 */
const OCTIE_DIR_NAME = '.octie';
const DEFAULT_SNAPSHOT_RETENTION = 50;
const PROJECT_LOCK_FILE = 'project.lock';
const PROJECT_LOCK_STALE_MS = 30_000;
const PROJECT_LOCK_TIMEOUT_MS = 5_000;
const PROJECT_LOCK_RETRY_MS = 25;
// A graph remembers the exact serialized project revision it was loaded from.
// WeakMap keeps this concurrency metadata out of the persisted task model.
const graphRevisions = new WeakMap();
/**
 * Task Storage class
 *
 * Manages persistent storage of task graphs with atomic operations.
 */
export class TaskStorage {
    _projectDir;
    _octieDirName;
    _projectFileName;
    _autoBackup;
    _backupCount;
    _snapshotRetention;
    _writer;
    /**
     * Create a new TaskStorage instance
     * @param config - Storage configuration
     */
    constructor(config = {}) {
        this._projectDir = config.projectDir || process.cwd();
        this._octieDirName = config.octieDirName || OCTIE_DIR_NAME;
        this._projectFileName = config.projectFileName || DEFAULT_PROJECT_FILE;
        this._autoBackup = config.autoBackup ?? true;
        this._backupCount = config.backupCount ?? 5;
        this._snapshotRetention = config.snapshotRetention ?? DEFAULT_SNAPSHOT_RETENTION;
        this._writer = new AtomicFileWriter({
            backupCount: this._backupCount,
        });
    }
    /**
     * Get the Octie directory path
     */
    get octieDirPath() {
        return join(this._projectDir, this._octieDirName);
    }
    /**
     * Get the project file path
     */
    get projectFilePath() {
        return join(this.octieDirPath, this._projectFileName);
    }
    /**
     * Get the backup file path
     */
    get backupFilePath() {
        return join(this.octieDirPath, `${this._getBackupBaseName()}.bak`);
    }
    /**
     * Get the indexes directory path
     */
    get indexesDirPath() {
        return join(this.octieDirPath, 'indexes');
    }
    /**
     * Get the cache directory path
     */
    get cacheDirPath() {
        return join(this.octieDirPath, 'cache');
    }
    /**
     * Get the config file path
     */
    get configFilePath() {
        return join(this.octieDirPath, 'config.json');
    }
    get historyDirPath() {
        return join(this.octieDirPath, 'history');
    }
    get snapshotsDirPath() {
        return join(this.historyDirPath, 'snapshots');
    }
    get historyFilePath() {
        return join(this.historyDirPath, 'history.ndjson');
    }
    get lockFilePath() {
        return join(this.octieDirPath, PROJECT_LOCK_FILE);
    }
    get _historyStore() {
        return new ProjectHistoryStore(this.octieDirPath, this._writer, this._snapshotRetention);
    }
    /**
     * Initialize the Octie directory structure
     * Creates .octie directory with subdirectories if they don't exist
     */
    async init() {
        // Ensure .octie directory exists
        await this._writer.ensureDir(this.octieDirPath);
    }
    /**
     * Check if Octie directory exists
     * @returns True if .octie directory exists
     */
    async exists() {
        return await this._writer.exists(this.projectFilePath);
    }
    /**
     * Load project from file
     * @returns TaskGraphStore instance
     * @throws {FileOperationError} If file doesn't exist or is invalid
     */
    async load() {
        // Check if project exists
        if (!await this.exists()) {
            throw new FileOperationError('Octie project not found. Run `octie init` to create a new project.', this.projectFilePath);
        }
        try {
            // Read and parse project file
            const serialized = await this._writer.read(this.projectFilePath);
            const projectFile = JSON.parse(serialized);
            // Validate project file structure
            this._validateProjectFile(projectFile);
            const graph = this._createGraphFromProjectFile(projectFile);
            graphRevisions.set(graph, this._computeHash(serialized));
            return graph;
        }
        catch (error) {
            if (error instanceof FileOperationError) {
                throw error;
            }
            throw new FileOperationError(`Failed to load project: ${error instanceof Error ? error.message : String(error)}`, this.projectFilePath);
        }
    }
    /**
     * Save project to file
     * @param graph - TaskGraphStore to save
     * @param options - Save options
     */
    async save(graph, options = {}) {
        await this._withProjectLock(async () => this._saveUnlocked(graph, options));
    }
    async _saveUnlocked(graph, options) {
        const createBackup = options.createBackup ?? this._autoBackup;
        const expectedRevision = options.expectedRevision ?? graphRevisions.get(graph);
        let projectFile;
        let shouldSnapshot = false;
        let historyContext;
        // Ensure directory exists
        await this.init();
        try {
            // Convert graph to JSON-serializable format
            const json = graph.toJSON();
            // Build project file structure
            projectFile = {
                $schema: 'https://octie.dev/schemas/project-v1.json',
                version: '1.0.0',
                format: 'octie-project',
                metadata: json.metadata,
                tasks: json.nodes,
                indexes: await this._buildIndexes(graph),
            };
            const serialized = JSON.stringify(projectFile, null, 2);
            let previousHash = null;
            if (await this.exists()) {
                try {
                    const currentContent = await this._writer.read(this.projectFilePath);
                    previousHash = this._computeHash(currentContent);
                }
                catch {
                    previousHash = null;
                }
            }
            if (expectedRevision !== undefined && previousHash !== expectedRevision) {
                throw new ConcurrentModificationError(this.projectFilePath);
            }
            // Write atomically
            await this._writer.write(this.projectFilePath, projectFile, {
                createBackup,
            });
            const currentHash = this._computeHash(serialized);
            graphRevisions.set(graph, currentHash);
            shouldSnapshot = options.history?.forceSnapshot || previousHash !== currentHash;
            if (shouldSnapshot) {
                historyContext = {
                    ...inferSnapshotWriteContext(),
                    ...(options.history || {}),
                };
            }
        }
        catch (error) {
            if (error instanceof ConcurrentModificationError) {
                throw error;
            }
            throw new FileOperationError(`Failed to save project: ${error instanceof Error ? error.message : String(error)}`, this.projectFilePath);
        }
        if (!shouldSnapshot || !projectFile || !historyContext) {
            return;
        }
        try {
            await this._historyStore.createSnapshot(projectFile, graph, historyContext);
        }
        catch (error) {
            throw new FileOperationError(`Project saved, but snapshot history recording failed: ${error instanceof Error ? error.message : String(error)}`, this.historyFilePath);
        }
    }
    async _withProjectLock(operation) {
        await this.init();
        const startedAt = Date.now();
        while (true) {
            try {
                const handle = await open(this.lockFilePath, 'wx');
                try {
                    return await operation();
                }
                finally {
                    await handle.close();
                    await unlink(this.lockFilePath).catch(() => undefined);
                }
            }
            catch (error) {
                const code = error.code;
                if (code !== 'EEXIST') {
                    throw error;
                }
                try {
                    const lockStats = await stat(this.lockFilePath);
                    if (Date.now() - lockStats.mtimeMs > PROJECT_LOCK_STALE_MS) {
                        await unlink(this.lockFilePath).catch(() => undefined);
                        continue;
                    }
                }
                catch {
                    continue;
                }
                if (Date.now() - startedAt >= PROJECT_LOCK_TIMEOUT_MS) {
                    throw new FileOperationError('Timed out waiting for project write lock', this.lockFilePath);
                }
                await new Promise(resolve => setTimeout(resolve, PROJECT_LOCK_RETRY_MS));
            }
        }
    }
    /**
     * Build indexes for fast lookups
     * @param graph - TaskGraphStore to index
     * @returns ProjectIndexes
     * @private
     */
    async _buildIndexes(graph) {
        const byStatus = {
            ready: [],
            in_progress: [],
            in_review: [],
            completed: [],
            blocked: [],
        };
        const byPriority = {
            top: [],
            second: [],
            later: [],
        };
        // Use Object.create(null) to avoid prototype pollution
        // (e.g., token "constructor" would conflict with Object.prototype.constructor)
        // Use Sets during building for O(1) dedup, convert to arrays at end
        const searchTextSets = Object.create(null);
        const filesSets = Object.create(null);
        // Build indexes from all tasks
        for (const task of graph.getAllTasks()) {
            // Status index
            byStatus[task.status]?.push(task.id);
            // Priority index
            byPriority[task.priority]?.push(task.id);
            // Full-text search index (tokenize and index with Set-based dedup)
            const text = `${task.title} ${task.description} ${task.notes}`.toLowerCase();
            const tokens = text.match(/\b\w+\b/g) || [];
            for (const token of tokens) {
                if (!searchTextSets[token]) {
                    searchTextSets[token] = new Set();
                }
                searchTextSets[token].add(task.id);
            }
            // File reference index (Set-based dedup)
            for (const filePath of task.related_files) {
                if (!filesSets[filePath]) {
                    filesSets[filePath] = new Set();
                }
                filesSets[filePath].add(task.id);
            }
        }
        // Convert Sets to arrays for JSON serialization
        const searchText = Object.create(null);
        for (const token of Object.keys(searchTextSets)) {
            searchText[token] = Array.from(searchTextSets[token]);
        }
        const files = Object.create(null);
        for (const filePath of Object.keys(filesSets)) {
            files[filePath] = Array.from(filesSets[filePath]);
        }
        // Get root and orphan tasks
        const rootTasks = graph.getRootTasks();
        const orphanTasks = graph.getOrphanTasks();
        return {
            byStatus: byStatus,
            byPriority: byPriority,
            rootTasks,
            orphanTasks,
            searchText,
            files,
        };
    }
    /**
     * Validate project file structure
     * @param projectFile - Project file to validate
     * @throws {ValidationError} If structure is invalid
     * @private
     */
    _validateProjectFile(projectFile) {
        if (!projectFile.tasks || typeof projectFile.tasks !== 'object') {
            throw new ValidationError('Invalid project file: missing or invalid tasks', 'tasks');
        }
        if (!projectFile.metadata || typeof projectFile.metadata !== 'object') {
            throw new ValidationError('Invalid project file: missing or invalid metadata', 'metadata');
        }
        // Validate metadata fields
        const { metadata } = projectFile;
        if (!metadata.project_name || typeof metadata.project_name !== 'string') {
            throw new ValidationError('Invalid metadata: missing project_name', 'metadata.project_name');
        }
        if (!metadata.created_at || typeof metadata.created_at !== 'string') {
            throw new ValidationError('Invalid metadata: missing created_at', 'metadata.created_at');
        }
        if (!metadata.updated_at || typeof metadata.updated_at !== 'string') {
            throw new ValidationError('Invalid metadata: missing updated_at', 'metadata.updated_at');
        }
    }
    /**
     * Get project metadata only (faster than full load)
     * @returns Project metadata
     * @throws {FileOperationError} If file doesn't exist
     */
    async getMetadata() {
        if (!await this.exists()) {
            throw new FileOperationError('Octie project not found. Run `octie init` to create a new project.', this.projectFilePath);
        }
        try {
            const projectFile = await this._writer.readJSON(this.projectFilePath);
            return projectFile.metadata;
        }
        catch (error) {
            throw new FileOperationError(`Failed to load metadata: ${error instanceof Error ? error.message : String(error)}`, this.projectFilePath);
        }
    }
    /**
     * Delete project file and backups
     * Use with caution - this is destructive
     */
    async delete() {
        try {
            // Delete project file
            await this._writer.delete(this.projectFilePath);
            // Delete backup files
            await this._writer.delete(this.backupFilePath);
            // Note: We don't delete the entire .octie directory
            // as it may contain other data (indexes, cache, config)
        }
        catch (error) {
            throw new FileOperationError(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`, this.projectFilePath);
        }
    }
    /**
     * Create a new project with default metadata
     * @param projectName - Project name
     * @param description - Optional project description
     */
    async createProject(projectName, description) {
        const metadata = {
            project_name: projectName,
            version: '1.0.0',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            description,
        };
        const graph = new TaskGraphStore(metadata);
        await this.save(graph, {
            createBackup: false,
            history: {
                reason: 'init',
                sourceCommand: 'octie init',
                forceSnapshot: true,
            },
        });
    }
    /**
     * List backup files
     * @returns Array of backup file paths
     */
    async listBackups() {
        const { promises: fs } = await import('node:fs');
        const backups = [];
        const baseName = this._getBackupBaseName();
        try {
            const files = await fs.readdir(this.octieDirPath);
            for (const file of files) {
                if (file === `${baseName}.bak` ||
                    file.startsWith(`${baseName}.bak.`) ||
                    file.startsWith(`${this._projectFileName}.bak`)) {
                    backups.push(join(this.octieDirPath, file));
                }
            }
        }
        catch {
            // Directory might not exist yet
        }
        return backups.sort().reverse(); // Newest first
    }
    /**
     * Restore from latest backup
     * @throws {FileOperationError} If no backup exists
     */
    async restoreFromBackup() {
        const backups = await this.listBackups();
        if (backups.length === 0) {
            throw new FileOperationError('No backup files found', this.backupFilePath);
        }
        const latestBackup = backups[0];
        if (!latestBackup) {
            throw new FileOperationError('No backup files found', this.backupFilePath);
        }
        try {
            // Copy backup to main file
            const { promises: fs } = await import('node:fs');
            await fs.copyFile(latestBackup, this.projectFilePath);
        }
        catch (error) {
            throw new FileOperationError(`Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`, latestBackup);
        }
    }
    async listHistory() {
        return await this._historyStore.listSnapshots();
    }
    async restoreSnapshot(snapshotId, options = {}) {
        if (!await this.exists()) {
            throw new FileOperationError('Octie project not found. Run `octie init` to create a new project.', this.projectFilePath);
        }
        const liveGraph = await this.load();
        const liveProjectFile = await this._writer.readJSON(this.projectFilePath);
        await this._historyStore.createSnapshot(liveProjectFile, liveGraph, {
            reason: 'pre_restore',
            sourceCommand: options.sourceCommand || 'octie history restore',
            restoredFromSnapshotId: snapshotId,
            forceSnapshot: true,
        });
        const { projectFile } = await this._historyStore.loadSnapshot(snapshotId);
        this._validateProjectFile(projectFile);
        const restoredGraph = this._createGraphFromProjectFile(projectFile);
        await this.save(restoredGraph, {
            createBackup: true,
            history: {
                reason: 'history_restore',
                sourceCommand: options.sourceCommand || 'octie history restore',
            },
        });
    }
    _computeHash(content) {
        return createHash('sha256').update(content, 'utf8').digest('hex');
    }
    _createGraphFromProjectFile(projectFile) {
        const graph = new TaskGraphStore(projectFile.metadata);
        for (const [, taskData] of Object.entries(projectFile.tasks)) {
            const node = TaskNode.fromJSON(taskData);
            graph.addNode(node);
        }
        return graph;
    }
    _getBackupBaseName() {
        const lastDot = this._projectFileName.lastIndexOf('.');
        return lastDot > 0 ? this._projectFileName.substring(0, lastDot) : this._projectFileName;
    }
}
/**
 * Get project path for current directory
 * Searches upward from current directory for .octie folder
 * @returns Project directory path or undefined if not found
 */
export async function findProjectPath(startDir = process.cwd()) {
    const { resolve } = await import('node:path');
    const { promises: fs } = await import('node:fs');
    let currentDir = resolve(startDir);
    // Search upward until root directory
    while (true) {
        const octieDir = join(currentDir, OCTIE_DIR_NAME);
        const projectFile = join(octieDir, DEFAULT_PROJECT_FILE);
        try {
            await fs.access(projectFile);
            return currentDir;
        }
        catch {
            // Not found, continue searching
        }
        // Move to parent directory
        const parentDir = resolve(currentDir, '..');
        // Check if we've reached the root
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
}
//# sourceMappingURL=file-store.js.map