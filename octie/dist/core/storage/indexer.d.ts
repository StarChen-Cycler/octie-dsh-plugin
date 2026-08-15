/**
 * Index Manager for fast task lookups
 *
 * Maintains pre-computed indexes for efficient queries:
 * - Status-based grouping (byStatus)
 * - Priority-based grouping (byPriority)
 * - Root tasks (no incoming edges)
 * - Orphan tasks (no edges)
 * - Full-text search index (inverted index)
 * - File reference index
 *
 * Provides O(1) incremental updates and O(n) full rebuild.
 *
 * @module core/storage
 */
import type { TaskNode, TaskStatus, TaskPriority, ProjectIndexes } from '../../types/index.js';
import { TaskGraphStore } from '../graph/index.js';
/**
 * Index Manager class
 *
 * Maintains indexes for fast task queries and filtering.
 */
export declare class IndexManager {
    /** Tasks grouped by status */
    private _byStatus;
    /** Tasks grouped by priority */
    private _byPriority;
    /** Full-text search index (term -> task IDs) */
    private _searchText;
    /** File reference index (file path -> task IDs) */
    private _files;
    /** Root tasks (no incoming edges) - cached */
    private _rootTasks;
    /** Orphan tasks (no edges) - cached */
    private _orphanTasks;
    /** Cached result object */
    private _cachedIndexes;
    /**
     * Create a new IndexManager
     */
    constructor();
    /**
     * Incremental update for a single task
     * Removes old task from indexes and adds new version
     * O(1) operation for most cases
     *
     * @param task - New or updated task
     * @param oldTask - Previous task state (for removal from old indexes)
     * @param graph - TaskGraphStore for edge information
     */
    updateTask(task: TaskNode, oldTask: TaskNode | null, graph: TaskGraphStore): void;
    /**
     * Remove task from indexes
     * @param task - Task to remove
     * @private
     */
    private _removeTask;
    /**
     * Add task to indexes
     * @param task - Task to add
     * @param graph - TaskGraphStore for edge information
     * @private
     */
    private _addTask;
    /**
     * Update root/orphan status for a task
     * @param taskId - Task ID to check
     * @param graph - TaskGraphStore for edge information
     * @private
     */
    private _updateRootOrphanStatus;
    /**
     * Rebuild all indexes from scratch
     * O(n) operation where n is the number of tasks
     *
     * @param tasks - Map of all tasks
     * @param graph - TaskGraphStore for edge information
     */
    rebuildIndexes(tasks: Map<string, TaskNode>, graph: TaskGraphStore): void;
    /**
     * Get task IDs by status
     * @param status - Task status to filter by
     * @returns Array of task IDs
     */
    getByStatus(status: TaskStatus): string[];
    /**
     * Get task IDs by priority
     * @param priority - Task priority to filter by
     * @returns Array of task IDs
     */
    getByPriority(priority: TaskPriority): string[];
    /**
     * Search tasks by text query
     * @param query - Search query (will be tokenized)
     * @returns Array of task IDs matching any token
     */
    search(query: string): string[];
    /**
     * Get task IDs by related file
     * @param filePath - File path to search for
     * @returns Array of task IDs
     */
    getByFile(filePath: string): string[];
    /**
     * Get root tasks (no incoming edges)
     * @returns Array of task IDs
     */
    getRootTasks(): string[];
    /**
     * Get orphan tasks (no edges)
     * @returns Array of task IDs
     */
    getOrphanTasks(): string[];
    /**
     * Get all indexes as a ProjectIndexes object
     * Cached result - only recomputed if indexes changed
     *
     * @returns ProjectIndexes interface
     */
    getIndexes(): ProjectIndexes;
    /**
     * Clear all indexes
     */
    clear(): void;
    /**
     * Get index statistics (for debugging)
     * @returns Statistics about the indexes
     */
    getStats(): {
        statusCounts: Record<TaskStatus, number>;
        priorityCounts: Record<TaskPriority, number>;
        searchTermsCount: number;
        fileRefCount: number;
        rootTasksCount: number;
        orphanTasksCount: number;
    };
}
//# sourceMappingURL=indexer.d.ts.map