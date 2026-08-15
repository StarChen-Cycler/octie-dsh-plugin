/**
 * Service: task queries and mutations.
 * All functions: load graph → operate → persist → return JSON projections.
 * Failures throw Errors (CliPreparationError carries info tips); no console
 * output, no process.exit. Messages mirror the CLI surface so the CLI can
 * rewire onto this layer with byte-identical output.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TaskStorage, findProjectPath } from '../core/storage/file-store.js';
import { wouldCreateCycle } from '../core/graph/algorithms.js';
import { CliPreparationError, toCreateOptions, executeTaskCreation, preflightTaskCreation, invalidateProjectCache, normalizeGitBashPath, } from './engine.js';
import { toTaskSummary, toTaskProjection } from './projections.js';
export async function openProject(path) {
    const projectPath = path ? path : (await findProjectPath()) ?? '';
    if (!projectPath) {
        throw new Error('No Octie project found. Run `octie init` first or pass an explicit path.');
    }
    const storage = new TaskStorage({ projectDir: projectPath });
    if (!(await storage.exists())) {
        throw new Error(`No Octie project found at ${projectPath}`);
    }
    return { path: projectPath, name: projectPath.split(/[\\/]/).pop() ?? projectPath };
}
export async function createTask(projectPath, input) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const prepared = preflightTaskCreation(graph, toCreateOptions(input));
    const task = await executeTaskCreation(projectPath, graph, prepared);
    return toTaskProjection(task);
}
export async function listTasks(projectPath, filter = {}) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    let tasks = graph.getAllTasks();
    if (filter.status)
        tasks = tasks.filter(t => t.status === filter.status);
    if (filter.priority)
        tasks = tasks.filter(t => t.priority === filter.priority);
    return tasks.map(toTaskSummary);
}
/** Like listTasks but returns full projections for CLI rendering. */
export async function listTasksFull(projectPath, filter = {}) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    let tasks = graph.getAllTasks();
    if (filter.status)
        tasks = tasks.filter(t => t.status === filter.status);
    if (filter.priority)
        tasks = tasks.filter(t => t.priority === filter.priority);
    return tasks.map(toTaskProjection);
}
export async function getTask(projectPath, id) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const task = graph.getNodeByIdOrPrefix(id);
    return task ? toTaskProjection(task) : null;
}
function matchesTitle(task, pattern) {
    return task.title.toLowerCase().includes(pattern.toLowerCase());
}
function matchesSearch(task, query) {
    const q = query.toLowerCase();
    if (task.title.toLowerCase().includes(q))
        return true;
    if (task.description.toLowerCase().includes(q))
        return true;
    if (task.notes.toLowerCase().includes(q))
        return true;
    if (task.success_criteria.some(sc => sc.text.toLowerCase().includes(q)))
        return true;
    if (task.deliverables.some(d => d.text.toLowerCase().includes(q)))
        return true;
    return false;
}
function matchesFile(task, filePath) {
    return task.related_files.some(f => f.toLowerCase().includes(filePath.toLowerCase()));
}
export async function findTasks(projectPath, filter = {}) {
    return findTasksInternal(projectPath, filter, false);
}
/** Like findTasks but returns full projections for CLI rendering. */
export async function findTasksFull(projectPath, filter = {}) {
    return findTasksInternal(projectPath, filter, true);
}
async function findTasksInternal(projectPath, filter, full) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    let tasks = graph.getAllTasks();
    let constrained = null;
    const intersect = (ids) => {
        const next = new Set(ids);
        constrained = constrained === null ? next : new Set([...constrained].filter(id => next.has(id)));
    };
    if (filter.orphans)
        intersect(graph.getOrphanTasks());
    if (filter.leaves)
        intersect(graph.getLeafTasks());
    if (filter.withoutBlockers)
        intersect(tasks.filter(t => t.blockers.length === 0).map(t => t.id));
    if (constrained !== null)
        tasks = tasks.filter(t => constrained.has(t.id));
    if (filter.title)
        tasks = tasks.filter(t => matchesTitle(t, filter.title));
    if (filter.search)
        tasks = tasks.filter(t => matchesSearch(t, filter.search));
    if (filter.hasFile)
        tasks = tasks.filter(t => matchesFile(t, filter.hasFile));
    if (filter.verified) {
        const lib = normalizeGitBashPath(filter.verified).toLowerCase();
        tasks = tasks.filter(t => t.c7_verified.some(v => v.library_id.toLowerCase().includes(lib)));
    }
    if (filter.status)
        tasks = tasks.filter(t => t.status === filter.status);
    if (filter.priority)
        tasks = tasks.filter(t => t.priority === filter.priority);
    return tasks.map(full ? toTaskProjection : toTaskSummary);
}
function resolveWithin(items, idOrPrefix, label, ambiguousLabel) {
    const exact = items.find(i => i.id === idOrPrefix);
    if (exact)
        return exact.id;
    const prefix = idOrPrefix.toLowerCase();
    const matches = items.filter(i => i.id.toLowerCase().startsWith(prefix));
    if (matches.length === 0)
        throw new Error(`${label} with ID '${idOrPrefix}' not found.`);
    if (matches.length > 1) {
        throw new Error(`Ambiguous ${ambiguousLabel} ID '${idOrPrefix}'. Matches: ${matches.map(m => m.id.substring(0, 8)).join(', ')}`);
    }
    return matches[0].id;
}
function readNotesFile(notesFile) {
    const notesPath = resolve(notesFile);
    if (!existsSync(notesPath))
        throw new Error(`Notes file not found: ${notesPath}`);
    try {
        return readFileSync(notesPath, 'utf-8').trim();
    }
    catch (err) {
        throw new Error(`Failed to read notes file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
}
function parseC7(entry) {
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
}
/**
 * Full update port of the CLI `octie update` action, returning the
 * projection plus propagation count and success-path info lines so the
 * CLI can reproduce its output exactly.
 */
export async function updateTaskWithPropagation(projectPath, id, patch) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const task = graph.getNodeByIdOrPrefix(id);
    if (!task)
        throw new Error(`Task not found: ${id}`);
    let updated = false;
    const infoMessages = [];
    if (patch.priority) {
        task.setPriority(patch.priority);
        updated = true;
    }
    for (const text of patch.addDeliverables ?? []) {
        task.addDeliverable({ id: randomUUID(), text, completed: false });
        updated = true;
    }
    if ((patch.completeDeliverables ?? []).length > 0) {
        for (const idp of patch.completeDeliverables) {
            task.completeDeliverable(resolveWithin(task.deliverables, idp, 'Deliverable', 'deliverable'));
        }
        updated = true;
    }
    if ((patch.removeDeliverables ?? []).length > 0) {
        for (const idp of patch.removeDeliverables) {
            task.removeDeliverable(resolveWithin(task.deliverables, idp, 'Deliverable', 'deliverable'));
        }
        updated = true;
    }
    for (const text of patch.addSuccessCriteria ?? []) {
        task.addSuccessCriterion({ id: randomUUID(), text, completed: false });
        updated = true;
    }
    if ((patch.completeCriteria ?? []).length > 0) {
        for (const idp of patch.completeCriteria) {
            task.completeCriterion(resolveWithin(task.success_criteria, idp, 'Success criterion', 'criterion'), patch.evidence);
        }
        updated = true;
    }
    if (patch.evidence && !(patch.completeCriteria ?? []).length) {
        throw new CliPreparationError('--evidence requires --complete-criterion in the same command.', [
            'Example: octie update abc123 --complete-criterion def456 --evidence "0.86 ms median, n=810"',
        ]);
    }
    if ((patch.removeCriteria ?? []).length > 0) {
        for (const idp of patch.removeCriteria) {
            task.removeSuccessCriterion(resolveWithin(task.success_criteria, idp, 'Success criterion', 'criterion'));
        }
        updated = true;
    }
    if ((patch.addNeedFix ?? []).length > 0) {
        const source = patch.addNeedFix[0].source ?? 'review';
        if (!['review', 'runtime', 'regression'].includes(source)) {
            throw new CliPreparationError(`Invalid --need-fix-source: '${source}'. Must be one of: review, runtime, regression`);
        }
        for (const nf of patch.addNeedFix) {
            task.addNeedFix(nf.text, { file_path: nf.file, source: source });
        }
        updated = true;
    }
    if ((patch.completeNeedFix ?? []).length > 0) {
        for (const idp of patch.completeNeedFix) {
            task.completeNeedFix(resolveWithin(task.need_fix, idp, 'Need_fix item', 'need_fix'));
        }
        updated = true;
    }
    const dependenciesText = patch.blockers ? patch.blockers.explanation : patch.dependencies;
    if (patch.blockers) {
        if (!patch.blockers.explanation) {
            throw new CliPreparationError('When using --blockers, --dependency-explanation is required (twin feature).', [
                `Current dependencies: "${task.dependencies || '(none)'}"`,
                'Example: --blockers abc123 --dependency-explanation "Needs API spec from abc123"',
            ]);
        }
        const blockerTask = graph.getNodeByIdOrPrefix(patch.blockers.id);
        if (!blockerTask)
            throw new Error(`Task with ID '${patch.blockers.id}' not found`);
        if (blockerTask.id === task.id)
            throw new Error('A task cannot block itself.');
        if (wouldCreateCycle(graph, blockerTask.id, task.id)) {
            throw new CliPreparationError(`Adding blocker '${blockerTask.id.substring(0, 8)}' would create a cycle.`, [
                'Cycles are not allowed in the task graph. Use "octie graph cycles" to see existing cycles.',
            ]);
        }
        task.addBlocker(blockerTask.id);
        graph.addEdge(blockerTask.id, task.id);
        const existingDeps = task.dependencies || '';
        task.setDependencies(existingDeps ? `${existingDeps}\n${patch.blockers.explanation}` : patch.blockers.explanation);
        updated = true;
    }
    if (patch.unblock) {
        const unblockTask = graph.getNodeByIdOrPrefix(patch.unblock);
        if (!unblockTask)
            throw new Error(`Task with ID '${patch.unblock}' not found`);
        task.removeBlocker(unblockTask.id);
        graph.removeEdge(unblockTask.id, task.id);
        if (task.blockers.length === 0) {
            task.clearDependencies();
            infoMessages.push('No more blockers - dependencies explanation cleared automatically.');
        }
        updated = true;
    }
    if (dependenciesText && !patch.blockers) {
        if (task.blockers.length === 0) {
            throw new CliPreparationError('Cannot set dependencies explanation without blockers.', [
                'Use --blockers to add a blocker first, or provide both --blockers and --dependency-explanation together.',
            ]);
        }
        task.setDependencies(dependenciesText);
        updated = true;
    }
    if (patch.clearDependencies) {
        task.clearDependencies();
        updated = true;
    }
    for (const file of patch.addRelatedFiles ?? []) {
        task.addRelatedFile(file);
        updated = true;
    }
    for (const file of patch.removeRelatedFiles ?? []) {
        task.removeRelatedFile(file);
        updated = true;
    }
    for (const entry of patch.c7Verified ?? []) {
        const parsed = parseC7(entry);
        task.addC7Verification({
            library_id: parsed.library_id,
            verified_at: parsed.verified_at,
            ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        });
        updated = true;
    }
    for (const libraryId of patch.removeC7Verified ?? []) {
        task.removeC7Verification(normalizeGitBashPath(libraryId));
        updated = true;
    }
    if (patch.notes) {
        for (const note of Array.isArray(patch.notes) ? patch.notes : [patch.notes]) {
            task.appendNotes(note);
        }
        updated = true;
    }
    if (patch.notesFile) {
        const fileContent = readNotesFile(patch.notesFile);
        if (fileContent) {
            task.appendNotes(fileContent);
            updated = true;
        }
    }
    if (!updated)
        throw new Error('No updates specified');
    graph.updateNode(task);
    const propagateResult = graph.propagateStatus(task.id);
    await storage.save(graph);
    await invalidateProjectCache(projectPath);
    return { task: toTaskProjection(task), propagatedCount: propagateResult.updatedTasks.length, infoMessages };
}
export async function updateTask(projectPath, id, patch) {
    return (await updateTaskWithPropagation(projectPath, id, patch)).task;
}
export async function approveTaskWithPropagation(projectPath, id) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const task = graph.getNodeByIdOrPrefix(id);
    if (!task)
        throw new Error(`Task with ID '${id}' not found.`);
    if (task.status !== 'in_review') {
        throw new Error(`Cannot approve task in '${task.status}' status. ` +
            'Task must be in \'in_review\' status to be approved. ' +
            'Complete all success criteria, deliverables, and need_fix items first.');
    }
    task.approve();
    const propagateResult = graph.propagateStatus(task.id);
    await storage.save(graph);
    await invalidateProjectCache(projectPath);
    return { task: toTaskProjection(task), propagatedCount: propagateResult.updatedTasks.length };
}
export async function approveTask(projectPath, id) {
    return (await approveTaskWithPropagation(projectPath, id)).task;
}
//# sourceMappingURL=tasks.js.map