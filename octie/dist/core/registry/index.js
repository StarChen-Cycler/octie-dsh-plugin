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
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, } from 'node:fs';
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
export function getProjectLastUpdated(projectPath) {
    try {
        const mtimeMs = statSync(join(projectPath, '.octie', 'project.json')).mtimeMs;
        return new Date(mtimeMs).toISOString();
    }
    catch {
        return null;
    }
}
/** Current registry version */
const REGISTRY_VERSION = '1.0.0';
const REGISTRY_LOCK_FILE = 'projects.lock';
const REGISTRY_LOCK_STALE_MS = 10000;
const REGISTRY_LOCK_TIMEOUT_MS = 2000;
const REGISTRY_LOCK_RETRY_MS = 25;
/**
 * Get the path to the global registry file
 * @returns Absolute path to ~/.octie/projects.json
 */
export function getGlobalRegistryPath() {
    const home = homedir();
    const octieDir = join(home, '.octie');
    return join(octieDir, 'projects.json');
}
function getRegistryDirPath() {
    return join(homedir(), '.octie');
}
function getRegistryLockPath() {
    return join(getRegistryDirPath(), REGISTRY_LOCK_FILE);
}
/**
 * Ensure the ~/.octie directory exists
 */
function ensureRegistryDir() {
    const octieDir = join(homedir(), '.octie');
    if (!existsSync(octieDir)) {
        mkdirSync(octieDir, { recursive: true });
    }
}
export function pruneStaleProjects(registry = loadRegistry()) {
    const removed = [];
    for (const [key, entry] of Object.entries(registry.projects)) {
        if (!existsSync(entry.path)) {
            removed.push({ key, name: entry.name, path: entry.path });
            delete registry.projects[key];
        }
    }
    if (removed.length > 0) {
        saveRegistry(registry);
    }
    return { removed, kept: Object.keys(registry.projects).length };
}
/**
 * Load the global project registry
 * Creates an empty registry if one doesn't exist
 * @returns Project registry object
 */
