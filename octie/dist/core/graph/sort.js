/**
 * Graph topological sort algorithms
 *
 * Implements Kahn's algorithm for topological sorting with cycle detection.
 * Time complexity: O(V + E) where V = vertices, E = edges
 *
 * @module core/graph/sort
 */
import { CircularDependencyError } from '../../types/index.js';
/** Cache for topological sort results */
const sortCache = new Map();
/** Cache TTL in milliseconds (5 seconds) */
const CACHE_TTL = 5000;
/**
 * Generate a cache key for the graph
 * @param graph - Task graph store
 * @returns Cache key string
 */
function generateCacheKey(graph) {
    const taskIds = graph.getAllTaskIds().sort().join(',');
    const metadata = graph.metadata;
    return `${metadata.project_name}:${metadata.version}:${taskIds}:${graph.size}`;
}
/**
 * Clear the topological sort cache
 * Call this after modifying the graph structure
 */
export function clearSortCache() {
    sortCache.clear();
}
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
export function topologicalSort(graph, useCache = true) {
    // Check cache
    if (useCache) {
        const cacheKey = generateCacheKey(graph);
        const cached = sortCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.result;
        }
    }
    const result = kahnSort(graph);
    // Update cache
    if (useCache) {
        const cacheKey = generateCacheKey(graph);
        sortCache.set(cacheKey, { result, timestamp: Date.now() });
    }
    return result;
}
/**
 * Internal implementation of Kahn's algorithm
 * @param graph - Task graph store
 * @returns Topological sort result
 */
function kahnSort(graph) {
    // Step 1: Initialize in-degree map
    const inDegree = new Map();
    const allTaskIds = graph.getAllTaskIds();
    for (const taskId of allTaskIds) {
        inDegree.set(taskId, 0);
    }
    // Step 2: Calculate in-degrees from outgoing edges
    for (const taskId of allTaskIds) {
        const outgoingEdges = graph.getOutgoingEdges(taskId);
        for (const targetId of outgoingEdges) {
            inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
        }
    }
    // Step 3: Initialize queue with zero in-degree nodes
    const queue = [];
    for (const [taskId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(taskId);
        }
    }
    // Step 4: Process queue
    const sorted = [];
    while (queue.length > 0) {
        // Remove first node from queue
        const nodeId = queue.shift();
        sorted.push(nodeId);
        // Reduce in-degree of all neighbors
        const neighbors = graph.getOutgoingEdges(nodeId);
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, newDegree);
            // Add to queue if in-degree becomes zero
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }
    // Step 5: Detect cycle
    const hasCycle = sorted.length !== graph.size;
    const cycleNodes = hasCycle
        ? allTaskIds.filter(id => !sorted.includes(id))
        : [];
    return {
        sorted,
        hasCycle,
        cycleNodes,
    };
}
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
export function findCriticalPath(graph, taskDuration = 1) {
    // First, verify no cycles exist
    const sortResult = topologicalSort(graph, false);
    if (sortResult.hasCycle) {
        throw new CircularDependencyError(sortResult.cycleNodes);
    }
    // Calculate earliest start times using DP
    const earliestStart = new Map();
    const getDuration = typeof taskDuration === 'number'
        ? () => taskDuration
        : (id) => taskDuration.get(id) || 1;
    // Initialize all start times to 0
    for (const taskId of graph.getAllTaskIds()) {
        earliestStart.set(taskId, 0);
    }
    // Process in topological order
    for (const nodeId of sortResult.sorted) {
        const predecessors = graph.getIncomingEdges(nodeId);
        const maxPredFinish = predecessors.length === 0
            ? 0
            : Math.max(...predecessors.map(p => (earliestStart.get(p) || 0) + getDuration(p)));
        earliestStart.set(nodeId, maxPredFinish);
    }
    // Find node with maximum finish time
    let maxFinish = 0;
    let endNode = '';
    for (const [nodeId, start] of earliestStart) {
        const finish = start + getDuration(nodeId);
        if (finish > maxFinish) {
            maxFinish = finish;
            endNode = nodeId;
        }
    }
    // Backtrack to find critical path
    const criticalPath = [endNode];
    let current = endNode;
    while (true) {
        const predecessors = graph.getIncomingEdges(current);
        if (predecessors.length === 0)
            break;
        // Find predecessor on critical path
        const currentStart = earliestStart.get(current) || 0;
        const criticalPred = predecessors.find(p => {
            const predFinish = (earliestStart.get(p) || 0) + getDuration(p);
            return predFinish === currentStart;
        });
        if (!criticalPred)
            break;
        criticalPath.unshift(criticalPred);
        current = criticalPred;
    }
    return {
        path: criticalPath,
        duration: maxFinish,
    };
}
/**
 * Validate that a graph is a valid DAG
 * Convenience wrapper around topologicalSort
 *
 * @param graph - Task graph store
 * @returns true if graph is a valid DAG, false otherwise
 */
export function isValidDAG(graph) {
    const result = topologicalSort(graph, false);
    return !result.hasCycle;
}
/**
 * Get task execution levels (parallelizable stages)
 * Tasks at the same level have no dependencies between them
 *
 * @param graph - Task graph store
 * @returns Array of task ID arrays (each level is a parallelizable stage)
 * @throws {CircularDependencyError} If graph contains cycles
 */
export function getExecutionLevels(graph) {
    const sortResult = topologicalSort(graph, false);
    if (sortResult.hasCycle) {
        const { CircularDependencyError } = require('../../types/index.js');
        throw new CircularDependencyError(sortResult.cycleNodes);
    }
    const levels = [];
    const inDegree = new Map();
    const remaining = new Set(sortResult.sorted);
    // Calculate initial in-degrees
    for (const taskId of sortResult.sorted) {
        inDegree.set(taskId, graph.getIncomingEdges(taskId).length);
    }
    // Process level by level
    while (remaining.size > 0) {
        const currentLevel = [];
        // Find all nodes with zero in-degree from remaining nodes
        for (const taskId of remaining) {
            if ((inDegree.get(taskId) || 0) === 0) {
                currentLevel.push(taskId);
            }
        }
        if (currentLevel.length === 0) {
            // This shouldn't happen if graph is valid
            break;
        }
        levels.push(currentLevel);
        // Remove current level and update in-degrees
        for (const taskId of currentLevel) {
            remaining.delete(taskId);
            for (const neighbor of graph.getOutgoingEdges(taskId)) {
                if (remaining.has(neighbor)) {
                    inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
                }
            }
        }
    }
    return levels;
}
//# sourceMappingURL=sort.js.map