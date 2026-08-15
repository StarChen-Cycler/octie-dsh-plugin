/**
 * Projects Routes - Global project registry endpoints
 *
 * Provides endpoints for listing and managing registered Octie projects.
 *
 * @module web/routes/projects
 */
import { getAllProjects, verifyProjectExists, loadRegistry, saveRegistry, getProjectTaskCounts, registerMissingSubprojects, getProjectLastUpdated, } from '../../core/registry/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/route-helpers.js';
/**
 * Register project routes
 * @param router - Express Router instance
 */
export function registerProjectsRoutes(router) {
    /**
     * GET /api/projects
     * List all registered projects with existence status
     */
    router.get('/api/projects', asyncHandler(async (_req, res) => {
        // Auto-register any valid subprojects that exist on disk but are missing
        // from the global registry. This keeps the sidebar tree in sync with the
        // actual project structure under .octie/subprojects/.
        let initialProjects = getAllProjects();
        for (const project of initialProjects) {
            registerMissingSubprojects(project.path);
        }
        // Re-fetch so newly registered subprojects are included.
        const projects = getAllProjects();
        // Add existence status and task counts to each project
        const projectsWithStatus = projects.map(project => {
            const counts = getProjectTaskCounts(project.path);
            return {
                ...project,
                exists: verifyProjectExists(project),
                statusCounts: counts?.statusCounts ?? {
                    ready: 0,
                    in_progress: 0,
                    in_review: 0,
                    completed: 0,
                    blocked: 0,
                },
                priorityCounts: counts?.priorityCounts ?? {
                    top: 0,
                    second: 0,
                    later: 0,
                },
                // Activity signal: latest task-graph write, falling back to registry
                // lastAccessed for entries whose files are no longer on disk.
                lastUpdated: getProjectLastUpdated(project.path) ?? project.lastAccessed ?? '',
            };
        });
        // Rank by latest task update so active plans surface first; name is the
        // deterministic tiebreaker.
        projectsWithStatus.sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || '') ||
            a.name.localeCompare(b.name));
        return sendSuccess(res, {
            projects: projectsWithStatus,
            count: projectsWithStatus.length,
        });
    }));
    /**
     * DELETE /api/projects/:path
     * Remove a project from the registry (by encoded path)
     */
    router.delete('/api/projects/*', asyncHandler(async (req, res) => {
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
    router.get('/api/registry/path', asyncHandler(async (_req, res) => {
        const { getGlobalRegistryPath } = await import('../../core/registry/index.js');
        const registryPath = getGlobalRegistryPath();
        return sendSuccess(res, {
            path: registryPath,
        });
    }));
}
//# sourceMappingURL=projects.js.map