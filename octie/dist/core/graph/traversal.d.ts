/**
 * Graph traversal algorithms
 *
 * Implements BFS and DFS traversal methods for path finding and
 * reachable node discovery.
 * Time complexity: O(V + E) where V = vertices, E = edges
 *
 * @module core/graph/traversal
 */
import type { TaskGraphStore } from './index.js';
/**
 * Breadth-First Search traversal
 *
 * Explores nodes layer by layer, finding all reachable nodes from a start node.
 * Useful for finding all descendants (forward) or ancestors (backward).
 *
 * Time Complexity: O(V + E) in worst case
 * Space Complexity: O(V) for visited set and queue
 *
 * @param graph - Task graph store
 * @param startId - Starting task ID
 * @param direction - Traversal direction: 'forward' (outgoing) or 'backward' (incoming)
 * @returns Array of reachable task IDs in order of discovery
 * @throws {TaskNotFoundError} If start node doesn't exist
 *
 * @example
 * ```ts
 * // Find all tasks that depend on the start task
 * const descendants = bfsTraversal(graph, 'task-001', 'forward');
 *
 * // Find all tasks that the start task depends on
 * const ancestors = bfsTraversal(graph, 'task-001', 'backward');
 * ```
 */
export declare function bfsTraversal(graph: TaskGraphStore, startId: string, direction?: 'forward' | 'backward'): string[];
/**
 * Depth-First Search to find path between two nodes
 *
 * Attempts to find a path from start to end using DFS with backtracking.
 * Returns the first path found, or null if no path exists.
 *
 * Time Complexity: O(V + E) in worst case
 * Space Complexity: O(V) for recursion stack and visited set
 *
 * @param graph - Task graph store
 * @param startId - Starting task ID
 * @param endId - Target task ID
 * @param direction - Search direction: 'forward' (follow outgoing) or 'backward' (follow incoming)
 * @returns Path array from start to end, or null if no path exists
 * @throws {TaskNotFoundError} If either node doesn't exist
 *
 * @example
 * ```ts
 * // Find path from task-001 to task-005
 * const path = dfsFindPath(graph, 'task-001', 'task-005');
 * if (path) {
 *   console.log('Path:', path.join(' -> '));
 *   // Output: Path: task-001 -> task-002 -> task-004 -> task-005
 * }
 * ```
 */
export declare function dfsFindPath(graph: TaskGraphStore, startId: string, endId: string, direction?: 'forward' | 'backward'): string[] | null;
/**
 * Find all paths between two nodes
 *
 * Uses DFS to find all possible paths from start to end.
 * Warning: Can be expensive on dense graphs with many paths.
 *
 * @param graph - Task graph store
 * @param startId - Starting task ID
 * @param endId - Target task ID
 * @param direction - Search direction: 'forward' or 'backward'
 * @param maxPaths - Maximum number of paths to find (default: 100, prevents explosion)
 * @returns Array of paths (each path is an array of task IDs)
 * @throws {TaskNotFoundError} If either node doesn't exist
 */
export declare function findAllPaths(graph: TaskGraphStore, startId: string, endId: string, direction?: 'forward' | 'backward', maxPaths?: number): string[][];
/**
 * Get shortest path between two nodes using BFS
 *
 * BFS naturally finds the shortest path in unweighted graphs.
 *
 * @param graph - Task graph store
 * @param startId - Starting task ID
 * @param endId - Target task ID
 * @param direction - Search direction: 'forward' or 'backward'
 * @returns Shortest path array, or null if no path exists
 * @throws {TaskNotFoundError} If either node doesn't exist
 */
export declare function findShortestPath(graph: TaskGraphStore, startId: string, endId: string, direction?: 'forward' | 'backward'): string[] | null;
/**
 * Check if two nodes are connected (path exists)
 *
 * @param graph - Task graph store
 * @param fromId - Source task ID
 * @param toId - Target task ID
 * @param direction - Search direction: 'forward' or 'backward'
 * @returns true if a path exists between the nodes
 */
export declare function areConnected(graph: TaskGraphStore, fromId: string, toId: string, direction?: 'forward' | 'backward'): boolean;
/**
 * Get distance (number of edges) between two nodes
 *
 * @param graph - Task graph store
 * @param fromId - Source task ID
 * @param toId - Target task ID
 * @param direction - Search direction: 'forward' or 'backward'
 * @returns Number of edges in shortest path, or -1 if no path exists
 */
export declare function getDistance(graph: TaskGraphStore, fromId: string, toId: string, direction?: 'forward' | 'backward'): number;
/**
 * Get connected components in the graph
 *
 * Identifies groups of nodes that are reachable from each other.
 * For directed graphs, uses weakly connected components
 * (treating edges as undirected).
 *
 * @param graph - Task graph store
 * @returns Array of connected components (each is an array of task IDs)
 */
export declare function getConnectedComponents(graph: TaskGraphStore): string[][];
//# sourceMappingURL=traversal.d.ts.map