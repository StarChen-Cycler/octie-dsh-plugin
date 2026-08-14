/**
 * Service: task queries and mutations.
 * All functions: load graph → operate → persist → return JSON projections.
 * Failures throw Errors; no console output, no process.exit.
 */

import { randomUUID } from 'node:crypto';
import { TaskStorage, findProjectPath } from '../core/storage/file-store.js';
import type { TaskNode } from '../core/models/task-node.js';
import { wouldCreateCycle } from '../core/graph/algorithms.js';
import { toCreateOptions, executeTaskCreation, preflightTaskCreation, invalidateProjectCache } from './engine.js';
import { toTaskSummary, toTaskProjection } from './projections.js';
import type {
  CreateTaskInput,
  FindFilter,
  ListFilter,
  ProjectHandle,
  TaskProjection,
  TaskSummary,
  UpdateTaskPatch,
} from './types.js';

export async function openProject(path?: string): Promise<ProjectHandle> {
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

export async function createTask(projectPath: string, input: CreateTaskInput): Promise<TaskProjection> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const graph = await storage.load();
  const prepared = preflightTaskCreation(graph, toCreateOptions(input));
  const task = await executeTaskCreation(projectPath, graph, prepared);
  return toTaskProjection(task);
}

export async function listTasks(projectPath: string, filter: ListFilter = {}): Promise<TaskSummary[]> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const graph = await storage.load();
  let tasks = graph.getAllTasks();
  if (filter.status) tasks = tasks.filter(t => t.status === filter.status);
  if (filter.priority) tasks = tasks.filter(t => t.priority === filter.priority);
  return tasks.map(toTaskSummary);
}

export async function getTask(projectPath: string, id: string): Promise<TaskProjection | null> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const graph = await storage.load();
  const task = graph.getNodeByIdOrPrefix(id);
  return task ? toTaskProjection(task) : null;
}

function matchesTitle(task: TaskNode, pattern: string): boolean {
  return task.title.toLowerCase().includes(pattern.toLowerCase());
}

function matchesSearch(task: TaskNode, query: string): boolean {
  const q = query.toLowerCase();
  if (task.title.toLowerCase().includes(q)) return true;
  if (task.description.toLowerCase().includes(q)) return true;
  if (task.notes.toLowerCase().includes(q)) return true;
  if (task.success_criteria.some(sc => sc.text.toLowerCase().includes(q))) return true;
  if (task.deliverables.some(d => d.text.toLowerCase().includes(q))) return true;
  return false;
}

function matchesFile(task: TaskNode, filePath: string): boolean {
  return task.related_files.some(f => f.toLowerCase().includes(filePath.toLowerCase()));
}

export async function findTasks(projectPath: string, filter: FindFilter = {}): Promise<TaskSummary[]> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const graph = await storage.load();
  let tasks = graph.getAllTasks();

  let constrained: Set<string> | null = null;
  const intersect = (ids: string[]) => {
    const next = new Set(ids);
    constrained = constrained === null ? next : new Set([...constrained].filter(id => next.has(id)));
  };

  if (filter.orphans) intersect(graph.getOrphanTasks());
  if (filter.leaves) intersect(graph.getLeafTasks());
  if (filter.withoutBlockers) intersect(tasks.filter(t => t.blockers.length === 0).map(t => t.id));
  if (constrained !== null) tasks = tasks.filter(t => constrained!.has(t.id));

  if (filter.title) tasks = tasks.filter(t => matchesTitle(t, filter.title!));
  if (filter.search) tasks = tasks.filter(t => matchesSearch(t, filter.search!));
  if (filter.hasFile) tasks = tasks.filter(t => matchesFile(t, filter.hasFile!));
  if (filter.verified) {
    const lib = filter.verified.toLowerCase();
    tasks = tasks.filter(t => t.c7_verified.some(v => v.library_id.toLowerCase().includes(lib)));
  }
  if (filter.status) tasks = tasks.filter(t => t.status === filter.status);
  if (filter.priority) tasks = tasks.filter(t => t.priority === filter.priority);
  return tasks.map(toTaskSummary);
}

