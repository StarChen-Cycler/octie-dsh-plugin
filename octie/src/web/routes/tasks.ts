/**
 * Task Routes - RESTful CRUD endpoints for task management
 *
 * Provides complete CRUD operations for tasks via REST API.
 * All endpoints use Zod validation and proper HTTP status codes.
 *
 * @module web/routes/tasks
 */

import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { TaskNotFoundError, CircularDependencyError, ValidationError, AtomicTaskViolationError, AmbiguousIdError, ERROR_SUGGESTIONS } from '../../types/index.js';
import { TaskNode } from '../../core/models/task-node.js';
import { TaskStorage } from '../../core/storage/file-store.js';
import { v4 as uuidv4 } from 'uuid';
import type { ApiResponse } from '../server.js';

/**
 * Zod schema for task creation validation
 */
const TaskCreateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .refine(val => val.trim().length > 0, 'Title cannot be empty or whitespace'),
  description: z.string()
    .min(50, 'Description must be at least 50 characters')
    .max(10000, 'Description must be 10000 characters or less')
    .refine(val => val.trim().length > 0, 'Description cannot be empty or whitespace'),
  successCriteria: z.array(z.object({
    id: z.string().uuid().optional(),
    text: z.string().min(1, 'Criterion text cannot be empty'),
    completed: z.boolean().default(false),
  })).min(1, 'At least one success criterion is required')
    .max(10, 'Cannot have more than 10 success criteria'),
  deliverables: z.array(z.object({
    id: z.string().uuid().optional(),
    text: z.string().min(1, 'Deliverable text cannot be empty'),
    completed: z.boolean().default(false),
    file_path: z.string().optional(),
  })).min(1, 'At least one deliverable is required')
    .max(10, 'Cannot have more than 10 deliverables'),
  priority: z.enum(['top', 'second', 'later']).optional().default('second'),
  // Status is now derived from task state, but we allow it for backward compatibility
  status: z.enum(['ready', 'in_progress', 'in_review', 'completed', 'blocked']).optional(),
  blockers: z.array(z.string().uuid()).default([]),
  dependencies: z.string().default(''), // Explanatory text (twin to blockers)
  relatedFiles: z.array(z.string()).default([]),
  notes: z.string().default(''),
  c7Verified: z.array(z.object({
    library_id: z.string(),
    verified_at: z.string(),
    notes: z.string().optional(),
  })).default([]),
});

/**
 * Zod schema for task update validation (partial updates)
 */
const TaskUpdateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  description: z.string()
    .min(50, 'Description must be at least 50 characters')
    .max(10000, 'Description must be 10000 characters or less')
    .optional(),
  status: z.enum(['ready', 'in_progress', 'in_review', 'completed', 'blocked']).optional(),
  priority: z.enum(['top', 'second', 'later']).optional(),
  addSuccessCriterion: z.string().optional(),
  completeCriterion: z.string().uuid().optional(),
  addDeliverable: z.string().optional(),
  completeDeliverable: z.string().uuid().optional(),
  block: z.string().uuid().optional(),
  unblock: z.string().uuid().optional(),
  dependencyExplanation: z.string().optional(), // Set/update dependencies text
  notes: z.string().optional(),
});

/**
 * Zod schema for task merge validation
 */
const TaskMergeSchema = z.object({
  targetId: z.string().uuid('Target ID must be a valid UUID'),
});

/**
 * Zod schema for query parameter validation
 */
const TaskQuerySchema = z.object({
  status: z.enum(['ready', 'in_progress', 'in_review', 'completed', 'blocked']).optional(),
  priority: z.enum(['top', 'second', 'later']).optional(),
  search: z.string().optional(),
  limit: z.string().transform(val => val ? parseInt(val, 10) : undefined).pipe(
    z.number().int().positive().max(1000).optional()
  ).optional(),
  offset: z.string().transform(val => val ? parseInt(val, 10) : undefined).pipe(
    z.number().int().nonnegative().optional()
  ).optional(),
});

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
 * Register task routes
 * @param router - Express Router instance
 * @param getGraph - Function to get the current graph instance
 */
