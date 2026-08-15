/**
 * Graph traversal algorithms
 *
 * Implements BFS and DFS traversal methods for path finding and
 * reachable node discovery.
 * Time complexity: O(V + E) where V = vertices, E = edges
 *
 * @module core/graph/traversal
 */
import { TaskNotFoundError } from '../../types/index.js';
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
export function bfsTraversal(graph, startId, direction = 'forward') {
    // Validate start node exists
    if (!graph.hasNode(startId)) {
        throw new TaskNotFoundError(startId);
    }
    const visited = new Set();
    const queue = [startId];
    const result = [];
    /**
     * Get neighbors based on traversal direction
     * @param id - Task ID
     * @returns Array of neighbor task IDs
     */
    const getNeighbors = (id) => {
        return direction === 'forward'
            ? graph.getOutgoingEdges(id)
            : graph.getIncomingEdges(id);
    };
    while (queue.length > 0) {
        // Dequeue next node
        const nodeId = queue.shift();
        // Skip if already visited
        if (visited.has(nodeId)) {
            continue;
        }
        // Mark as visited and add to result
        visited.add(nodeId);
        result.push(nodeId);
        // Enqueue all unvisited neighbors
        const neighbors = getNeighbors(nodeId);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }
    return result;
}
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
export function dfsFindPath(graph, startId, endId, direction = 'forward') {
    // Validate both nodes exist
    if (!graph.hasNode(startId)) {
        throw new TaskNotFoundError(startId);
    }
    if (!graph.hasNode(endId)) {
        throw new TaskNotFoundError(endId);
    }
    const visited = new Set();
    const path = [];
    /**
     * Get neighbors based on search direction
     * @param id - Task ID
     * @returns Array of neighbor task IDs
     */
    const getNeighbors = (id) => {
        return direction === 'forward'
            ? graph.getOutgoingEdges(id)
            : graph.getIncomingEdges(id);
    };
    /**
     * Recursive DFS with backtracking
     * @param currentId - Current node being visited
     * @returns true if path was found
     */
    function dfs(currentId) {
        // Skip if already visited
        if (visited.has(currentId)) {
            return false;
        }
        // Mark as visited and add to path
        visited.add(currentId);
        path.push(currentId);
        // Check if we found the target
        if (currentId === endId) {
            return true;
        }
        // Recursively search neighbors
        const neighbors = getNeighbors(currentId);
        for (const neighbor of neighbors) {
            if (dfs(neighbor)) {
                return true; // Path found, propagate success
            }
        }
        // Backtrack: remove from path
        path.pop();
        return false;
    }
    return dfs(startId) ? path : null;
}
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
export function findAllPaths(graph, startId, endId, direction = 'forward', maxPaths = 100) {
    // Validate both nodes exist
    if (!graph.hasNode(startId)) {
        throw new TaskNotFoundError(startId);
    }
    if (!graph.hasNode(endId)) {
        throw new TaskNotFoundError(endId);
    }
    const allPaths = [];
    const visited = new Set();
    const currentPath = [];
    /**
     * Get neighbors based on search direction
     */
    const getNeighbors = (id) => {
        return direction === 'forward'
            ? graph.getOutgoingEdges(id)
            : graph.getIncomingEdges(id);
    };
    /**
     * Recursive DFS to find all paths
     */
    function dfs(currentId) {
        // Early exit if we found enough paths
        if (allPaths.length >= maxPaths) {
            return;
        }
        // Mark as visited and add to current path
        visited.add(currentId);
        currentPath.push(currentId);
        // Check if we found the target
        if (currentId === endId) {
            allPaths.push([...currentPath]);
        }
        else {
            // Continue searching neighbors
            for (const neighbor of getNeighbors(currentId)) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                }
            }
        }
        // Backtrack
        currentPath.pop();
        visited.delete(currentId);
    }
    dfs(startId);
    return allPaths;
}
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
export function findShortestPath(graph, startId, endId, direction = 'forward') {
    // Validate both nodes exist
    if (!graph.hasNode(startId)) {
        throw new TaskNotFoundError(startId);
    }
    if (!graph.hasNode(endId)) {
        throw new TaskNotFoundError(endId);
    }
    if (startId === endId) {
        return [startId];
    }
    const visited = new Set([startId]);
    const queue = [
        { nodeId: startId, path: [startId] },
    ];
    /**
     * Get neighbors based on search direction
     */
    const getNeighbors = (id) => {
        return direction === 'forward'
            ? graph.getOutgoingEdges(id)
            : graph.getIncomingEdges(id);
    };
    while (queue.length > 0) {
        const { nodeId, path } = queue.shift();
        for (const neighbor of getNeighbors(nodeId)) {
            if (neighbor === endId) {
                return [...path, neighbor];
            }
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ nodeId: neighbor, path: [...path, neighbor] });
            }
        }
    }
    return null; // No path found
}
/**
 * Check if two nodes are connected (path exists)
 *
 * @param graph - Task graph store
 * @param fromId - Source task ID
 * @param toId - Target task ID
 * @param direction - Search direction: 'forward' or 'backward'
 * @returns true if a path exists between the nodes
 */
export function areConnected(graph, fromId, toId, direction = 'forward') {
    try {
        const path = findShortestPath(graph, fromId, toId, direction);
        return path !== null;
    }
    catch {
        return false;
    }
}
/**
 * Get distance (number of edges) between two nodes
 *
 * @param graph - Task graph store
 * @param fromId - Source task ID
 * @param toId - Target task ID
 * @param direction - Search direction: 'forward' or 'backward'
 * @returns Number of edges in shortest path, or -1 if no path exists
 */
export function getDistance(graph, fromId, toId, direction = 'forward') {
    const path = findShortestPath(graph, fromId, toId, direction);
    return path ? path.length - 1 : -1;
}
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
export function getConnectedComponents(graph) {
    const visited = new Set();
    const components = [];
    /**
     * Get all neighbors (both incoming and outgoing) for undirected traversal
     */
    const getAllNeighbors = (id) => {
        const outgoing = graph.getOutgoingEdges(id);
        const incoming = graph.getIncomingEdges(id);
        return [...new Set([...outgoing, ...incoming])];
    };
    for (const taskId of graph.getAllTaskIds()) {
        if (!visited.has(taskId)) {
            // Start a new component
            const component = [];
            const queue = [taskId];
            while (queue.length > 0) {
                const nodeId = queue.shift();
                if (visited.has(nodeId)) {
                    continue;
                }
                visited.add(nodeId);
                component.push(nodeId);
                for (const neighbor of getAllNeighbors(nodeId)) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
            components.push(component);
        }
    }
    return components;
}
//# sourceMappingURL=traversal.js.map