/**
 * Graph manipulation operations
 *
 * Implements complex graph operations for task management:
 * - Cut nodes from graph while reconnecting edges
 * - Insert nodes between existing nodes
 * - Move subtrees to new parents
 * - Merge tasks together
 *
 * @module core/graph/operations
 */
import type { TaskGraphStore } from './index.js';
import type { MergeResult } from '../../types/index.js';
import { TaskNode } from '../models/task-node.js';
/**
 * Cut a node from the graph, reconnecting its incoming edges to its outgoing edges
 *
 * Before: A -> B -> C
 * After:  A -> C (B removed)
 *
 * Algorithm:
 * 1. Get all incoming edges to the node
 * 2. Get all outgoing edges from the node
 * 3. For each incoming source, connect it to all outgoing targets
 * 4. Update target blockers to reference new sources instead of deleted node
 * 5. Remove the node from the graph
 *
 * Time Complexity: O(k * m) where k = incoming edges, m = outgoing edges
 *
 * @param graph - Task graph store
 * @param nodeId - Task ID to cut
 * @throws {TaskNotFoundError} If task not found
 *
 * @returns Array of directly affected target task IDs whose status should be recalculated
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C
 * const affected = cutNode(graph, 'B');
 * // Result: A -> C (B removed, A now points directly to C)
 * // Also: C.blockers updated from [B] to [A]
 * ```
 */
export declare function cutNode(graph: TaskGraphStore, nodeId: string): string[];
/**
 * Insert a node between two existing nodes
 *
 * Before: A -> C
 * After:  A -> B -> C
 *
 * Algorithm:
 * 1. Verify both nodes exist
 * 2. Verify edge exists from afterId to beforeId
 * 3. Remove the existing edge
 * 4. Add the new node to the graph
 * 5. Create edges: afterId -> newNodeId -> beforeId
 *
 * Time Complexity: O(1) for edge operations
 *
 * @param graph - Task graph store
 * @param newNode - Task node to insert
 * @param afterId - Source node ID (edge comes from here)
 * @param beforeId - Target node ID (edge goes to here)
 * @throws {TaskNotFoundError} If afterId or beforeId not found
 * @throws {ValidationError} If edge doesn't exist or would create duplicate
 *
 * @example
 * ```ts
 * // Graph: A -> C
 * const newNode = createTaskNode({ title: 'B', ... });
 * insertNodeBetween(graph, newNode, 'A', 'C');
 * // Result: A -> B -> C
 * ```
 */
export declare function insertNodeBetween(graph: TaskGraphStore, newNode: TaskNode, afterId: string, beforeId: string): void;
/**
 * Move a subtree to a new parent
 *
 * Moves a task (and all its descendants) to be under a new parent.
 * This is useful for reorganizing task hierarchies.
 *
 * Before:
 *   A -> X
 *   B -> Y
 * After moveSubtree(graph, 'Y', 'A'):
 *   A -> X -> Y
 *   B
 *
 * Algorithm:
 * 1. Get all current parents of the subtree root
 * 2. Remove edges from all current parents
 * 3. Add edge from new parent to subtree root
 *
 * Time Complexity: O(k) where k = number of current parents
 *
 * @param graph - Task graph store
 * @param subtreeRootId - Root of the subtree to move
 * @param newParentId - New parent task ID
 * @throws {TaskNotFoundError} If subtreeRootId or newParentId not found
 * @throws {ValidationError} If edge already exists or would create self-loop
 *
 * @example
 * ```ts
 * // Graph: A -> X, B -> Y
 * moveSubtree(graph, 'Y', 'X');
 * // Result: A -> X -> Y, B
 * ```
 */
