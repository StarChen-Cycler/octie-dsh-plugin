/**
 * Service engine: the shared business rules behind init / create / handoff.
 *
 * These functions were extracted from `src/cli/commands/shared-helpers.ts`
 * (which now re-exports them) so the DSH bundle, the CLI, and the Web layer
 * all run one engine. No console output, no process.exit — failures throw.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { loadRegistry, registerProject, touchProject } from '../core/registry/index.js';
import { TaskNode } from '../core/models/task-node.js';
import { TaskStorage } from '../core/storage/file-store.js';
const DEFAULT_OCTIE_SERVER_URL = 'http://localhost:3456';
const DEFAULT_CACHE_INVALIDATION_TIMEOUT_MS = 250;
const LAST_SERVER_URL_FILE = join(homedir(), '.octie', '.last-server-url');
export class CliPreparationError extends Error {
    infoMessages;
    constructor(message, infoMessages = []) {
        super(message);
        this.name = 'CliPreparationError';
        this.infoMessages = infoMessages;
    }
}
function parseList(value) {
    if (!value)
        return [];
    return value.split(',').map(item => item.trim()).filter(Boolean);
}
async function saveGraph(projectPath, graph) {
    const storage = new TaskStorage({ projectDir: projectPath });
    await storage.save(graph);
}
export function normalizeGitBashPath(input) {
    const gitBashPrefix = /^[A-Za-z]:\/(\/)?Program Files\/Git\//;
    if (!gitBashPrefix.test(input))
        return input;
    const match = input.match(/Program Files\/Git\/(.*)$/);
    return match ? `/${match[1]}` : input;
}
function parseC7Verifications(entries) {
    return entries.map((entry) => {
        const cleanEntry = normalizeGitBashPath(entry);
        const colonIndex = cleanEntry.indexOf(':');
        if (colonIndex === -1) {
            return { library_id: cleanEntry.trim(), verified_at: new Date().toISOString() };
        }
        return {
            library_id: cleanEntry.substring(0, colonIndex).trim(),
            verified_at: new Date().toISOString(),
            notes: cleanEntry.substring(colonIndex + 1).trim(),
        };
    });
}
function readNotesText(options) {
    let notes = [];
    if (options.notesFile) {
        const notesPath = resolve(options.notesFile);
        if (!existsSync(notesPath)) {
            throw new CliPreparationError(`Notes file not found: ${notesPath}`);
        }
        try {
            const fileContent = readFileSync(notesPath, 'utf-8').trim();
            if (fileContent)
                notes.push(fileContent);
        }
        catch (err) {
            throw new CliPreparationError(`Failed to read notes file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
    if (options.notes && Array.isArray(options.notes)) {
        notes = notes.concat(options.notes.map(note => note.trim()).filter(Boolean));
    }
    return notes.join('\n\n');
}
function normalizePriority(priority) {
    const validPriorities = ['top', 'second', 'later'];
    const normalized = priority?.toLowerCase() || 'second';
    if (!validPriorities.includes(normalized)) {
        throw new CliPreparationError(`Invalid priority "${priority}". Must be one of: ${validPriorities.join(', ')}`);
    }
    return normalized;
}
export async function preflightProjectInit(projectPath, options) {
    const projectName = options.name?.trim();
    if (!projectName) {
        throw new CliPreparationError('Project name is required. Use --name <name> to specify a unique project name.', ['Example: octie init --name my-project']);
    }
    const registry = loadRegistry();
    const existing = Object.values(registry.projects).find(project => project.name === projectName);
    if (existing) {
        throw new CliPreparationError(`Project with name '${projectName}' already exists.`, [`Existing project: ${existing.path}`, 'Choose a different name using --name <different-name>']);
    }
    const storage = new TaskStorage({ projectDir: projectPath });
    if (await storage.exists()) {
        throw new CliPreparationError('Octie project already exists at this location', [
            'Use --project <path> to specify a different location',
        ]);
    }
    return { projectName, projectPath, storage, registry };
}
export async function executeProjectInit(request) {
    await request.storage.createProject(request.projectName);
    registerProject(request.projectPath);
}
export function preflightTaskCreation(graph, options) {
    const successCriteria = options.successCriterion || [];
    const deliverables = options.deliverable || [];
    if (!options.title || options.title.trim().length === 0) {
        throw new CliPreparationError('Title is required and cannot be empty');
    }
    if (!options.description || options.description.trim().length === 0) {
        throw new CliPreparationError('Description is required and cannot be empty');
    }
    if (successCriteria.length === 0) {
        throw new CliPreparationError('At least one success criterion is required (--success-criterion)');
    }
    if (deliverables.length === 0) {
        throw new CliPreparationError('At least one deliverable is required (--deliverable)');
    }
    const blockers = parseList(options.blockers || '');
    const dependenciesText = (options.dependencyExplanation || options.dependencies || '').trim();
    if (blockers.length > 0 && !dependenciesText) {
        throw new CliPreparationError('When --blockers is provided, --dependency-explanation text is also required.', ['The twin feature requires both blockers (task IDs) and dependency explanation text.']);
    }
    if (dependenciesText && blockers.length === 0) {
        throw new CliPreparationError('When --dependency-explanation is provided, --blockers task IDs are also required.', ['The twin feature requires both blockers (task IDs) and dependency explanation text.']);
    }
    const priority = normalizePriority(options.priority);
    const notesText = readNotesText(options);
    const task = new TaskNode({
        id: graph.generateUniqueId(),
        title: options.title.trim(),
        description: options.description.trim(),
        priority,
        success_criteria: successCriteria.map(text => ({ id: uuidv4(), text: text.trim(), completed: false })),
        deliverables: deliverables.map(text => ({ id: uuidv4(), text: text.trim(), completed: false })),
        blockers,
        dependencies: dependenciesText,
        related_files: options.relatedFiles || [],
        notes: notesText,
        c7_verified: parseC7Verifications(options.c7Verified || []),
        sub_items: [],
        edges: [],
    });
    const resolvedBlockers = [];
    const invalidBlockers = [];
    for (const blockerId of task.blockers) {
        const resolvedTask = graph.getNodeByIdOrPrefix(blockerId);
        if (resolvedTask)
            resolvedBlockers.push(resolvedTask.id);
        else
            invalidBlockers.push(blockerId);
    }
    if (invalidBlockers.length > 0) {
        throw new CliPreparationError(`Blocker task IDs not found: ${invalidBlockers.join(', ')}`);
    }
    task.blockers = resolvedBlockers;
    return { task };
}
export async function invalidateProjectCache(projectPath) {
    // Skip the probe entirely when no server has ever run for this user:
    // no env override and no server-url file means nothing can be caching,
    // and probing localhost:3456 costs latency in every scripted command.
    const envServerUrl = process.env.OCTIE_SERVER_URL;
    const lastServerUrl = readLastServerUrl();
    if (!envServerUrl && !lastServerUrl)
        return;
    const serverUrl = envServerUrl || lastServerUrl || DEFAULT_OCTIE_SERVER_URL;
    const rawTimeoutMs = Number(process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS);
    const timeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0
        ? rawTimeoutMs
        : DEFAULT_CACHE_INVALIDATION_TIMEOUT_MS;
    try {
        const response = await fetch(`${serverUrl}/api/cache/invalidate?project=${encodeURIComponent(projectPath)}`, { method: 'POST', signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) {
            console.warn(`Cache invalidation skipped: ${response.status} ${response.statusText || 'response error'}`);
        }
    }
    catch (error) {
        const isTimeoutError = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        if (isTimeoutError || serverUrl !== DEFAULT_OCTIE_SERVER_URL) {
            const detail = isTimeoutError
                ? `timed out after ${timeoutMs}ms`
                : error instanceof Error ? error.message : String(error);
            console.warn(`Cache invalidation skipped: ${detail}`);
        }
    }
}
function readLastServerUrl() {
    try {
        if (existsSync(LAST_SERVER_URL_FILE)) {
            return readFileSync(LAST_SERVER_URL_FILE, 'utf-8').trim() || null;
        }
    }
    catch { /* best-effort */ }
    return null;
}
export async function executeTaskCreation(projectPath, graph, prepared) {
    graph.addNode(prepared.task);
    for (const blockerId of prepared.task.blockers) {
        graph.addEdge(blockerId, prepared.task.id);
    }
    graph.propagateStatus(prepared.task.id);
    // Test-only failure injection: lets handoff rollback tests force a parent-save
    // failure deterministically on every platform. File-permission tricks (chmod
    // 0o444) only block writes on Windows — POSIX rename ignores the target
    // file's mode bits — so CI on Linux cannot rely on them.
    if (process.env.OCTIE_TEST_FORCE_TASK_SAVE_FAILURE === '1') {
        throw new Error('Injected task save failure');
    }
    await saveGraph(projectPath, graph);
    touchProject(projectPath);
    await invalidateProjectCache(projectPath);
    return prepared.task;
}
/** Convert a service CreateTaskInput into the CLI-compatible option bag. */
export function toCreateOptions(input) {
    return {
        title: input.title,
        description: input.description,
        successCriterion: input.successCriteria,
        deliverable: input.deliverables,
        priority: input.priority,
        blockers: input.blockers?.join(','),
        dependencyExplanation: input.dependencyExplanation,
        relatedFiles: input.relatedFiles,
        c7Verified: input.c7Verified,
        notes: input.notes ? [input.notes] : undefined,
    };
}
/** Initialize a project at an explicit path (engine entry used by the service layer). */
export async function initProjectAt(projectPath, name) {
    const validated = await preflightProjectInit(projectPath, { name });
    await executeProjectInit(validated);
    return { path: projectPath, name: validated.projectName };
}
//# sourceMappingURL=engine.js.map