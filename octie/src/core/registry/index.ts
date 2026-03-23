/**
 * Global Project Registry
 *
 * Manages a registry of all Octie projects on the system.
 * Registry is stored at ~/.octie/projects.json
 *
 * @module core/registry
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Current registry version */
const REGISTRY_VERSION = '1.0.0';

/**
 * Get the path to the global registry file
 * @returns Absolute path to ~/.octie/projects.json
 */
export function getGlobalRegistryPath(): string {
  const home = homedir();
  const octieDir = join(home, '.octie');
  return join(octieDir, 'projects.json');
}

/**
 * Ensure the ~/.octie directory exists
 */
function ensureRegistryDir(): void {
  const octieDir = join(homedir(), '.octie');
  if (!existsSync(octieDir)) {
    mkdirSync(octieDir, { recursive: true });
  }
}

/**
 * Load the global project registry
 * Creates an empty registry if one doesn't exist
 * @returns Project registry object
 */
export function loadRegistry(): ProjectRegistry {
  const registryPath = getGlobalRegistryPath();

  if (!existsSync(registryPath)) {
    // Return empty registry
    return {
      version: REGISTRY_VERSION,
      projects: {},
    };
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(content) as ProjectRegistry;

    // Ensure version compatibility
    if (!registry.version || !registry.projects) {
      // Invalid registry, return empty
      return {
        version: REGISTRY_VERSION,
        projects: {},
      };
    }

    return registry;
  } catch {
    // Corrupted registry, return empty
    return {
      version: REGISTRY_VERSION,
      projects: {},
    };
  }
}

/**
 * Save the global project registry
 * @param registry - Registry to save
 */
export function saveRegistry(registry: ProjectRegistry): void {
  ensureRegistryDir();
  const registryPath = getGlobalRegistryPath();
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Find the registry key for a project path
 * @param registry - Registry to search
 * @param projectPath - Project path to match
 * @returns Registry key or null if not found
 */
function findProjectKeyByPath(
  registry: ProjectRegistry,
  projectPath: string
): string | null {
  for (const [key, project] of Object.entries(registry.projects)) {
    if (project.path === projectPath) {
      return key;
    }
  }

  return null;
}

/**
 * Generate a unique registry key for a project name.
 * Keeps the plain project name when available and falls back to
 * deterministic numbered suffixes for legacy/manual duplicate names.
 *
 * @param registry - Registry to search
 * @param projectName - Preferred project name
 * @returns Unique registry key
 */
function getAvailableProjectKey(
  registry: ProjectRegistry,
  projectName: string
): string {
  if (!registry.projects[projectName]) {
    return projectName;
  }

  let suffix = 2;
  let candidate = `${projectName}#${suffix}`;
  while (registry.projects[candidate]) {
    suffix += 1;
    candidate = `${projectName}#${suffix}`;
  }

  return candidate;
}

/**
 * Check if a path contains a valid Octie project
 * @param projectPath - Path to check
 * @returns True if .octie/project.json exists and is valid
 */
export function isValidOctieProject(projectPath: string): boolean {
  const projectFile = join(projectPath, '.octie', 'project.json');
  if (!existsSync(projectFile)) {
    return false;
  }

  try {
    const content = readFileSync(projectFile, 'utf-8');
    const data = JSON.parse(content);

    // Check for required fields
    return !!(data.metadata && data.tasks);
  } catch {
    return false;
  }
}

/**
 * Get project metadata from a project path
 * @param projectPath - Path to the project
 * @returns Project metadata or null if invalid
 */
export function getProjectMetadata(projectPath: string): ProjectMetadata | null {
  const projectFile = join(projectPath, '.octie', 'project.json');

  if (!existsSync(projectFile)) {
    return null;
  }

  try {
    const content = readFileSync(projectFile, 'utf-8');
    const data = JSON.parse(content);

    if (!data.metadata) {
      return null;
    }

    return data.metadata as ProjectMetadata;
  } catch {
    return null;
  }
}

/**
 * Get task count from a project
 * @param projectPath - Path to the project
 * @returns Number of tasks or 0 if invalid
 */
export function getProjectTaskCount(projectPath: string): number {
  const projectFile = join(projectPath, '.octie', 'project.json');

  if (!existsSync(projectFile)) {
    return 0;
  }

  try {
    const content = readFileSync(projectFile, 'utf-8');
    const data = JSON.parse(content);

    if (!data.tasks || typeof data.tasks !== 'object') {
      return 0;
    }

    return Object.keys(data.tasks).length;
  } catch {
    return 0;
  }
}

/**
 * Register or update a project in the registry
 * @param projectPath - Path to the project to register
 * @returns The registered project entry or null if invalid
 */
export function registerProject(projectPath: string): RegistryProject | null {
  if (!isValidOctieProject(projectPath)) {
    return null;
  }

  const metadata = getProjectMetadata(projectPath);
  if (!metadata) {
    return null;
  }

  const projectName = metadata.project_name || 'unnamed';
  const taskCount = getProjectTaskCount(projectPath);
  const now = new Date().toISOString();

  const registry = loadRegistry();
  const existingKey = findProjectKeyByPath(registry, projectPath);

  const entry: RegistryProject = {
    path: projectPath,
    name: projectName,
    registeredAt: existingKey ? registry.projects[existingKey]!.registeredAt : now,
    lastAccessed: now,
    taskCount,
  };

  // Preserve path-based registrations and never overwrite a different project
  // just because it shares the same metadata name.
  const key = existingKey ?? getAvailableProjectKey(registry, projectName);
  registry.projects[key] = entry;

  saveRegistry(registry);

  return entry;
}

/**
 * Unregister a project from the registry
 * @param projectPath - Path to the project to remove
 * @returns True if project was removed
 */
export function unregisterProject(projectPath: string): boolean {
  const registry = loadRegistry();

  for (const [key, project] of Object.entries(registry.projects)) {
    if (project.path === projectPath) {
      delete registry.projects[key];
      saveRegistry(registry);
      return true;
    }
  }

  return false;
}

/**
 * Get all registered projects
 * Read-only access: missing projects stay in the registry so the UI can
 * surface them with a warning instead of silently deleting user state.
 * @returns Array of registered projects, including stale ones
 */
export function getAllProjects(): RegistryProject[] {
  const registry = loadRegistry();
  return Object.values(registry.projects);
}

/**
 * Get all registered projects WITHOUT auto-cleanup (for debugging)
 * @returns Array of all registry projects including stale ones
 */
export function getAllProjectsRaw(): RegistryProject[] {
  const registry = loadRegistry();
  return Object.values(registry.projects);
}

/**
 * Check if a registered project still exists on disk
 * @param project - Project entry to check
 * @returns True if project still exists and is valid
 */
export function verifyProjectExists(project: RegistryProject): boolean {
  return isValidOctieProject(project.path);
}

/**
 * Update last accessed timestamp for a project
 * @param projectPath - Path to the project
 */
export function touchProject(projectPath: string): void {
  const registry = loadRegistry();

  for (const project of Object.values(registry.projects)) {
    if (project.path === projectPath) {
      project.lastAccessed = new Date().toISOString();
      project.taskCount = getProjectTaskCount(projectPath);
      saveRegistry(registry);
      return;
    }
  }
}