export declare function moveSubtree(graph: TaskGraphStore, subtreeRootId: string, newParentId: string): void;
/**
 * Merge two tasks into one
 *
 * Combines the source task into the target task by:
 * 1. Merging all properties (description, success_criteria, deliverables, etc.)
 * 2. Reconnecting all edges from source to point to target
 * 3. Removing the source task
 *
 * Before:
 *   A -> source -> C
 *   B -> target -> D
 * After mergeTasks(graph, 'source', 'target'):
 *   A -> target -> C, D
 *   B -> target -> C, D
 *   (source is removed)
 *
 * Algorithm:
 * 1. Get source and target tasks
 * 2. Merge target properties with source properties
 * 3. Get all incoming edges to source (except target)
 * 4. Get all outgoing edges from source (except target)
 * 5. Reconnect edges: incoming -> target, target -> outgoing
 * 6. Remove source node
 * 7. Return merge result
 *
 * Time Complexity: O(k + m) where k = incoming edges, m = outgoing edges
 *
 * @param graph - Task graph store
 * @param sourceId - Source task ID (will be removed)
 * @param targetId - Target task ID (will be kept and merged into)
 * @returns Merge result with merged task and affected task IDs
 * @throws {TaskNotFoundError} If source or target not found
 * @throws {ValidationError} If source and target are the same
 *
 * @example
 * ```ts
 * const result = mergeTasks(graph, 'task-001', 'task-002');
 * console.log('Merged task:', result.task.id);
 * console.log('Removed tasks:', result.removedTasks);
 * ```
 */
export declare function mergeTasks(graph: TaskGraphStore, sourceId: string, targetId: string): MergeResult;
/**
 * Get all descendants of a node (transitive closure via outgoing edges)
 *
 * Returns all tasks reachable from the given node.
 *
 * @param graph - Task graph store
 * @param nodeId - Starting task ID
 * @returns Set of descendant task IDs (including the starting node)
 * @throws {TaskNotFoundError} If node not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C, A -> D
 * const descendants = getDescendants(graph, 'A');
 * // Returns: ['A', 'B', 'C', 'D']
 * ```
 */
export declare function getDescendants(graph: TaskGraphStore, nodeId: string): Set<string>;
/**
 * Get all ancestors of a node (transitive closure via incoming edges)
 *
 * Returns all tasks that can reach the given node.
 *
 * @param graph - Task graph store
 * @param nodeId - Starting task ID
 * @returns Set of ancestor task IDs (including the starting node)
 * @throws {TaskNotFoundError} If node not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C
 * const ancestors = getAncestors(graph, 'C');
 * // Returns: ['C', 'B', 'A']
 * ```
 */
export declare function getAncestors(graph: TaskGraphStore, nodeId: string): Set<string>;
/**
 * Validate that moving a subtree won't create a cycle
 *
 * Checks if adding an edge from newParentId to subtreeRootId would create a cycle.
 * This is important for moveSubtree operations.
 *
 * @param graph - Task graph store
 * @param subtreeRootId - Root of the subtree to move
 * @param newParentId - Potential new parent task ID
 * @returns true if move is safe (won't create cycle), false otherwise
 * @throws {TaskNotFoundError} If either task not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C
 * if (isValidSubtreeMove(graph, 'C', 'A')) {
 *   // This would create a cycle (A -> B -> C -> A)
 *   // Don't allow the move
 * }
 * ```
 */
export declare function isValidSubtreeMove(graph: TaskGraphStore, subtreeRootId: string, newParentId: string): boolean;
/**
 * Cascade delete a node and all its dependent tasks
 *
 * Deletes the specified node and all tasks that depend on it (directly or transitively).
 * Tasks are deleted in reverse order (leaves first) to maintain graph integrity.
 *
 * Before:
 *   A -> B -> C -> D
 * After cascadeDelete(graph, 'B'):
 *   A (B, C, D removed)
 *
 * Algorithm:
 * 1. Get all descendants of the node (tasks that depend on it transitively)
 * 2. Iteratively find and delete leaf nodes (no outgoing edges) first
 * 3. Continue until all descendants are deleted
 *
 * Time Complexity: O(k * m) where k = descendants, m = average edges
 *
 * @param graph - Task graph store
 * @param nodeId - Task ID to cascade delete
 * @returns Array of deleted task IDs (in order of deletion)
 * @throws {TaskNotFoundError} If node not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C -> D
 * const deleted = cascadeDelete(graph, 'B');
 * // Returns: ['D', 'C', 'B'] (deleted in this order)
 * // Result: Only A remains
 * ```
 */
export declare function cascadeDelete(graph: TaskGraphStore, nodeId: string): string[];
//# sourceMappingURL=operations.d.ts.map