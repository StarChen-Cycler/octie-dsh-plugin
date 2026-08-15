/**
 * Graph cycle detection algorithms
 *
 * Implements DFS-based cycle detection with three-color marking.
 * Detects all cycles and returns cycle paths for debugging.
 * Time complexity: O(V + E) where V = vertices, E = edges
 *
 * @module core/graph/cycle
 */
import type { TaskGraphStore } from './index.js';
import type { CycleDetectionResult } from '../../types/index.js';
/**
 * Detect cycles using DFS with three-color marking
 *
 * Algorithm:
 * 1. Mark all nodes as WHITE (unvisited)
 * 2. For each WHITE node, start DFS traversal
 * 3. Mark node as GRAY when entering, BLACK when exiting
 * 4. If we encounter a GRAY node during traversal, we found a cycle
 * 5. Check for self-loops (task blocking itself) before DFS
 * 6. Reconstruct cycle path using parent pointers
 *
 * Time Complexity: O(V + E)
 * Space Complexity: O(V) for recursion stack and state tracking
 *
 * @param graph - Task graph store
 * @returns Cycle detection result with all detected cycles
 *
 * @example
 * ```ts
 * const result = detectCycle(graph);
 * if (result.hasCycle) {
 *   console.error('Found cycles:', result.cycles);
 *   for (const cycle of result.cycles) {
 *     console.error('Cycle:', cycle.join(' -> '));
 *   }
 * }
 * ```
 */
export declare function detectCycle(graph: TaskGraphStore): CycleDetectionResult;
/**
 * Check if a graph contains any cycles
 * Convenience function that returns a boolean
 *
 * @param graph - Task graph store
 * @returns true if graph contains at least one cycle
 */
export declare function hasCycle(graph: TaskGraphStore): boolean;
/**
 * Get all nodes involved in cycles
 *
 * @param graph - Task graph store
 * @returns Set of task IDs that are part of at least one cycle
 */
export declare function getCyclicNodes(graph: TaskGraphStore): Set<string>;
/**
 * Find the shortest cycle in the graph
 * Useful for identifying the most critical circular dependency
 *
 * @param graph - Task graph store
 * @returns Shortest cycle array, or empty array if no cycles
 */
export declare function findShortestCycle(graph: TaskGraphStore): string[];
/**
 * Find all cycles involving a specific task
 *
 * @param graph - Task graph store
 * @param taskId - Task ID to find cycles for
 * @returns Array of cycles that include the specified task
 */
export declare function findCyclesForTask(graph: TaskGraphStore, taskId: string): string[][];
/**
 * Validate that a graph is acyclic (DAG)
 * Throws an error if cycles are detected
 *
 * @param graph - Task graph store
 * @throws {CircularDependencyError} If graph contains cycles
 */
export declare function validateAcyclic(graph: TaskGraphStore): void;
/**
 * Get cycle statistics
 *
 * @param graph - Task graph store
 * @returns Object with cycle count and nodes in cycles
 */
export declare function getCycleStatistics(graph: TaskGraphStore): {
    cycleCount: number;
    nodesInCycles: number;
    totalNodes: number;
    cyclesByLength: Record<number, number>;
};
/**
 * Result of reference validation
 */
export interface ReferenceValidationResult {
    /** True if any invalid references were found */
    hasInvalidReferences: boolean;
    /** List of invalid references found */
    invalidReferences: Array<{
        /** Task ID that has the invalid reference */
        taskId: string;
        /** Blocker ID that doesn't exist */
        invalidBlockerId: string;
    }>;
}
/**
 * Validate that all blocker references point to existing tasks
 *
 * Checks each task's blockers array to ensure all referenced tasks exist.
 * This catches orphaned references that could occur from:
 * - Manual JSON editing
 * - Bugs in edge manipulation
 * - Incomplete graph operations
 *
 * @param graph - Task graph store
 * @returns Validation result with any invalid references found
 *
 * @example
 * ```ts
 * const result = validateReferences(graph);
 * if (result.hasInvalidReferences) {
 *   for (const ref of result.invalidReferences) {
 *     console.error(`Task ${ref.taskId} has missing blocker: ${ref.invalidBlockerId}`);
 *   }
 * }
 * ```
 */
export declare function validateReferences(graph: TaskGraphStore): ReferenceValidationResult;
/**
 * Check if adding an edge would create a cycle
 *
 * When adding a blocker relationship (blockerId → taskId), this function
 * checks if there's already a path from taskId to blockerId. If so,
 * adding the edge would create a cycle.
 *
 * Also rejects self-blocking (taskId === blockerId).
 *
 * @param graph - Task graph store
 * @param blockerId - The task that will block (source of edge)
 * @param taskId - The task being blocked (target of edge)
 * @returns true if adding this edge would create a cycle
 *
 * @example
 * ```ts
 * // Before adding blocker, check for cycle
 * if (wouldCreateCycle(graph, blockerId, taskId)) {
 *   console.error('Cannot add blocker: would create a cycle');
 * } else {
 *   task.addBlocker(blockerId);
 *   graph.addEdge(blockerId, taskId);
 * }
 * ```
 */
export declare function wouldCreateCycle(graph: TaskGraphStore, blockerId: string, taskId: string): boolean;
//# sourceMappingURL=cycle.d.ts.map