export function loadRegistry() {
    return loadRegistryInternal();
}
function loadRegistryInternal(options = {}) {
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
        const registry = JSON.parse(content);
        // Ensure version compatibility — preserve existing projects data
        // even when the structure is unexpected (never silently discard data)
        if (!registry.version || !registry.projects) {
            const salvaged = {
                version: REGISTRY_VERSION,
                projects: {},
            };
            // Salvage: if the parsed object has a 'projects' field (even without version),
            // preserve those entries instead of returning an empty registry
            if (registry.projects && typeof registry.projects === 'object') {
                salvaged.projects = registry.projects;
            }
            else if (!registry.version && !registry.projects) {
                // Check if the parsed object itself looks like a projects map
                // (old format without the version/projects wrapper)
                const maybeProjects = registry;
                const hasPathEntries = Object.values(maybeProjects).some((v) => v && typeof v === 'object' && v.path);
                if (hasPathEntries) {
                    salvaged.projects = maybeProjects;
                }
            }
            return salvaged;
        }
        return registry;
    }
    catch (error) {
        if (options.throwOnCorruption) {
            throw error instanceof Error
                ? error
                : new Error('Failed to parse global Octie registry');
        }
        // Corrupted or unreadable file — return empty only when the file is truly
        // unparseable (this is the last resort; we already salvaged above)
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
export function saveRegistry(registry) {
    ensureRegistryDir();
    const registryPath = getGlobalRegistryPath();
    // Safety guard: never overwrite a non-empty registry with an empty one.
    // This prevents data loss when loadRegistryInternal() returned an empty
    // registry due to corruption/unexpected structure and the empty result
    // is being saved back. If the on-disk registry has projects and the new
    // one has none, refuse to save.
    if (Object.keys(registry.projects).length === 0 && existsSync(registryPath)) {
        try {
            const existingContent = readFileSync(registryPath, 'utf-8');
            const existing = JSON.parse(existingContent);
            if (existing.projects && Object.keys(existing.projects).length > 0) {
                // Existing registry has data but we're about to save empty — refuse
                return;
            }
        }
        catch {
            // Can't read existing file — proceed with save (file may be corrupted)
        }
    }
    const tempPath = `${registryPath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tempPath, JSON.stringify(registry, null, 2), 'utf-8');
    renameSync(tempPath, registryPath);
    // Clean up stale .tmp files older than 1 hour
    try {
        const files = readdirSync(getRegistryDirPath());
        const now = Date.now();
        for (const file of files) {
            if (file.endsWith('.tmp')) {
                const tmpPath = join(getRegistryDirPath(), file);
                try {
                    const stats = statSync(tmpPath);
                    if (now - stats.mtimeMs > 3600000) {
                        unlinkSync(tmpPath);
                    }
                }
                catch {
                    // Ignore cleanup errors
                }
            }
        }
    }
    catch {
        // Ignore directory read errors
    }
}
function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function withRegistryLock(fn) {
    ensureRegistryDir();
    const lockPath = getRegistryLockPath();
    const startedAt = Date.now();
    while (true) {
        try {
            const fd = openSync(lockPath, 'wx');
            try {
                return fn();
            }
            finally {
                closeSync(fd);
                if (existsSync(lockPath)) {
                    unlinkSync(lockPath);
                }
            }
        }
        catch (error) {
            const err = error;
            if (err.code !== 'EEXIST') {
                throw err;
            }
            try {
                const lockStats = statSync(lockPath);
                if (Date.now() - lockStats.mtimeMs > REGISTRY_LOCK_STALE_MS) {
                    unlinkSync(lockPath);
                    continue;
                }
            }
            catch {
                continue;
            }
            if (Date.now() - startedAt >= REGISTRY_LOCK_TIMEOUT_MS) {
                throw new Error('Timed out waiting for Octie registry lock');
            }
            sleepSync(REGISTRY_LOCK_RETRY_MS);
        }
    }
}
/**
 * Find the registry key for a project path
 * @param registry - Registry to search
 * @param projectPath - Project path to match
 * @returns Registry key or null if not found
 */
function findProjectKeyByPath(registry, projectPath) {
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
function getAvailableProjectKey(registry, projectName) {
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
export function isValidOctieProject(projectPath) {
    const projectFile = join(projectPath, '.octie', 'project.json');
    if (!existsSync(projectFile)) {
        return false;
    }
    try {
        const content = readFileSync(projectFile, 'utf-8');
        const data = JSON.parse(content);
        // Check for required fields
        return !!(data.metadata && data.tasks);
    }
    catch {
        return false;
    }
}
/**
 * Get project metadata from a project path
 * @param projectPath - Path to the project
 * @returns Project metadata or null if invalid
 */
export function getProjectMetadata(projectPath) {
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
        return data.metadata;
    }
    catch {
        return null;
    }
}
/**
 * Get task count from a project
 * @param projectPath - Path to the project
 * @returns Number of tasks or 0 if invalid
 */
export function getProjectTaskCount(projectPath) {
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
    }
    catch {
        return 0;
    }
}
/**
 * Aggregate task counts by status and priority from a project.
 * @param projectPath - Path to the project
 * @returns Object with statusCounts, priorityCounts, and total, or null if invalid
 */
export function getProjectTaskCounts(projectPath) {
    const projectFile = join(projectPath, '.octie', 'project.json');
    if (!existsSync(projectFile)) {
        return null;
    }
    try {
        const content = readFileSync(projectFile, 'utf-8');
        const data = JSON.parse(content);
        if (!data.tasks || typeof data.tasks !== 'object') {
            return null;
        }
        const statusCounts = {
            ready: 0,
            in_progress: 0,
            in_review: 0,
            completed: 0,
            blocked: 0,
        };
        const priorityCounts = {
            top: 0,
            second: 0,
            later: 0,
        };
        let total = 0;
        for (const task of Object.values(data.tasks)) {
            if (!task || typeof task !== 'object')
                continue;
            total += 1;
            const { status, priority } = task;
            if (typeof status === 'string' && status in statusCounts) {
                statusCounts[status] = (statusCounts[status] ?? 0) + 1;
            }
            if (typeof priority === 'string' && priority in priorityCounts) {
                priorityCounts[priority] = (priorityCounts[priority] ?? 0) + 1;
            }
        }
        return { statusCounts, priorityCounts, total };
    }
    catch {
        return null;
    }
}
/**
 * Discover immediate subprojects under a parent project's .octie/subprojects/.
 * @param projectPath - Path to the parent project
 * @returns Array of subproject name/path pairs for valid Octie projects
 */
export function discoverSubprojects(projectPath) {
    const subprojectsDir = join(projectPath, '.octie', 'subprojects');
    if (!existsSync(subprojectsDir)) {
        return [];
    }
    const result = [];
    for (const entry of readdirSync(subprojectsDir)) {
        const entryPath = join(subprojectsDir, entry);
        try {
            if (!statSync(entryPath).isDirectory()) {
                continue;
            }
        }
        catch {
            continue;
        }
        if (isValidOctieProject(entryPath)) {
            result.push({ name: entry, path: entryPath });
        }
    }
    return result;
}
/**
 * Register valid subprojects that exist on disk but are missing from the registry.
 * @param projectPath - Path to the parent project
 * @returns Number of newly registered subprojects
 */
export function registerMissingSubprojects(projectPath) {
    const subprojects = discoverSubprojects(projectPath);
    if (subprojects.length === 0) {
        return 0;
    }
    try {
        return withRegistryLock(() => {
            const registry = loadRegistryInternal({ throwOnCorruption: true });
            let registeredCount = 0;
            const now = new Date().toISOString();
            for (const { name, path: subprojectPath } of subprojects) {
                // Skip already-registered subprojects to avoid churn.
                const existingKey = findProjectKeyByPath(registry, subprojectPath);
                if (existingKey) {
                    continue;
                }
                const metadata = getProjectMetadata(subprojectPath);
                if (!metadata) {
                    continue;
                }
                const projectName = metadata.project_name || name;
                const entry = {
                    path: subprojectPath,
                    name: projectName,
                    registeredAt: now,
                    lastAccessed: now,
                    taskCount: getProjectTaskCount(subprojectPath),
                };
                const key = getAvailableProjectKey(registry, projectName);
                registry.projects[key] = entry;
                registeredCount += 1;
            }
            if (registeredCount > 0) {
                saveRegistry(registry);
            }
            return registeredCount;
        });
    }
    catch {
        return 0;
    }
}
/**
 * Register or update a project in the registry
 * @param projectPath - Path to the project to register
 * @returns The registered project entry or null if invalid
 */
export function registerProject(projectPath) {
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
    try {
        return withRegistryLock(() => {
            const registry = loadRegistryInternal({ throwOnCorruption: true });
            const existingKey = findProjectKeyByPath(registry, projectPath);
            const entry = {
                path: projectPath,
                name: projectName,
                registeredAt: existingKey ? registry.projects[existingKey].registeredAt : now,
                lastAccessed: now,
                taskCount,
            };
            // Preserve path-based registrations and never overwrite a different project
            // just because it shares the same metadata name.
            const key = existingKey ?? getAvailableProjectKey(registry, projectName);
            registry.projects[key] = entry;
            saveRegistry(registry);
            return entry;
        });
    }
    catch {
        return null;
    }
}
/**
 * Unregister a project from the registry
 * @param projectPath - Path to the project to remove
 * @returns True if project was removed
 */
export function unregisterProject(projectPath) {
    return unregisterProjectDetailed(projectPath).removed;
}
export function unregisterProjectDetailed(projectPath) {
    try {
        return withRegistryLock(() => {
            const registry = loadRegistryInternal({ throwOnCorruption: true });
            for (const [key, project] of Object.entries(registry.projects)) {
                if (project.path === projectPath) {
                    delete registry.projects[key];
                    saveRegistry(registry);
                    return { removed: true };
                }
            }
            return { removed: false };
        });
    }
    catch (error) {
        return {
            removed: false,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}
function pruneMissingProjectsInRegistry(registry) {
    let changed = false;
    for (const [key, project] of Object.entries(registry.projects)) {
        if (!isValidOctieProject(project.path)) {
            delete registry.projects[key];
            changed = true;
        }
    }
    return changed;
}
/**
 * Get all registered projects
 * Prunes stale entries whose local .octie/project.json no longer exists.
 * This keeps the web UI sidebar and home page aligned with disk state.
 * @returns Array of registered projects after stale-entry cleanup
 */
export function getAllProjects() {
    try {
        return withRegistryLock(() => {
            const registry = loadRegistryInternal({ throwOnCorruption: true });
            const changed = pruneMissingProjectsInRegistry(registry);
            if (changed) {
                saveRegistry(registry);
            }
            return Object.values(registry.projects);
        });
    }
    catch {
        return Object.values(loadRegistry());
    }
}
/**
 * Get all registered projects WITHOUT auto-cleanup (for debugging)
 * @returns Array of all registry projects including stale ones
 */
export function getAllProjectsRaw() {
    const registry = loadRegistry();
    return Object.values(registry.projects);
}
/**
 * Check if a registered project still exists on disk
 * @param project - Project entry to check
 * @returns True if project still exists and is valid
 */
export function verifyProjectExists(project) {
    return isValidOctieProject(project.path);
}
/**
 * Update last accessed timestamp for a project
 * @param projectPath - Path to the project
 */
export function touchProject(projectPath) {
    try {
        withRegistryLock(() => {
            const registry = loadRegistryInternal({ throwOnCorruption: true });
            for (const project of Object.values(registry.projects)) {
                if (project.path === projectPath) {
                    project.lastAccessed = new Date().toISOString();
                    project.taskCount = getProjectTaskCount(projectPath);
                    saveRegistry(registry);
                    return;
                }
            }
        });
    }
    catch {
        // Preserve existing registry file on mutation errors.
    }
}
//# sourceMappingURL=index.js.map