export function registerTaskRoutes(
  router: Router,
  getGraph: () => TaskGraphStore | null
): { clearCache: (projectPath?: string) => void } {
  // Cache for loaded project graphs
  const graphCache = new Map<string, TaskGraphStore>();

  /**
   * Clear graph cache for a project (or all if no path)
   */
  function clearCache(projectPath?: string): void {
    if (projectPath) {
      graphCache.delete(projectPath);
    } else {
      graphCache.clear();
    }
  }

  /**
   * Get graph for a specific project path — uses in-memory cache
   * Cache is invalidated via clearCache() called by fs.watch or CLI HTTP request
   */
  async function getProjectGraph(projectPath: string | undefined): Promise<TaskGraphStore | null> {
    if (!projectPath) {
      return getGraph();
    }

    // Check cache first
    const cached = graphCache.get(projectPath);
    if (cached) {
      return cached;
    }

    // Cache miss — load from disk
    try {
      const storage = new TaskStorage({ projectDir: projectPath });
      const graph = await storage.load();
      graphCache.set(projectPath, graph);
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
   * GET /api/tasks
   * List all tasks with optional filtering
   */
  router.get('/api/tasks', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    // Validate query parameters
    const queryResult = TaskQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return sendError(res, 'INVALID_QUERY', 'Invalid query parameters', 400, queryResult.error.issues);
    }

    const { status, priority, search, limit, offset } = queryResult.data;

    // Get all tasks
    let tasks = Array.from(graph.getAllTasks());

    // Apply filters
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }
    if (priority) {
      tasks = tasks.filter(task => task.priority === priority);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.notes.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const total = tasks.length;
    if (offset) {
      tasks = tasks.slice(offset);
    }
    if (limit) {
      tasks = tasks.slice(0, limit);
    }

    return sendSuccess(res, {
      tasks,
      total,
      returned: tasks.length,
      limit,
      offset,
    });
  }));

  /**
   * GET /api/tasks/:id
   * Get a specific task by ID
   */
  router.get('/api/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'INVALID_ID', 'Task ID is required', 400);
    }

    try {
      const task = graph.getNodeByIdOrPrefix(id);
      if (!task) {
        return sendError(res, 'TASK_NOT_FOUND', `Task with ID '${id}' not found`, 404);
      }
      return sendSuccess(res, task);
    } catch (err) {
      if (err instanceof AmbiguousIdError) {
        return sendError(res, 'AMBIGUOUS_ID', err.message, 400);
      }
      if (err instanceof TaskNotFoundError) {
        return sendError(res, 'TASK_NOT_FOUND', err.message, 404);
      }
      throw err;
    }
  }));

  /**
   * POST /api/tasks
   * Create a new task
   */
  router.post('/api/tasks', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    // Validate request body
    const bodyResult = TaskCreateSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid request body', 400, bodyResult.error.issues);
    }

    const data = bodyResult.data;

    try {
      // Generate UUID for new task with collision detection
      const taskId = graph.generateUniqueId();

      // Create success criteria with IDs
      const successCriteria = data.successCriteria.map(sc => ({
        id: sc.id || uuidv4(),
        text: sc.text,
        completed: sc.completed,
      }));

      // Create deliverables with IDs
      const deliverables = data.deliverables.map(d => ({
        id: d.id || uuidv4(),
        text: d.text,
        completed: d.completed,
        file_path: d.file_path,
      }));

      // Twin validation: blockers and dependencies must be provided together
      if (data.blockers.length > 0 && !data.dependencies) {
        return sendError(res, 'TWIN_VALIDATION_ERROR',
          'When blockers are provided, dependencies explanation text is also required', 400);
      }
      if (data.dependencies && data.blockers.length === 0) {
        return sendError(res, 'TWIN_VALIDATION_ERROR',
          'When dependencies explanation is provided, blockers are also required', 400);
      }

      // Validate blockers exist
      for (const blockerId of data.blockers) {
        if (!graph.hasNode(blockerId)) {
          return sendError(res, 'BLOCKER_NOT_FOUND', `Blocker task '${blockerId}' not found`, 400);
        }
      }

      // Create TaskNode instance (includes atomic validation)
      const taskNode = new TaskNode({
        id: taskId,
        title: data.title,
        description: data.description,
        success_criteria: successCriteria,
        deliverables: deliverables,
        priority: data.priority,
        status: data.status,
        blockers: data.blockers,
        dependencies: data.dependencies,
        related_files: data.relatedFiles,
        notes: data.notes,
        c7_verified: data.c7Verified,
      });

      // Add to graph
      graph.addNode(taskNode);

      // Add edges for blockers
      for (const blockerId of data.blockers) {
        graph.addEdge(blockerId, taskId);
      }

      // Return created task
      return sendSuccess(res, graph.getNodeOrThrow(taskId), 201);
    } catch (err) {
      if (err instanceof AtomicTaskViolationError) {
        return sendError(res, 'ATOMIC_TASK_VIOLATION', err.message, 400);
      }
      if (err instanceof ValidationError) {
        return sendError(res, 'VALIDATION_ERROR', err.message, 400);
      }
      if (err instanceof CircularDependencyError) {
        return sendError(res, 'CIRCULAR_DEPENDENCY', err.message, 400);
      }
      throw err;
    }
  }));

  /**
   * PUT /api/tasks/:id
   * Update an existing task
   */
  router.put('/api/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'INVALID_ID', 'Task ID is required', 400);
    }

    // Validate request body
    const bodyResult = TaskUpdateSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid request body', 400, bodyResult.error.issues);
    }

    const data = bodyResult.data;

    try {
      // Support short UUID prefix lookup
      const task = graph.getNodeByIdOrPrefix(id);
      if (!task) {
        return sendError(res, 'TASK_NOT_FOUND', `Task with ID '${id}' not found`, 404);
      }

      // Use the full ID for all operations
      const fullId = task.id;

      // Apply updates
      if (data.title !== undefined) {
        task.setTitle(data.title);
      }
      if (data.description !== undefined) {
        task.setDescription(data.description);
      }
      if (data.status !== undefined) {
        task.setStatus(data.status);
      }
      if (data.priority !== undefined) {
        task.setPriority(data.priority);
      }
      if (data.addSuccessCriterion !== undefined) {
        task.addSuccessCriterion({
          id: uuidv4(),
          text: data.addSuccessCriterion,
          completed: false,
        });
      }
      if (data.completeCriterion !== undefined) {
        task.completeCriterion(data.completeCriterion);
      }
      if (data.addDeliverable !== undefined) {
        task.addDeliverable({
          id: uuidv4(),
          text: data.addDeliverable,
          completed: false,
        });
      }
      if (data.completeDeliverable !== undefined) {
        task.completeDeliverable(data.completeDeliverable);
      }
      if (data.block !== undefined) {
        if (!graph.hasNode(data.block)) {
          return sendError(res, 'BLOCKER_NOT_FOUND', `Blocker task '${data.block}' not found`, 400);
        }
        // Twin validation: block requires dependencyExplanation
        if (!data.dependencyExplanation) {
          return sendError(res, 'TWIN_VALIDATION_ERROR',
            'When adding a blocker, dependencyExplanation is required', 400);
        }
        task.addBlocker(data.block);
        graph.addEdge(data.block, fullId);
        // Update dependencies explanation
        const existingDeps = task.dependencies || '';
        task.setDependencies(existingDeps ? `${existingDeps}\n${data.dependencyExplanation}` : data.dependencyExplanation);
      }
      if (data.unblock !== undefined) {
        task.removeBlocker(data.unblock);
        graph.removeEdge(data.unblock, fullId);
        // Auto-clear dependencies if last blocker removed
        if (task.blockers.length === 0) {
          task.clearDependencies();
        }
      }
      // Update dependencies explanation (standalone)
      if (data.dependencyExplanation !== undefined && data.block === undefined) {
        if (task.blockers.length === 0) {
          return sendError(res, 'TWIN_VALIDATION_ERROR',
            'Cannot set dependencies explanation without blockers', 400);
        }
        task.setDependencies(data.dependencyExplanation);
      }
      if (data.notes !== undefined) {
        task.appendNotes(data.notes);
      }

      // Update node in graph
      graph.updateNode(task);

      // Return updated task
      return sendSuccess(res, task);
    } catch (err) {
      if (err instanceof AmbiguousIdError) {
        return sendError(res, 'AMBIGUOUS_ID', err.message, 400);
      }
      if (err instanceof TaskNotFoundError) {
        return sendError(res, 'TASK_NOT_FOUND', err.message, 404);
      }
      if (err instanceof ValidationError) {
        return sendError(res, 'VALIDATION_ERROR', err.message, 400);
      }
      if (err instanceof CircularDependencyError) {
        return sendError(res, 'CIRCULAR_DEPENDENCY', err.message, 400);
      }
      throw err;
    }
  }));

  /**
   * DELETE /api/tasks/:id
   * Delete a task
   */
  router.delete('/api/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'INVALID_ID', 'Task ID is required', 400);
    }
    const reconnect = req.query.reconnect === 'true';

    try {
      // Support short UUID prefix lookup
      const task = graph.getNodeByIdOrPrefix(id);
      if (!task) {
        return sendError(res, 'TASK_NOT_FOUND', `Task with ID '${id}' not found`, 404);
      }

      // Use the full ID for all operations
      const fullId = task.id;

      // Get affected tasks
      const incoming = graph.getIncomingEdges(fullId);
      const outgoing = graph.getOutgoingEdges(fullId);

      // Remove the task
      let affectedTaskIds: string[] = [];
      if (reconnect) {
        const { cutNode } = await import('../../core/graph/operations.js');
        affectedTaskIds = cutNode(graph, fullId);
        for (const affectedId of affectedTaskIds) {
          graph.propagateStatus(affectedId);
        }
      } else {
        graph.removeNode(fullId);
      }

      // Return success with deleted task info
      return sendSuccess(res, {
        deletedTask: task,
        reconnected: reconnect,
        incomingBeforeDelete: incoming,
        outgoingBeforeDelete: outgoing,
        updatedTasks: affectedTaskIds,
      });
    } catch (err) {
      if (err instanceof AmbiguousIdError) {
        return sendError(res, 'AMBIGUOUS_ID', err.message, 400);
      }
      if (err instanceof TaskNotFoundError) {
        return sendError(res, 'TASK_NOT_FOUND', err.message, 404);
      }
      throw err;
    }
  }));

  /**
   * POST /api/tasks/:id/merge
   * Merge this task into another task
   */
  router.post('/api/tasks/:id/merge', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    const graph = await getProjectGraph(projectPath);
    if (!graph) {
      return sendError(res, 'GRAPH_NOT_LOADED', projectPath ? `Project not found: ${projectPath}` : 'Graph not loaded', 500);
    }

    const { id } = req.params;
    if (!id) {
      return sendError(res, 'INVALID_ID', 'Task ID is required', 400);
    }

    // Validate request body
    const bodyResult = TaskMergeSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid request body', 400, bodyResult.error.issues);
    }

    const { targetId } = bodyResult.data;

    try {
      // Import mergeTasks from operations module
      const { mergeTasks } = await import('../../core/graph/operations.js');

      // Perform merge
      const mergedTask = mergeTasks(graph, id, targetId);

      // Return merged task
      return sendSuccess(res, mergedTask);
    } catch (err) {
      if (err instanceof TaskNotFoundError) {
        return sendError(res, 'TASK_NOT_FOUND', err.message, 404);
      }
      if (err instanceof CircularDependencyError) {
        return sendError(res, 'CIRCULAR_DEPENDENCY', err.message, 400);
      }
      if (err instanceof Error) {
        return sendError(res, 'MERGE_ERROR', err.message, 400);
      }
      throw err;
    }
  }));

  /**
   * POST /api/cache/invalidate
   * Invalidate graph cache for a project (called by CLI)
   */
  router.post('/api/cache/invalidate', asyncHandler(async (req: Request, res: Response) => {
    const projectPath = getProjectPath(req);
    clearCache(projectPath);
    return sendSuccess(res, { invalidated: true, projectPath: projectPath || null });
  }));

  return { clearCache };
}
