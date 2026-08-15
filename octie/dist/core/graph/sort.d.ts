/**
 * Graph topological sort algorithms
 *
 * Implements Kahn's algorithm for topological sorting with cycle detection.
 * Time complexity: O(V + E) where V = vertices, E = edges
 *
 * @module core/graph/sort
 */
import type { TaskGraphStore } from './index.js';
import type { TopologicalSortResult } from '../../types/index.js';
/**
 * Clear the topological sort cache
 * Call this after modifying the graph structure
 */
export declare function clearSortCache(): void;
/**
 * Perform topological sort using Kahn's algorithm
 *
 * Algorithm steps:
 * 1. Calculate in-degree for all nodes
 * 2. Initialize queue with nodes having zero in-degree
 * 3. Process queue: remove node, add to result, reduce neighbors' in-degree
 * 4. Add any neighbors with zero in-degree to queue
 * 5. Detect cycle if result doesn't contain all nodes
 *
 * Time Complexity: O(V + E)
 * Space Complexity: O(V)
 *
 * @param graph - Task graph store
 * @param useCache - Whether to use memoization cache (default: true)
 * @returns Topological sort result with sorted order and cycle detection
 *
 * @example
 * ```ts
 * const result = topologicalSort(graph);
 * if (result.hasCycle) {
 *   console.error('Cycle detected:', result.cycleNodes);
 * } else {
 *   console.log('Execution order:', result.sorted);
 * }
 * ```
 */
export declare function topologicalSort(graph: TaskGraphStore, useCache?: boolean): TopologicalSortResult;
/**
 * Find the critical path (longest path) in the DAG
 * Uses topological sort and dynamic programming
 *
 * Time Complexity: O(V + E)
 *
 * @param graph - Task graph store
 * @param taskDuration - Duration for each task (default: 1)
 * @returns Object with path array and total duration
 * @throws {CircularDependencyError} If graph contains cycles
 */
export declare function findCriticalPath(graph: TaskGraphStore, taskDuration?: number | Map<string, number>): {
    path: string[];
    duration: number;
};
/**
 * Validate that a graph is a valid DAG
 * Convenience wrapper around topologicalSort
 *
 * @param graph - Task graph store
 * @returns true if graph is a valid DAG, false otherwise
 */
export declare function isValidDAG(graph: TaskGraphStore): boolean;
/**
 * Get task execution levels (parallelizable stages)
 * Tasks at the same level have no dependencies between them
 *
 * @param graph - Task graph store
 * @returns Array of task ID arrays (each level is a parallelizable stage)
 * @throws {CircularDependencyError} If graph contains cycles
 */
export declare function getExecutionLevels(graph: TaskGraphStore): string[][];
//# sourceMappingURL=sort.d.ts.map