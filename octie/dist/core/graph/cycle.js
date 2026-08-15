/**
 * Graph cycle detection algorithms
 *
 * Implements DFS-based cycle detection with three-color marking.
 * Detects all cycles and returns cycle paths for debugging.
 * Time complexity: O(V + E) where V = vertices, E = edges
 *
 * @module core/graph/cycle
 */
import { CircularDependencyError } from '../../types/index.js';
/** Node visitation states for DFS cycle detection */
var VisitState;
(function (VisitState) {
    /** Node has not been visited */
    VisitState[VisitState["WHITE"] = 0] = "WHITE";
    /** Node is currently being visited (in recursion stack) */
    VisitState[VisitState["GRAY"] = 1] = "GRAY";
    /** Node and all descendants have been completely visited */
    VisitState[VisitState["BLACK"] = 2] = "BLACK";
})(VisitState || (VisitState = {}));
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
export function detectCycle(graph) {
    const cycles = [];
    const color = new Map();
    const parent = new Map();
    // Initialize all nodes as WHITE
    for (const taskId of graph.getAllTaskIds()) {
        color.set(taskId, VisitState.WHITE);
        parent.set(taskId, null);
    }
    /**
     * DFS traversal to detect cycles
     * @param nodeId - Current node being visited
     * @returns true if a cycle was found (can continue to find more)
     */
    function dfs(nodeId) {
        // Mark current node as being visited
        color.set(nodeId, VisitState.GRAY);
        // Check for self-loop (task blocks itself)
        const task = graph.getNode(nodeId);
        if (task && task.blockers.includes(nodeId)) {
            cycles.push([nodeId, nodeId]); // Self-loop: A -> A
            // Continue to find more cycles, don't return yet
        }
        // Visit all neighbors
        const neighbors = graph.getOutgoingEdges(nodeId);
        for (const neighbor of neighbors) {
            const neighborState = color.get(neighbor) ?? VisitState.WHITE;
            if (neighborState === VisitState.GRAY) {
                // Found a cycle - reconstruct the path
                const cycle = [neighbor];
                // Backtrack from current node to the neighbor
                let current = nodeId;
                while (current && current !== neighbor) {
                    cycle.unshift(current);
                    current = parent.get(current) || null;
                }
                // Add neighbor at start to complete the cycle
                cycle.unshift(neighbor);
                cycles.push(cycle);
                return true; // Continue to find more cycles
            }
            if (neighborState === VisitState.WHITE) {
                // Set parent and continue DFS
                parent.set(neighbor, nodeId);
                if (dfs(neighbor)) {
                    return true; // Continue searching
                }
            }
            // BLACK nodes are already processed, skip them
        }
        // Mark node as completely visited
        color.set(nodeId, VisitState.BLACK);
        return false;
    }
    // Start DFS from all unvisited nodes
    for (const taskId of graph.getAllTaskIds()) {
        if ((color.get(taskId) ?? VisitState.WHITE) === VisitState.WHITE) {
            dfs(taskId);
        }
    }
    return {
        hasCycle: cycles.length > 0,
        cycles,
    };
}
/**
 * Check if a graph contains any cycles
 * Convenience function that returns a boolean
 *
 * @param graph - Task graph store
 * @returns true if graph contains at least one cycle
 */
export function hasCycle(graph) {
    const result = detectCycle(graph);
    return result.hasCycle;
}
/**
 * Get all nodes involved in cycles
 *
 * @param graph - Task graph store
 * @returns Set of task IDs that are part of at least one cycle
 */
export function getCyclicNodes(graph) {
    const result = detectCycle(graph);
    const cyclicNodes = new Set();
    for (const cycle of result.cycles) {
        for (const nodeId of cycle) {
            cyclicNodes.add(nodeId);
        }
    }
    return cyclicNodes;
}
/**
 * Find the shortest cycle in the graph
 * Useful for identifying the most critical circular dependency
 *
 * @param graph - Task graph store
 * @returns Shortest cycle array, or empty array if no cycles
 */
export function findShortestCycle(graph) {
    const result = detectCycle(graph);
    if (result.cycles.length === 0) {
        return [];
    }
    return result.cycles.reduce((shortest, current) => current.length < shortest.length ? current : shortest);
}
/**
 * Find all cycles involving a specific task
 *
 * @param graph - Task graph store
 * @param taskId - Task ID to find cycles for
 * @returns Array of cycles that include the specified task
 */
export function findCyclesForTask(graph, taskId) {
    const result = detectCycle(graph);
    return result.cycles.filter(cycle => cycle.includes(taskId));
}
/**
 * Validate that a graph is acyclic (DAG)
 * Throws an error if cycles are detected
 *
 * @param graph - Task graph store
 * @throws {CircularDependencyError} If graph contains cycles
 */
export function validateAcyclic(graph) {
    const result = detectCycle(graph);
    if (result.hasCycle) {
        // Use the first cycle found for the error
        const firstCycle = result.cycles[0];
        if (firstCycle) {
            throw new CircularDependencyError(firstCycle);
        }
    }
}
/**
 * Get cycle statistics
 *
 * @param graph - Task graph store
 * @returns Object with cycle count and nodes in cycles
 */
export function getCycleStatistics(graph) {
    const result = detectCycle(graph);
    const cyclicNodes = getCyclicNodes(graph);
    const cyclesByLength = {};
    for (const cycle of result.cycles) {
        const len = cycle.length;
        cyclesByLength[len] = (cyclesByLength[len] || 0) + 1;
    }
    return {
        cycleCount: result.cycles.length,
        nodesInCycles: cyclicNodes.size,
        totalNodes: graph.size,
        cyclesByLength,
    };
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
export function validateReferences(graph) {
    const invalidReferences = [];
    for (const taskId of graph.getAllTaskIds()) {
        const task = graph.getNode(taskId);
        if (task) {
            for (const blockerId of task.blockers) {
                if (!graph.hasNode(blockerId)) {
                    invalidReferences.push({ taskId, invalidBlockerId: blockerId });
                }
            }
        }
    }
    return {
        hasInvalidReferences: invalidReferences.length > 0,
        invalidReferences,
    };
}
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
export function wouldCreateCycle(graph, blockerId, taskId) {
    // Self-blocking is always a cycle
    if (blockerId === taskId) {
        return true;
    }
    // Check if taskId can already reach blockerId through existing edges
    // If so, adding blockerId → taskId would create a cycle
    // We search 'forward' from taskId following outgoing edges
    const visited = new Set();
    const queue = [taskId];
    while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId === blockerId) {
            return true; // Found path from taskId to blockerId
        }
        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);
        // Follow outgoing edges (tasks that this task blocks)
        const neighbors = graph.getOutgoingEdges(currentId);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }
    return false;
}
//# sourceMappingURL=cycle.js.map