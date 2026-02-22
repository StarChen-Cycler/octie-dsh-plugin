/**
 * Graph Routes - Graph analysis and validation endpoints
 *
 * Provides endpoints for graph structure analysis, topological sorting,
 * cycle detection, critical path analysis, and project statistics.
 *
 * @module web/routes/graph
 */

import type { Request, Response, Router } from 'express';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { topologicalSort, findCriticalPath, isValidDAG } from '../../core/graph/sort.js';
import { detectCycle, hasCycle, getCycleStatistics } from '../../core/graph/cycle.js';
import { TaskStorage } from '../../core/storage/file-store.js';
import { ERROR_SUGGESTIONS } from '../../types/index.js';
import type { ApiResponse } from '../server.js';

/**
 * Async error handler wrapper
 * Catches async errors and passes them to Express error handling
 */
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: Error) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/**
 * Send successful API response
 */
function sendSuccess<T>(res: Response, data: T, status: number = 200): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<T>);
}

/**
 * Send error API response
 */
function sendError(
  res: Response,
  code: string,
  message: string,
  status: number = 400,
  details?: unknown,
  suggestion?: string
): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      suggestion: suggestion ?? ERROR_SUGGESTIONS[code],
      details,
    },
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse);
}

/**
 * Register graph routes
 * @param router - Express Router instance
 * @param getGraph - Function to get the current graph instance
 */
export function registerGraphRoutes(
  router: Router,
  getGraph: () => TaskGraphStore | null
): void {
  // Cache for loaded project graphs
  const graphCache = new Map<string, TaskGraphStore>();

  /**
   * Clear graph cache for a project
   */
  function clearCache(projectPath?: string): void {
    console.log('[CACHE] graph.ts clearCache called, projectPath:', projectPath);
    if (projectPath) {
      const deleted = graphCache.delete(projectPath);
      console.log('[CACHE] Deleted from graph cache:', deleted, 'Remaining:', graphCache.size);
    } else {
      graphCache.clear();
      console.log('[CACHE] Cleared all graph cache');
    }
    // Also clear tasks.ts cache if available
    const globalClear = (globalThis as unknown as { __octieClearGraphCache?: (path?: string) => void }).__octieClearGraphCache;
    if (globalClear) {
      globalClear(projectPath);
    }
  }

  // Export for use by CLI
  (globalThis as unknown as { __octieClearGraphCache: typeof clearCache }).__octieClearGraphCache = clearCache;

  /**
   * Get graph for a specific project path - always load fresh from file
   * Disabled caching to ensure fresh data after CLI modifications
   */
  async function getProjectGraph(projectPath: string | undefined): Promise<TaskGraphStore | null> {
    if (!projectPath) {
      return getGraph();
    }

    // Always load fresh from file - no caching
    try {
      const storage = new TaskStorage({ projectDir: projectPath });
      const graph = await storage.load();
      return graph;
    } catch {
      return null;
    }
  }

  /**
   * Extract project path from query params
   */
  function getProjectPath(req: Request): string | undefined {
    const project = req.query.project;
    return typeof project === 'string' ? project : undefined;
  }

  /**
   * GET /api/graph
   * Get full graph structure including all tasks and edges
   */
  router.get('/api/graph', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    // Serialize graph to JSON format
    const graphData = graph.toJSON();

    // Convert nodes from object (keyed by ID) to array for frontend
    const nodesArray = Object.values(graphData.nodes);

    // Get valid node IDs
    const validNodeIds = new Set(nodesArray.map(n => n.id));

    // Filter edges to only include valid node references
    const filterEdges = (edges: Record<string, string[]>): Record<string, string[]> => {
      const filtered: Record<string, string[]> = {};
      for (const [sourceId, targetIds] of Object.entries(edges)) {
        // Skip if source is invalid
        if (!sourceId || sourceId === 'null' || sourceId === 'undefined' || !validNodeIds.has(sourceId)) {
          continue;
        }
        // Filter targets to only valid nodes
        const validTargets = (targetIds || []).filter(
          targetId => targetId && targetId !== 'null' && targetId !== 'undefined' && validNodeIds.has(targetId)
        );
        if (validTargets.length > 0) {
          filtered[sourceId] = validTargets;
        }
      }
      return filtered;
    };

    return sendSuccess(res, {
      metadata: graphData.metadata,
      nodes: nodesArray,
      outgoingEdges: filterEdges(graphData.outgoingEdges),
      incomingEdges: filterEdges(graphData.incomingEdges),
    });
  }));

  /**
   * GET /api/graph/topology
   * Get topological order of tasks
   */
  router.get('/api/graph/topology', asyncHandler(async (req: Request, res: Response) => {
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
  router.post('/api/graph/validate', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    // Check if graph is valid (acyclic)
    const isValid = isValidDAG(graph);

    // Get cycle statistics if graph has cycles
    let cycleStats: ReturnType<typeof getCycleStatistics> | null = null;
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
  router.get('/api/graph/cycles', asyncHandler(async (req: Request, res: Response) => {
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
  router.get('/api/graph/critical-path', asyncHandler(async (req: Request, res: Response) => {
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
  router.get('/api/stats', asyncHandler(async (req: Request, res: Response) => {
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
    const statusCounts = new Map<string, number>();
    statusCounts.set('ready', 0);
    statusCounts.set('in_progress', 0);
    statusCounts.set('in_review', 0);
    statusCounts.set('completed', 0);
    statusCounts.set('blocked', 0);

    const priorityCounts = new Map<string, number>();
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
    const statusCountsObj: Record<string, number> = {};
    statusCounts.forEach((value, key) => { statusCountsObj[key] = value; });

    const priorityCountsObj: Record<string, number> = {};
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
}
