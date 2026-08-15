/**
 * Graph Routes - Graph analysis and validation endpoints
 *
 * Provides endpoints for graph structure analysis, topological sorting,
 * cycle detection, critical path analysis, and project statistics.
 *
 * @module web/routes/graph
 */
import type { Router } from 'express';
import type { TaskGraphStore } from '../../core/graph/index.js';
/**
 * Register graph routes
 * @param router - Express Router instance
 * @param getGraph - Function to get the current graph instance
 */
export declare function registerGraphRoutes(router: Router, getGraph: () => TaskGraphStore | null): {
    clearCache: (projectPath?: string) => void;
};
//# sourceMappingURL=graph.d.ts.map