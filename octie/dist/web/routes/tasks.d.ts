/**
 * Task Routes - RESTful CRUD endpoints for task management
 *
 * Provides complete CRUD operations for tasks via REST API.
 * All endpoints use Zod validation and proper HTTP status codes.
 *
 * @module web/routes/tasks
 */
import type { Router } from 'express';
import type { TaskGraphStore } from '../../core/graph/index.js';
/**
 * Register task routes
 * @param router - Express Router instance
 * @param getGraph - Function to get the current graph instance
 */
export declare function registerTaskRoutes(router: Router, getGraph: () => TaskGraphStore | null, saveGraph?: (graph: TaskGraphStore) => Promise<void>, broadcastRefresh?: () => void): {
    clearCache: (projectPath?: string) => void;
};
//# sourceMappingURL=tasks.d.ts.map