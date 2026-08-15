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
import { TaskGraphStore } from '../graph/index.js';
/**
 * Index Manager class
 *
 * Maintains indexes for fast task queries and filtering.
 */
export class IndexManager {
    /** Tasks grouped by status */
    _byStatus;
    /** Tasks grouped by priority */
    _byPriority;
    /** Full-text search index (term -> task IDs) */
    _searchText;
    /** File reference index (file path -> task IDs) */
    _files;
    /** Root tasks (no incoming edges) - cached */
    _rootTasks;
    /** Orphan tasks (no edges) - cached */
    _orphanTasks;
    /** Cached result object */
    _cachedIndexes;
    /**
     * Create a new IndexManager
     */
    constructor() {
        this._byStatus = new Map();
        this._byPriority = new Map();
        this._searchText = new Map();
        this._files = new Map();
        this._rootTasks = new Set();
        this._orphanTasks = new Set();
        this._cachedIndexes = null;
        // Initialize status indexes
        const statuses = ['ready', 'in_progress', 'in_review', 'completed', 'blocked'];
        for (const status of statuses) {
            this._byStatus.set(status, new Set());
        }
        // Initialize priority indexes
        const priorities = ['top', 'second', 'later'];
        for (const priority of priorities) {
            this._byPriority.set(priority, new Set());
        }
    }
    /**
     * Incremental update for a single task
     * Removes old task from indexes and adds new version
     * O(1) operation for most cases
     *
     * @param task - New or updated task
     * @param oldTask - Previous task state (for removal from old indexes)
     * @param graph - TaskGraphStore for edge information
     */
    updateTask(task, oldTask, graph) {
        // Remove old task from indexes if exists
        if (oldTask) {
            this._removeTask(oldTask);
        }
        // Add new task to indexes
        this._addTask(task, graph);
        // Invalidate cache
        this._cachedIndexes = null;
    }
    /**
     * Remove task from indexes
     * @param task - Task to remove
     * @private
     */
    _removeTask(task) {
        // Remove from status index
        this._byStatus.get(task.status)?.delete(task.id);
        // Remove from priority index
        this._byPriority.get(task.priority)?.delete(task.id);
        // Remove from search index
        const text = `${task.title} ${task.description} ${task.notes}`.toLowerCase();
        const tokens = text.match(/\b\w+\b/g) || [];
        for (const token of tokens) {
            this._searchText.get(token)?.delete(task.id);
            // Clean up empty token entries
            if (this._searchText.get(token)?.size === 0) {
                this._searchText.delete(token);
            }
        }
        // Remove from file index
        for (const filePath of task.related_files) {
            this._files.get(filePath)?.delete(task.id);
            // Clean up empty file entries
            if (this._files.get(filePath)?.size === 0) {
                this._files.delete(filePath);
            }
        }
        // Remove from root/orphan caches (will be rebuilt on next get)
        this._rootTasks.delete(task.id);
        this._orphanTasks.delete(task.id);
    }
    /**
     * Add task to indexes
     * @param task - Task to add
     * @param graph - TaskGraphStore for edge information
     * @private
     */
    _addTask(task, graph) {
        // Add to status index
        if (!this._byStatus.has(task.status)) {
            this._byStatus.set(task.status, new Set());
        }
        this._byStatus.get(task.status).add(task.id);
        // Add to priority index
        if (!this._byPriority.has(task.priority)) {
            this._byPriority.set(task.priority, new Set());
        }
        this._byPriority.get(task.priority).add(task.id);
        // Add to search index (tokenize and index)
        const text = `${task.title} ${task.description} ${task.notes}`.toLowerCase();
        const tokens = text.match(/\b\w+\b/g) || [];
        for (const token of tokens) {
            if (!this._searchText.has(token)) {
                this._searchText.set(token, new Set());
            }
            this._searchText.get(token).add(task.id);
        }
        // Add to file reference index
        for (const filePath of task.related_files) {
            if (!this._files.has(filePath)) {
                this._files.set(filePath, new Set());
            }
            this._files.get(filePath).add(task.id);
        }
        // Update root/orphan status
        this._updateRootOrphanStatus(task.id, graph);
    }
    /**
     * Update root/orphan status for a task
     * @param taskId - Task ID to check
     * @param graph - TaskGraphStore for edge information
     * @private
     */
    _updateRootOrphanStatus(taskId, graph) {
        const incoming = graph.getIncomingEdges(taskId);
        const outgoing = graph.getOutgoingEdges(taskId);
        // Root task: no incoming edges
        if (incoming.length === 0) {
            this._rootTasks.add(taskId);
        }
        else {
            this._rootTasks.delete(taskId);
        }
        // Orphan task: no edges at all
        if (incoming.length === 0 && outgoing.length === 0) {
            this._orphanTasks.add(taskId);
        }
        else {
            this._orphanTasks.delete(taskId);
        }
    }
    /**
     * Rebuild all indexes from scratch
     * O(n) operation where n is the number of tasks
     *
     * @param tasks - Map of all tasks
     * @param graph - TaskGraphStore for edge information
     */
    rebuildIndexes(tasks, graph) {
        // Clear existing indexes
        this._byStatus.clear();
        this._byPriority.clear();
        this._searchText.clear();
        this._files.clear();
        this._rootTasks.clear();
        this._orphanTasks.clear();
        // Re-initialize status and priority maps
        const statuses = ['ready', 'in_progress', 'in_review', 'completed', 'blocked'];
        for (const status of statuses) {
            this._byStatus.set(status, new Set());
        }
        const priorities = ['top', 'second', 'later'];
        for (const priority of priorities) {
            this._byPriority.set(priority, new Set());
        }
        // Rebuild from all tasks
        for (const task of tasks.values()) {
            this._addTask(task, graph);
        }
        // Invalidate cache
        this._cachedIndexes = null;
    }
    /**
     * Get task IDs by status
     * @param status - Task status to filter by
     * @returns Array of task IDs
     */
    getByStatus(status) {
        return Array.from(this._byStatus.get(status) || []);
    }
    /**
     * Get task IDs by priority
     * @param priority - Task priority to filter by
     * @returns Array of task IDs
     */
    getByPriority(priority) {
        return Array.from(this._byPriority.get(priority) || []);
    }
    /**
     * Search tasks by text query
     * @param query - Search query (will be tokenized)
     * @returns Array of task IDs matching any token
     */
    search(query) {
        const tokens = query.toLowerCase().match(/\b\w+\b/g) || [];
        const results = new Set();
        for (const token of tokens) {
            const matching = this._searchText.get(token);
            if (matching) {
                for (const taskId of matching) {
                    results.add(taskId);
                }
            }
        }
        return Array.from(results);
    }
    /**
     * Get task IDs by related file
     * @param filePath - File path to search for
     * @returns Array of task IDs
     */
    getByFile(filePath) {
        return Array.from(this._files.get(filePath) || []);
    }
    /**
     * Get root tasks (no incoming edges)
     * @returns Array of task IDs
     */
    getRootTasks() {
        return Array.from(this._rootTasks);
    }
    /**
     * Get orphan tasks (no edges)
     * @returns Array of task IDs
     */
    getOrphanTasks() {
        return Array.from(this._orphanTasks);
    }
    /**
     * Get all indexes as a ProjectIndexes object
     * Cached result - only recomputed if indexes changed
     *
     * @returns ProjectIndexes interface
     */
    getIndexes() {
        if (this._cachedIndexes) {
            return this._cachedIndexes;
        }
        // Build result object
        const result = {
            byStatus: {},
            byPriority: {},
            rootTasks: this.getRootTasks(),
            orphanTasks: this.getOrphanTasks(),
            searchText: {},
            files: {},
        };
        // Convert status sets to arrays
        for (const [status, taskIds] of this._byStatus) {
            result.byStatus[status] = Array.from(taskIds);
        }
        // Convert priority sets to arrays
        for (const [priority, taskIds] of this._byPriority) {
            result.byPriority[priority] = Array.from(taskIds);
        }
        // Convert search index sets to arrays
        for (const [token, taskIds] of this._searchText) {
            result.searchText[token] = Array.from(taskIds);
        }
        // Convert file index sets to arrays
        for (const [filePath, taskIds] of this._files) {
            result.files[filePath] = Array.from(taskIds);
        }
        // Cache result
        this._cachedIndexes = result;
        return result;
    }
    /**
     * Clear all indexes
     */
    clear() {
        this._byStatus.clear();
        this._byPriority.clear();
        this._searchText.clear();
        this._files.clear();
        this._rootTasks.clear();
        this._orphanTasks.clear();
        this._cachedIndexes = null;
        // Re-initialize status and priority maps
        const statuses = ['ready', 'in_progress', 'in_review', 'completed', 'blocked'];
        for (const status of statuses) {
            this._byStatus.set(status, new Set());
        }
        const priorities = ['top', 'second', 'later'];
        for (const priority of priorities) {
            this._byPriority.set(priority, new Set());
        }
    }
    /**
     * Get index statistics (for debugging)
     * @returns Statistics about the indexes
     */
    getStats() {
        const statusCounts = {
            ready: 0,
            in_progress: 0,
            in_review: 0,
            completed: 0,
            blocked: 0,
        };
        for (const [status, taskIds] of this._byStatus) {
            statusCounts[status] = taskIds.size;
        }
        const priorityCounts = {
            top: 0,
            second: 0,
            later: 0,
        };
        for (const [priority, taskIds] of this._byPriority) {
            priorityCounts[priority] = taskIds.size;
        }
        return {
            statusCounts,
            priorityCounts,
            searchTermsCount: this._searchText.size,
            fileRefCount: this._files.size,
            rootTasksCount: this._rootTasks.size,
            orphanTasksCount: this._orphanTasks.size,
        };
    }
}
//# sourceMappingURL=indexer.js.map