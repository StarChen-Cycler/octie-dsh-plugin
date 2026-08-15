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
import type { ProjectMetadata, SnapshotHistoryEntry } from '../../types/index.js';
import { type SnapshotWriteContext } from './history-store.js';
import { TaskGraphStore } from '../graph/index.js';
/**
 * Task Storage configuration
 */
export interface TaskStorageConfig {
    /** Project directory path */
    projectDir?: string;
    /** Octie directory name (default: '.octie') */
    octieDirName?: string;
    /** Project file name (default: 'project.json') */
    projectFileName?: string;
    /** Auto-backup enabled (default: true) */
    autoBackup?: boolean;
    /** Number of backups to keep (default: 5) */
    backupCount?: number;
    /** Number of immutable snapshots to retain (default: 50) */
    snapshotRetention?: number;
}
export interface SaveGraphOptions {
    createBackup?: boolean;
    history?: SnapshotWriteContext;
    /** Expected SHA-256 of the project file before writing. */
    expectedRevision?: string;
}
/**
 * Task Storage class
 *
 * Manages persistent storage of task graphs with atomic operations.
 */
export declare class TaskStorage {
    private _projectDir;
    private _octieDirName;
    private _projectFileName;
    private _autoBackup;
    private _backupCount;
    private _snapshotRetention;
    private _writer;
    /**
     * Create a new TaskStorage instance
     * @param config - Storage configuration
     */
    constructor(config?: TaskStorageConfig);
    /**
     * Get the Octie directory path
     */
    get octieDirPath(): string;
    /**
     * Get the project file path
     */
    get projectFilePath(): string;
    /**
     * Get the backup file path
     */
    get backupFilePath(): string;
    /**
     * Get the indexes directory path
     */
    get indexesDirPath(): string;
    /**
     * Get the cache directory path
     */
    get cacheDirPath(): string;
    /**
     * Get the config file path
     */
    get configFilePath(): string;
    get historyDirPath(): string;
    get snapshotsDirPath(): string;
    get historyFilePath(): string;
    private get lockFilePath();
    private get _historyStore();
    /**
     * Initialize the Octie directory structure
     * Creates .octie directory with subdirectories if they don't exist
     */
    init(): Promise<void>;
    /**
     * Check if Octie directory exists
     * @returns True if .octie directory exists
     */
    exists(): Promise<boolean>;
    /**
     * Load project from file
     * @returns TaskGraphStore instance
     * @throws {FileOperationError} If file doesn't exist or is invalid
     */
    load(): Promise<TaskGraphStore>;
    /**
     * Save project to file
     * @param graph - TaskGraphStore to save
     * @param options - Save options
     */
    save(graph: TaskGraphStore, options?: SaveGraphOptions): Promise<void>;
    private _saveUnlocked;
    private _withProjectLock;
    /**
     * Build indexes for fast lookups
     * @param graph - TaskGraphStore to index
     * @returns ProjectIndexes
     * @private
     */
    private _buildIndexes;
    /**
     * Validate project file structure
     * @param projectFile - Project file to validate
     * @throws {ValidationError} If structure is invalid
     * @private
     */
    private _validateProjectFile;
    /**
     * Get project metadata only (faster than full load)
     * @returns Project metadata
     * @throws {FileOperationError} If file doesn't exist
     */
    getMetadata(): Promise<ProjectMetadata>;
    /**
     * Delete project file and backups
     * Use with caution - this is destructive
     */
    delete(): Promise<void>;
    /**
     * Create a new project with default metadata
     * @param projectName - Project name
     * @param description - Optional project description
     */
    createProject(projectName: string, description?: string): Promise<void>;
    /**
     * List backup files
     * @returns Array of backup file paths
     */
    listBackups(): Promise<string[]>;
    /**
     * Restore from latest backup
     * @throws {FileOperationError} If no backup exists
     */
    restoreFromBackup(): Promise<void>;
    listHistory(): Promise<SnapshotHistoryEntry[]>;
    restoreSnapshot(snapshotId: string, options?: {
        sourceCommand?: string;
    }): Promise<void>;
    private _computeHash;
    private _createGraphFromProjectFile;
    private _getBackupBaseName;
}
/**
 * Get project path for current directory
 * Searches upward from current directory for .octie folder
 * @returns Project directory path or undefined if not found
 */
export declare function findProjectPath(startDir?: string): Promise<string | undefined>;
//# sourceMappingURL=file-store.d.ts.map