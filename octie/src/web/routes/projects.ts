/**
 * Projects Routes - Global project registry endpoints
 *
 * Provides endpoints for listing and managing registered Octie projects.
 *
 * @module web/routes/projects
 */

import type { Request, Response, Router } from 'express';
import {
  getAllProjects,
  verifyProjectExists,
  loadRegistry,
  saveRegistry,
  type RegistryProject,
} from '../../core/registry/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/route-helpers.js';

/**
 * Extended project info with existence check
 */
interface ProjectWithStatus extends RegistryProject {
  exists: boolean;
}

/**
 * Register project routes
 * @param router - Express Router instance
 */
export function registerProjectsRoutes(router: Router): void {
  /**
   * GET /api/projects
   * List all registered projects with existence status
   */
  router.get('/api/projects', asyncHandler(async (_req: Request, res: Response) => {
    const projects = getAllProjects();

    // Add existence status to each project
    const projectsWithStatus: ProjectWithStatus[] = projects.map(project => ({
      ...project,
      exists: verifyProjectExists(project),
    }));

    return sendSuccess(res, {
      projects: projectsWithStatus,
      count: projectsWithStatus.length,
    });
  }));

  /**
   * DELETE /api/projects/:path
   * Remove a project from the registry (by encoded path)
   */
  router.delete('/api/projects/*', asyncHandler(async (req: Request, res: Response) => {
    // Decode the path from URL
    const encodedPath = req.params[0] ?? '';
    const projectPath = decodeURIComponent(encodedPath);

    const registry = loadRegistry();
    let found = false;

    for (const [key, project] of Object.entries(registry.projects)) {
      if (project.path === projectPath) {
        delete registry.projects[key];
        found = true;
        break;
      }
    }

    if (!found) {
      return sendError(res, 'PROJECT_NOT_FOUND', 'Project not found in registry', 404);
    }

    saveRegistry(registry);

    return sendSuccess(res, {
      removed: true,
      path: projectPath,
    });
  }));

  /**
   * GET /api/registry/path
   * Get the global registry file path
   */
  router.get('/api/registry/path', asyncHandler(async (_req: Request, res: Response) => {
    const { getGlobalRegistryPath } = await import('../../core/registry/index.js');
    const registryPath = getGlobalRegistryPath();

    return sendSuccess(res, {
      path: registryPath,
    });
  }));
}
