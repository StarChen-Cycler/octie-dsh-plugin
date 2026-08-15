/**
 * Global Project Registry
 *
 * Manages a registry of all Octie projects on the system.
 * Registry is stored at ~/.octie/projects.json
 *
 * @module core/registry
 */
import type { ProjectMetadata } from '../../types/index.js';
/**
 * Project entry in the global registry
 */
export interface RegistryProject {
    /** Filesystem path to the project */
    path: string;
    /** Project name from metadata */
    name: string;
    /** ISO 8601 timestamp when project was registered */
    registeredAt: string;
    /** ISO 8601 timestamp when project was last accessed */
    lastAccessed: string;
    /** Number of tasks in the project */
    taskCount: number;
}
/**
 * Global registry structure
 */
export interface ProjectRegistry {
    /** Registry version */
    version: string;
    /** Map of project name to project entry */
    projects: Record<string, RegistryProject>;
}
export interface UnregisterProjectResult {
    removed: boolean;
    error?: Error;
}
/**
 * The canonical project activity signal: the mtime of the project's task
 * graph file. Every task mutation (create/update/approve/wire/merge/delete/
 * restore) rewrites `.octie/project.json` through the atomic save path, so
 * its mtime IS "the latest task updating time" — unlike registry
 * lastAccessed, which only moves on CLI registration/touches and misses
 * task edits entirely.
 *
 * @returns ISO timestamp of the last graph write, or null when the project
 *          file cannot be read (e.g. the path no longer exists on disk).
 */
export declare function getProjectLastUpdated(projectPath: string): string | null;
/**
 * Get the path to the global registry file
 * @returns Absolute path to ~/.octie/projects.json
 */
export declare function getGlobalRegistryPath(): string;
/**
 * Prune stale registry entries whose project paths no longer exist.
 *
 * The global registry can accumulate entries from deleted projects,
 * renamed folders, and tooling that registers temp projects. This removes
 * entries whose path is gone and persists the change only when something
 * was removed.
 *
 * @param registry - Optional registry to prune (defaults to loading the live one)
 * @returns Summary of removed entries and the resulting size
 */
export interface PruneRegistryResult {
    removed: Array<{
        key: string;
        name: string;
        path: string;
    }>;
    kept: number;
}
export declare function pruneStaleProjects(registry?: ProjectRegistry): PruneRegistryResult;
/**
 * Load the global project registry
 * Creates an empty registry if one doesn't exist
 * @returns Project registry object
 */
export declare function loadRegistry(): ProjectRegistry;
/**
 * Save the global project registry
 * @param registry - Registry to save
 */
export declare function saveRegistry(registry: ProjectRegistry): void;
/**
 * Check if a path contains a valid Octie project
 * @param projectPath - Path to check
 * @returns True if .octie/project.json exists and is valid
 */
export declare function isValidOctieProject(projectPath: string): boolean;
/**
 * Get project metadata from a project path
 * @param projectPath - Path to the project
 * @returns Project metadata or null if invalid
 */
export declare function getProjectMetadata(projectPath: string): ProjectMetadata | null;
/**
 * Get task count from a project
 * @param projectPath - Path to the project
 * @returns Number of tasks or 0 if invalid
 */
export declare function getProjectTaskCount(projectPath: string): number;
/**
 * Aggregate task counts by status and priority from a project.
 * @param projectPath - Path to the project
 * @returns Object with statusCounts, priorityCounts, and total, or null if invalid
 */
export declare function getProjectTaskCounts(projectPath: string): {
    statusCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
    total: number;
} | null;
/**
 * Discover immediate subprojects under a parent project's .octie/subprojects/.
 * @param projectPath - Path to the parent project
 * @returns Array of subproject name/path pairs for valid Octie projects
 */
export declare function discoverSubprojects(projectPath: string): Array<{
    name: string;
    path: string;
}>;
/**
 * Register valid subprojects that exist on disk but are missing from the registry.
 * @param projectPath - Path to the parent project
 * @returns Number of newly registered subprojects
 */
export declare function registerMissingSubprojects(projectPath: string): number;
/**
 * Register or update a project in the registry
 * @param projectPath - Path to the project to register
 * @returns The registered project entry or null if invalid
 */
export declare function registerProject(projectPath: string): RegistryProject | null;
/**
 * Unregister a project from the registry
 * @param projectPath - Path to the project to remove
 * @returns True if project was removed
 */
export declare function unregisterProject(projectPath: string): boolean;
export declare function unregisterProjectDetailed(projectPath: string): UnregisterProjectResult;
/**
 * Get all registered projects
 * Prunes stale entries whose local .octie/project.json no longer exists.
 * This keeps the web UI sidebar and home page aligned with disk state.
 * @returns Array of registered projects after stale-entry cleanup
 */
export declare function getAllProjects(): RegistryProject[];
/**
 * Get all registered projects WITHOUT auto-cleanup (for debugging)
 * @returns Array of all registry projects including stale ones
 */
export declare function getAllProjectsRaw(): RegistryProject[];
/**
 * Check if a registered project still exists on disk
 * @param project - Project entry to check
 * @returns True if project still exists and is valid
 */
export declare function verifyProjectExists(project: RegistryProject): boolean;
/**
 * Update last accessed timestamp for a project
 * @param projectPath - Path to the project
 */
export declare function touchProject(projectPath: string): void;
//# sourceMappingURL=index.d.ts.map