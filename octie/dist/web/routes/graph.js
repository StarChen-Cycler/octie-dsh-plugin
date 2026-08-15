/**
 * Graph Routes - Graph analysis and validation endpoints
 *
 * Provides endpoints for graph structure analysis, topological sorting,
 * cycle detection, critical path analysis, and project statistics.
 *
 * @module web/routes/graph
 */
import { topologicalSort, findCriticalPath, isValidDAG } from '../../core/graph/sort.js';
import { detectCycle, hasCycle, getCycleStatistics } from '../../core/graph/cycle.js';
import { TaskStorage } from '../../core/storage/file-store.js';
import { asyncHandler, sendSuccess, sendError, getProjectPath } from '../utils/route-helpers.js';
/**
 * Register graph routes
 * @param router - Express Router instance
 * @param getGraph - Function to get the current graph instance
 */
export function registerGraphRoutes(router, getGraph) {
    // Cache for loaded project graphs
    const graphCache = new Map();
    /**
     * Clear graph cache for a project
     */
    function clearCache(projectPath) {
        if (projectPath) {
            graphCache.delete(projectPath);
        }
        else {
            graphCache.clear();
        }
    }
    /**
     * Get graph for a specific project path
     * Default project (no ?project=) uses server's _graph.
     * Other projects load fresh from disk every time — no caching so that
     * CLI modifications from any project are immediately visible.
     */
    async function getProjectGraph(projectPath) {
        if (!projectPath) {
            return getGraph();
        }
        // Always load fresh from file for explicit project paths
        try {
            const storage = new TaskStorage({ projectDir: projectPath });
            return await storage.load();
        }
        catch {
            return null;
        }
    }
    /**
     * GET /api/graph
     * Get full graph structure including all tasks and edges
     */
    router.get('/api/graph', asyncHandler(async (req, res) => {
        const projectPath = getProjectPath(req);
        const graph = await getProjectGraph(projectPath);
        if (!graph) {
            return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
        }
        // Serialize graph to JSON format
        // Edges are guaranteed valid — removeNode cleans up both directions
        const graphData = graph.toJSON();
        return sendSuccess(res, {
            metadata: graphData.metadata,
            nodes: Object.values(graphData.nodes),
            outgoingEdges: graphData.outgoingEdges,
            incomingEdges: graphData.incomingEdges,
        });
    }));
    /**
     * GET /api/graph/topology
     * Get topological order of tasks
     */
    router.get('/api/graph/topology', asyncHandler(async (req, res) => {
        const projectPath = getProjectPath(req);
        const graph = await getProjectGraph(projectPath);
        if (!graph) {
            return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
        }
        const result = topologicalSort(graph);
        if (result.hasCycle) {
            return sendSuccess(res, {
                hasCycle: true,
                cycleNodes: result.cycleNodes,
                message: 'Graph contains cycles, topological sort is not valid for cyclic graphs',
            });
        }
        return sendSuccess(res, {
            hasCycle: false,
            sorted: result.sorted,
            taskCount: result.sorted.length,
        });
    }));
    /**
     * POST /api/graph/validate
     * Validate graph structure and check for cycles
     */
    router.post('/api/graph/validate', asyncHandler(async (req, res) => {
        const projectPath = getProjectPath(req);
        const graph = await getProjectGraph(projectPath);
        if (!graph) {
            return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
        }
        // Check if graph is valid (acyclic)
        const isValid = isValidDAG(graph);
        // Get cycle statistics if graph has cycles
        let cycleStats = null;
        if (!isValid) {
            cycleStats = getCycleStatistics(graph);
        }
        return sendSuccess(res, {
            isValid,
            hasCycle: !isValid,
            cycleStats,
            message: isValid
                ? 'Graph structure is valid (acyclic)'
                : 'Graph contains cycles and is not a valid DAG',
        });
    }));
    /**
     * GET /api/graph/cycles
     * Detect and return all cycles in the graph
     */
    router.get('/api/graph/cycles', asyncHandler(async (req, res) => {
        const projectPath = getProjectPath(req);
        const graph = await getProjectGraph(projectPath);
        if (!graph) {
            return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
        }
        const result = detectCycle(graph);
        if (!result.hasCycle) {
            return sendSuccess(res, {
                hasCycle: false,
                cycles: [],
                message: 'No cycles detected in graph',
            });
        }
        return sendSuccess(res, {
            hasCycle: true,
            cycles: result.cycles,
            cycleCount: result.cycles.length,
            message: `Found ${result.cycles.length} cycle(s) in graph`,
        });
    }));
    /**
     * GET /api/graph/critical-path
     * Get the critical path (longest path) through the graph
     */
    router.get('/api/graph/critical-path', asyncHandler(async (req, res) => {
        const projectPath = getProjectPath(req);
        const graph = await getProjectGraph(projectPath);
        if (!graph) {
            return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
        }
        // First check if graph has cycles
        if (hasCycle(graph)) {
            return sendError(res, 'GRAPH_HAS_CYCLE', 'Cannot calculate critical path for cyclic graph', 400);
        }
        const result = findCriticalPath(graph);
        return sendSuccess(res, {
            path: result.path,
            duration: result.duration,
            taskCount: result.path.length,
        });
    }));
    /**
     * GET /api/stats
     * Get project statistics
     */
    router.get('/api/stats', asyncHandler(async (req, res) => {
        const projectPath = getProjectPath(req);
        const graph = await getProjectGraph(projectPath);
        if (!graph) {
            return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
        }
        // Get basic graph stats
        const totalTasks = graph.size;
        const rootTasks = graph.getRootTasks();
        const orphanTasks = graph.getOrphanTasks();
        // Calculate status and priority counts by iterating through tasks
        const statusCounts = new Map();
        statusCounts.set('ready', 0);
        statusCounts.set('in_progress', 0);
        statusCounts.set('in_review', 0);
        statusCounts.set('completed', 0);
        statusCounts.set('blocked', 0);
        const priorityCounts = new Map();
        priorityCounts.set('top', 0);
        priorityCounts.set('second', 0);
        priorityCounts.set('later', 0);
        for (const task of graph.getAllTasks()) {
            const currentStatus = statusCounts.get(task.status) ?? 0;
            statusCounts.set(task.status, currentStatus + 1);
            const currentPriority = priorityCounts.get(task.priority) ?? 0;
            priorityCounts.set(task.priority, currentPriority + 1);
        }
        // Convert Maps to plain objects for JSON response
        const statusCountsObj = {};
        statusCounts.forEach((value, key) => { statusCountsObj[key] = value; });
        const priorityCountsObj = {};
        priorityCounts.forEach((value, key) => { priorityCountsObj[key] = value; });
        // Build response
        const stats = {
            project: {
                name: graph.metadata.project_name,
                version: graph.metadata.version,
                created: graph.metadata.created_at,
                updated: graph.metadata.updated_at,
            },
            tasks: {
                total: totalTasks,
                root: rootTasks.length,
                orphan: orphanTasks.length,
                rootTaskIds: rootTasks,
                orphanTaskIds: orphanTasks,
                statusCounts: statusCountsObj,
                priorityCounts: priorityCountsObj,
            },
        };
        return sendSuccess(res, stats);
    }));
    return { clearCache };
}
//# sourceMappingURL=graph.js.map