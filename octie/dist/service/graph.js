/**
 * Service: graph operations and analysis.
 * Wire / merge / delete mutate the DAG; stats/validate read it.
 * All functions persist before returning; failures throw.
 */
import { TaskStorage } from '../core/storage/file-store.js';
import { mergeTasks, cutNode, cascadeDelete } from '../core/graph/operations.js';
import { detectCycle, validateReferences } from '../core/graph/cycle.js';
import { topologicalSort } from '../core/graph/sort.js';
import { getConnectedComponents } from '../core/graph/traversal.js';
import { touchProject } from '../core/registry/index.js';
import { CliPreparationError, invalidateProjectCache } from './engine.js';
export async function wireTask(projectPath, taskId, opts) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const taskB = graph.getNodeByIdOrPrefix(taskId);
    if (!taskB)
        throw new Error(`Task not found: ${taskId}`);
    const taskA = graph.getNodeByIdOrPrefix(opts.after);
    if (!taskA)
        throw new Error(`--after task not found: ${opts.after}`);
    const taskC = graph.getNodeByIdOrPrefix(opts.before);
    if (!taskC)
        throw new Error(`--before task not found: ${opts.before}`);
    const bId = taskB.id;
    const aId = taskA.id;
    const cId = taskC.id;
    if (bId === aId)
        throw new Error('Cannot wire a task after itself.');
    if (bId === cId)
        throw new Error('Cannot wire a task before itself.');
    if (aId === cId)
        throw new Error('--after and --before must be different tasks.');
    if (!graph.hasEdge(aId, cId)) {
        throw new CliPreparationError(`No edge exists from ${aId} to ${cId}.`, [
            'The --after and --before tasks must already be connected.',
            'Use \'octie list --graph\' to view current task relationships.',
        ]);
    }
    if (!taskC.blockers.includes(aId)) {
        throw new CliPreparationError(`${cId} is not blocked by ${aId}.`, [
            'The --before task must have --after as a blocker.',
        ]);
    }
    if (graph.hasEdge(bId, cId)) {
        throw new CliPreparationError(`${bId} already blocks ${cId}.`, ['Cannot create a duplicate edge.']);
    }
    if (graph.hasEdge(aId, bId)) {
        throw new CliPreparationError(`${aId} already blocks ${bId}.`, ['Cannot create a duplicate edge.']);
    }
    taskB.addBlocker(aId);
    graph.addEdge(aId, bId);
    const existingDepsB = taskB.dependencies || '';
    taskB.setDependencies(existingDepsB ? `${existingDepsB}\n${opts.depOnAfter}` : opts.depOnAfter);
    taskC.removeBlocker(aId);
    graph.removeEdge(aId, cId);
    taskC.addBlocker(bId);
    graph.addEdge(bId, cId);
    taskC.setDependencies(opts.depOnBefore);
    graph.updateNode(taskB);
    graph.updateNode(taskC);
    graph.propagateStatus(taskB.id);
    graph.propagateStatus(taskC.id);
    await storage.save(graph);
    await invalidateProjectCache(projectPath);
    return { before: [aId, cId], after: [aId, bId, cId], taskId: bId };
}
export async function mergePreview(projectPath, source, target) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const sourceTask = graph.getNodeByIdOrPrefix(source);
    if (!sourceTask)
        throw new Error(`Source task not found: ${source}`);
    const targetTask = graph.getNodeByIdOrPrefix(target);
    if (!targetTask)
        throw new Error(`Target task not found: ${target}`);
    if (sourceTask.id === targetTask.id)
        throw new Error('Cannot merge a task with itself');
    return {
        source: {
            id: sourceTask.id,
            title: sourceTask.title,
            criteriaCount: sourceTask.success_criteria.length,
            deliverablesCount: sourceTask.deliverables.length,
        },
        target: {
            id: targetTask.id,
            title: targetTask.title,
            criteriaCount: targetTask.success_criteria.length,
            deliverablesCount: targetTask.deliverables.length,
        },
    };
}
export async function mergeTask(projectPath, source, target) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const sourceTask = graph.getNodeByIdOrPrefix(source);
    const targetTask = graph.getNodeByIdOrPrefix(target);
    if (!sourceTask)
        throw new Error(`Source task not found: ${source}`);
    if (!targetTask)
        throw new Error(`Target task not found: ${target}`);
    if (sourceTask.id === targetTask.id)
        throw new Error('Cannot merge a task with itself');
    const mergeResult = mergeTasks(graph, sourceTask.id, targetTask.id);
    await storage.save(graph);
    await invalidateProjectCache(projectPath);
    return { sourceId: sourceTask.id, targetId: targetTask.id, affectedCount: mergeResult.updatedTasks.length };
}
export async function deletePreview(projectPath, id) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const task = graph.getNodeByIdOrPrefix(id);
    if (!task)
        throw new Error(`Task not found: ${id}`);
    const dependents = graph.getOutgoingEdges(task.id).map(depId => {
        const t = graph.getNode(depId);
        return { id: depId, title: t?.title ?? '' };
    });
    const blockers = graph.getIncomingEdges(task.id).map(blockerId => {
        const t = graph.getNode(blockerId);
        return { id: blockerId, title: t?.title ?? '' };
    });
    return { task: { id: task.id, title: task.title }, dependents, blockers };
}
export async function deleteTask(projectPath, id, mode = 'simple') {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const task = graph.getNodeByIdOrPrefix(id);
    if (!task)
        throw new Error(`Task not found: ${id}`);
    const fullId = task.id;
    if (mode === 'reconnect') {
        const affected = cutNode(graph, fullId);
        for (const affectedId of affected)
            graph.propagateStatus(affectedId);
    }
    else if (mode === 'cascade') {
        const deleted = cascadeDelete(graph, fullId);
        await storage.save(graph);
        touchProject(projectPath);
        await invalidateProjectCache(projectPath);
        return { deletedIds: deleted };
    }
    else {
        const dependents = graph.getOutgoingEdges(fullId);
        const affected = [];
        for (const depId of dependents) {
            const depTask = graph.getNode(depId);
            if (depTask && depTask.blockers.includes(fullId)) {
                depTask.removeBlocker(fullId);
                affected.push(depId);
            }
        }
        graph.removeNode(fullId);
        for (const affectedId of affected)
            graph.propagateStatus(affectedId);
    }
    await storage.save(graph);
    touchProject(projectPath);
    await invalidateProjectCache(projectPath);
    return { deletedIds: [fullId] };
}
export async function graphStructure(projectPath) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const ids = graph.getAllTasks().map(t => t.id);
    const incoming = {};
    const outgoing = {};
    for (const id of ids) {
        incoming[id] = graph.getIncomingEdges(id);
        outgoing[id] = graph.getOutgoingEdges(id);
    }
    const nodes = ids.map(id => {
        const t = graph.getNode(id);
        return { id, title: t?.title ?? '', status: t?.status ?? 'ready' };
    });
    return { incoming, outgoing, roots: graph.getRootTasks(), nodes };
}
export async function graphStats(projectPath) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const tasks = graph.getAllTasks();
    const byStatus = {};
    const byPriority = {};
    for (const t of tasks) {
        byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    }
    const cycleResult = detectCycle(graph);
    const sortResult = topologicalSort(graph);
    const components = getConnectedComponents(graph);
    return {
        taskCount: graph.size,
        byStatus,
        byPriority,
        roots: graph.getRootTasks(),
        orphans: graph.getOrphanTasks(),
        cycles: cycleResult.cycles,
        hasCycle: cycleResult.hasCycle,
        topologicalOrder: sortResult.sorted,
        connectedComponents: components.length,
    };
}
export async function validateGraph(projectPath) {
    const storage = new TaskStorage({ projectDir: projectPath });
    const graph = await storage.load();
    const cycleResult = detectCycle(graph);
    const refResult = validateReferences(graph);
    return {
        valid: !cycleResult.hasCycle && !refResult.hasInvalidReferences,
        cycles: cycleResult.cycles,
        invalidReferences: refResult.invalidReferences,
    };
}
//# sourceMappingURL=graph.js.map