function resolveWithin<T extends { id: string }>(items: T[], idOrPrefix: string, label: string): string {
  const exact = items.find(i => i.id === idOrPrefix);
  if (exact) return exact.id;
  const prefix = idOrPrefix.toLowerCase();
  const matches = items.filter(i => i.id.toLowerCase().startsWith(prefix));
  if (matches.length === 0) throw new Error(`${label} with ID '${idOrPrefix}' not found.`);
  if (matches.length > 1) {
    throw new Error(`Ambiguous ${label} ID '${idOrPrefix}'. Matches: ${matches.map(m => m.id.substring(0, 8)).join(', ')}`);
  }
  return matches[0]!.id;
}

export async function updateTask(projectPath: string, id: string, patch: UpdateTaskPatch): Promise<TaskProjection> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const graph = await storage.load();
  const task = graph.getNodeByIdOrPrefix(id);
  if (!task) throw new Error(`Task not found: ${id}`);

  if (patch.priority) task.setPriority(patch.priority);

  for (const text of patch.addDeliverables ?? []) {
    task.addDeliverable({ id: randomUUID(), text, completed: false });
  }
  for (const idp of patch.completeDeliverables ?? []) {
    task.completeDeliverable(resolveWithin(task.deliverables, idp, 'Deliverable'));
  }
  for (const text of patch.addSuccessCriteria ?? []) {
    task.addSuccessCriterion({ id: randomUUID(), text, completed: false });
  }
  for (const idp of patch.completeCriteria ?? []) {
    task.completeCriterion(resolveWithin(task.success_criteria, idp, 'Success criterion'));
  }
  for (const nf of patch.addNeedFix ?? []) {
    task.addNeedFix(nf.text, { file_path: nf.file, source: nf.source ?? 'review' });
  }
  for (const idp of patch.completeNeedFix ?? []) {
    task.completeNeedFix(resolveWithin(task.need_fix, idp, 'Need_fix item'));
  }

  if (patch.blockers) {
    const blockerTask = graph.getNodeByIdOrPrefix(patch.blockers.id);
    if (!blockerTask) throw new Error(`Task with ID '${patch.blockers.id}' not found`);
    if (blockerTask.id === task.id) throw new Error('A task cannot block itself.');
    if (wouldCreateCycle(graph, blockerTask.id, task.id)) {
      throw new Error(`Adding blocker '${blockerTask.id.substring(0, 8)}' would create a cycle.`);
    }
    task.addBlocker(blockerTask.id);
    graph.addEdge(blockerTask.id, task.id);
    const existing = task.dependencies || '';
    task.setDependencies(existing ? `${existing}\n${patch.blockers.explanation}` : patch.blockers.explanation);
  }

  if (patch.unblock) {
    const unblockTask = graph.getNodeByIdOrPrefix(patch.unblock);
    if (!unblockTask) throw new Error(`Task with ID '${patch.unblock}' not found`);
    task.removeBlocker(unblockTask.id);
    graph.removeEdge(unblockTask.id, task.id);
    if (task.blockers.length === 0) task.clearDependencies();
  }

  if (patch.notes) task.appendNotes(patch.notes);

  graph.updateNode(task);
  graph.propagateStatus(task.id);
  await storage.save(graph);
  await invalidateProjectCache(projectPath);
  return toTaskProjection(task);
}

export async function approveTask(projectPath: string, id: string): Promise<TaskProjection> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const graph = await storage.load();
  const task = graph.getNodeByIdOrPrefix(id);
  if (!task) throw new Error(`Task with ID '${id}' not found.`);
  if (task.status !== 'in_review') {
    throw new Error(
      `Cannot approve task in '${task.status}' status. ` +
      'Task must be in \'in_review\' status to be approved. ' +
      'Complete all success criteria, deliverables, and need_fix items first.',
    );
  }
  task.approve();
  graph.propagateStatus(task.id);
  await storage.save(graph);
  await invalidateProjectCache(projectPath);
  return toTaskProjection(task);
}
