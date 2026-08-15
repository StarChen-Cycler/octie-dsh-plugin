/**
 * Task Graph data structure
 *
 * Implements a directed graph using adjacency lists for O(1) node lookup
 * and O(k) edge traversal where k is the number of edges.
 *
 * Graph Structure:
 * - nodes: Map<taskId, TaskNode> for O(1) node lookup
 * - outgoingEdges: Map<taskId, Set<targetTaskIds>> for forward traversal
 * - incomingEdges: Map<taskId, Set<sourceTaskIds>> for reverse traversal
 *
 * @module core/graph
 */
import type { TaskGraph, ProjectMetadata } from '../../types/index.js';
import { TaskNode } from '../models/task-node.js';
/**
 * TaskGraphStore class
 *
 * Manages the task graph data structure with efficient lookup and traversal.
 * Uses Map and Set for optimal performance:
 * - O(1) node lookup by ID
 * - O(k) edge traversal where k = edge count
 * - O(1) edge existence checking
 */
export declare class TaskGraphStore {
    /** Primary node storage (hash map for O(1) lookup) */
    private _nodes;
    /** Outgoing edges: node -> nodes it points to */
    private _outgoingEdges;
    /** Incoming edges: node -> nodes pointing to it */
    private _incomingEdges;
    /** Graph metadata */
    private _metadata;
    /**
     * Create a new TaskGraphStore
     * @param metadata - Optional project metadata
     */
    constructor(metadata?: ProjectMetadata);
    /**
     * Get the number of tasks in the graph
     */
    get size(): number;
    /**
     * Get the graph metadata
     */
    get metadata(): ProjectMetadata;
    /**
     * Update graph metadata
     * @param metadata - New metadata values (partial update)
     */
    setMetadata(metadata: Partial<ProjectMetadata>): void;
    /**
     * Get a task node by ID
     * @param id - Task ID to look up
     * @returns Task node or undefined if not found
     * @complexity O(1)
     */
    getNode(id: string): TaskNode | undefined;
    /**
     * Get a task node by ID or throw error
     * @param id - Task ID to look up
     * @returns Task node
     * @throws {TaskNotFoundError} If task not found
     * @complexity O(1)
     */
    getNodeOrThrow(id: string): TaskNode;
    /**
     * Check if a task exists
     * @param id - Task ID to check
     * @returns True if task exists
     * @complexity O(1)
     */
    hasNode(id: string): boolean;
    /**
     * Get a task node by short UUID prefix (first 7-8 characters)
     * @param prefix - Short UUID prefix to look up
     * @returns Task node or undefined if not found
     * @throws {AmbiguousIdError} If multiple tasks match the prefix
     * @complexity O(n) where n is the number of tasks
     */
    getNodeByPrefix(prefix: string): TaskNode | undefined;
    /**
     * Get a task node by ID or prefix
     * @param id - Task ID or short UUID prefix to look up
     * @returns Task node or undefined if not found
     * @complexity O(1) for full ID, O(n) for prefix
     */
    getNodeByIdOrPrefix(id: string): TaskNode | undefined;
    /**
     * Generate a unique task ID with collision detection
     * Ensures that the first 7 characters of the UUID are unique across all tasks
     * @returns A unique task ID
     * @throws {Error} If unable to generate unique ID after many attempts
     */
    generateUniqueId(): string;
    /**
     * Get all task IDs in the graph
     * @returns Array of task IDs
     */
    getAllTaskIds(): string[];
    /**
     * Get all task nodes in the graph
     * @returns Array of task nodes
     */
    getAllTasks(): TaskNode[];
    /**
     * Add a task node to the graph
     * @param node - Task node to add
     * @throws {ValidationError} If task ID already exists
     * @complexity O(1)
     */
    addNode(node: TaskNode): void;
    /**
     * Remove a task node from the graph
     * @param id - Task ID to remove
     * @throws {TaskNotFoundError} If task not found
     * @complexity O(k) where k is the number of edges
     */
    removeNode(id: string): void;
    /**
     * Update a task node in the graph
     * @param node - Task node with updated values
     * @throws {TaskNotFoundError} If task not found
     * @complexity O(1)
     */
    updateNode(node: TaskNode): void;
    /**
     * Get outgoing edges for a node
     * @param nodeId - Source task ID
     * @returns Array of target task IDs
     * @complexity O(k) where k is the number of outgoing edges
     */
    getOutgoingEdges(nodeId: string): string[];
    /**
     * Get incoming edges for a node
     * @param nodeId - Target task ID
     * @returns Array of source task IDs
     * @complexity O(k) where k is the number of incoming edges
     */
    getIncomingEdges(nodeId: string): string[];
    /**
     * Add an edge between two nodes
     * @param fromId - Source task ID
     * @param toId - Target task ID
     * @throws {TaskNotFoundError} If either task not found
     * @throws {ValidationError} If edge already exists
     * @complexity O(1)
     */
    addEdge(fromId: string, toId: string): void;
    /**
     * Remove an edge between two nodes
     * @param fromId - Source task ID
     * @param toId - Target task ID
     * @throws {TaskNotFoundError} If either task not found
     * @throws {ValidationError} If edge doesn't exist
     * @complexity O(1)
     */
    removeEdge(fromId: string, toId: string): void;
    /**
     * Check if an edge exists
     * @param fromId - Source task ID
     * @param toId - Target task ID
     * @returns True if edge exists
     * @complexity O(1)
     */
    hasEdge(fromId: string, toId: string): boolean;
    /**
     * Get root tasks (tasks with no incoming edges)
     * @returns Array of root task IDs
     * @complexity O(n) where n is the number of tasks
     */
    getRootTasks(): string[];
    /**
     * Get orphan tasks (tasks with no edges at all)
     * @returns Array of orphan task IDs
     * @complexity O(n) where n is the number of tasks
     */
    getOrphanTasks(): string[];
    /**
     * Get leaf tasks (tasks with no outgoing edges)
     * @returns Array of leaf task IDs
     * @complexity O(n) where n is the number of tasks
     */
    getLeafTasks(): string[];
    /**
     * Clear all tasks and edges from the graph
     * Keeps metadata but resets the graph structure
     */
    clear(): void;
    /**
     * Propagate status changes through the graph starting from a node
     *
     * Uses breadth-first traversal to update tasks based on:
     * 1. Parent's status (CRITICAL: only completed parents allow children to proceed)
     * 2. Task's own item completeness (criteria/deliverables/need_fix)
     *
     * RULE: Only COMPLETED parents can unblock children. If parent is ANY other state
     * (ready, in_progress, in_review, blocked), the child is automatically BLOCKED.
     *
     * When parent is completed:
     *   - No items complete → child becomes 'ready'
     *   - Some items complete → child becomes 'in_progress'
     *   - All items complete → child becomes 'in_review'
     *
     * Propagation stops when a task's status doesn't change.
     *
     * @param startNodeId - The node to start propagation from
     * @returns Object containing updated task IDs and detailed changes
     */
    propagateStatus(startNodeId: string): {
        updatedTasks: string[];
        statusChanges: Array<{
            taskId: string;
            oldStatus: string;
            newStatus: string;
            reason: string;
        }>;
    };
    /**
     * Calculate the status for a child task based on its parent's status and own items
     *
     * RULE: Only COMPLETED parents allow children to calculate status from items.
     * If parent is ANY other state (ready, in_progress, in_review, blocked),
     * child is automatically BLOCKED.
     *
     * @param task - The child task to calculate status for
     * @param parentStatus - The status of the parent task
     * @returns The calculated status
     */
    private calculateChildStatus;
    /**
     * Build a human-readable reason for a status change
     *
     * @param task - The task that changed status
     * @param parentStatus - The status of the parent task
     * @param oldStatus - The previous status
     * @param newStatus - The new status
     * @returns A descriptive reason string
     */
    private buildStatusChangeReason;
    /**
     * Convert graph to TaskGraph interface
     * @returns TaskGraph interface representation
     */
    toInterface(): TaskGraph;
    /**
     * Create TaskGraphStore from TaskGraph interface
     * @param graph - TaskGraph interface
     * @returns New TaskGraphStore instance
     */
    static fromInterface(graph: TaskGraph): TaskGraphStore;
    /**
     * Serialize graph to JSON-compatible object
     * @returns JSON-serializable object
     */
    toJSON(): {
        nodes: Record<string, TaskNode>;
        outgoingEdges: Record<string, string[]>;
        incomingEdges: Record<string, string[]>;
        metadata: ProjectMetadata;
    };
    /**
     * Deserialize graph from JSON object
     * @param json - JSON object from toJSON()
     * @returns New TaskGraphStore instance
     */
    static fromJSON(json: {
        nodes: Record<string, TaskNode>;
        outgoingEdges: Record<string, string[]>;
        incomingEdges: Record<string, string[]>;
        metadata: ProjectMetadata;
    }): TaskGraphStore;
}
//# sourceMappingURL=index.d.ts.map