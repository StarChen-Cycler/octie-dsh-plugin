/**
 * octie-dsh — the DeepSeek Harness bundle Node half.
 *
 * Contract (official bundle form, see design doc §9):
 *  - named-exports `name` / `inject` / `apply` → a complete Cordis plugin;
 *  - provides the `octie` service (OctieService: 17 methods + onChange);
 *  - registers 13 `octie_*` model tools through `ctx.tools.register`;
 *  - emits `octie/task-created`, `octie/task-approved`, `octie/graph-changed`.
 *
 * The engine is the DSH-agnostic octie-core service layer (../dist/index.js);
 * this file only adapts it to Cordis. Every tool/service return value is an
 * owned JSON projection — no live graph objects ever cross the boundary.
 */

import {
  openProject,
  createTask,
  listTasks,
  getTask,
  updateTask,
  approveTask,
  findTasks,
  wireTask,
  mergeTask,
  deleteTask,
  graphStats,
  validateGraph,
  listSnapshots,
  restoreSnapshot,
  createHandoff,
  initProjectAt,
} from '../dist/index.js';

export const name = 'octie-dsh';
export const inject = ['tools'];

export const SERVICE_NAME = 'octie';
export const TOOL_NAMES = [
  'octie_init',
  'octie_create',
  'octie_list',
  'octie_get',
  'octie_find',
  'octie_update',
  'octie_approve',
  'octie_wire',
  'octie_merge',
  'octie_delete',
  'octie_graph',
  'octie_history',
  'octie_handoff',
];

function asArray(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function textBlock(text) {
  return [{ type: 'text', text }];
}

function renderJson(_args, value) {
  if (value === undefined || value === null) return textBlock('(no result)');
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return textBlock(text);
}

/**
 * The `octie` Cordis service. Consumers `inject: ['octie']` and drive the
 * same task graph the CLI drives. Holds the "current project" handle;
 * every mutation propagates through the DAG and persists atomically.
 */
export class OctieService {
  constructor(ctx) {
    this.ctx = ctx;
    this.current = null;
    this.listeners = new Set();
  }

  onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify(kind, payload) {
    for (const listener of this.listeners) {
      try { listener({ kind, ...payload }); } catch { /* isolate subscribers */ }
    }
    if (this.ctx && typeof this.ctx.emit === 'function') {
      try { this.ctx.emit(`octie/${kind}`, payload); } catch { /* events are best-effort */ }
    }
  }

  _requireProject() {
    if (!this.current || !this.current.path) {
      throw new Error('No Octie project open. Call octie_open / octie_init first, or pass the project path.');
    }
    return this.current.path;
  }

  // --- project lifecycle (2) ---
  async open(path) {
    this.current = await openProject(path);
    return { path: this.current.path, name: this.current.name };
  }

  async init(projectName, opts = {}) {
    const p = (opts && typeof opts.path === 'string' && opts.path.trim()) || process.cwd();
    const handle = await initProjectAt(p, projectName);
    this.current = handle;
    return { path: handle.path, name: handle.name };
  }

  // --- task queries & mutations (10) ---
  async createTask(input) {
    const task = await createTask(this._requireProject(), input);
    this._notify('task-created', { task: { id: task.id, title: task.title, status: task.status } });
    return task;
  }

  async listTasks(filter) { return listTasks(this._requireProject(), filter || {}); }

  async getTask(id) { return getTask(this._requireProject(), id); }

  async findTasks(filter) { return findTasks(this._requireProject(), filter || {}); }

  async updateTask(id, patch) {
    const task = await updateTask(this._requireProject(), id, patch);
    this._notify('task-updated', { task: { id: task.id, title: task.title, status: task.status } });
    return task;
  }

  async approveTask(id) {
    const task = await approveTask(this._requireProject(), id);
    this._notify('task-approved', { taskId: task.id, taskTitle: task.title });
    return task;
  }

  async wireTask(id, opts) {
    const result = await wireTask(this._requireProject(), id, opts);
    this._notify('graph-changed', { reason: 'wire', taskId: result.taskId });
    return result;
  }

  async mergeTask(source, target) {
    const result = await mergeTask(this._requireProject(), source, target);
    this._notify('graph-changed', { reason: 'merge', taskId: result.targetId });
    return result;
  }

  async deleteTask(id, mode) {
    const result = await deleteTask(this._requireProject(), id, mode || 'simple');
    this._notify('graph-changed', { reason: 'delete' });
    return result;
  }

  // --- graph analysis (2) ---
  async graph() { return graphStats(this._requireProject()); }

  async validateGraph() { return validateGraph(this._requireProject()); }

  // --- snapshots (2) ---
  async listSnapshots() { return listSnapshots(this._requireProject()); }

  async restoreSnapshot(snapshotId) {
    const result = await restoreSnapshot(this._requireProject(), snapshotId);
    this._notify('graph-changed', { reason: 'restore' });
    return result;
  }

  // --- handoff (1) ---
  async createHandoff(input) {
    const task = await createHandoff(this._requireProject(), input);
    this._notify('task-created', { task: { id: task.id, title: task.title, status: task.status } });
    return task;
  }
}

function resolveProject(service, project) {
  // An explicit `project` path opens (and validates) that project, becoming
  // the current handle so every service method below operates on it.
  if (typeof project === 'string' && project.trim()) {
    return openProject(project.trim()).then(handle => { service.current = handle; return handle.path; });
  }
  if (service.current && service.current.path) return Promise.resolve(service.current.path);
  return openProject().then(handle => { service.current = handle; return handle.path; });
}

// Shared `project` parameter attached to every non-init tool so the model can
// target any existing project in one call (falls back to the open project).
function projectParam() {
  return stringParam(false, 'Project directory path (default: the currently open project)');
}

function stringParam(required, description) {
  return { type: 'string', required: !!required, description };
}

/**
 * Convert the per-parameter spec map into the JSON Schema object the model
 * API requires: `{ type: 'object', properties, required? }`. Each spec value
 * keeps its JSON Schema fields (type, description, enum, items); its boolean
 * `required` flag is lifted into the top-level `required` array.
 */
function objectSchema(spec) {
  const properties = {};
  const required = [];
  for (const [key, value] of Object.entries(spec)) {
    const { required: isRequired, ...property } = value;
    properties[key] = property;
    if (isRequired) required.push(key);
  }
  const schema = { type: 'object', properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

function makeTool(service, name, description, parameters, execute, options = {}) {
  // Every non-init tool accepts an optional `project` path so the model can
  // target any existing project in one call; octie_init uses `path` instead.
  const fullParameters = options.resolveProject === false
    ? parameters
    : { ...parameters, project: projectParam() };
  return {
    name,
    description,
    parameters: objectSchema(fullParameters),
    // Annotation-only schema: every tool returns an owned JSON projection
    // (objects, arrays, strings), so the canonical value is unconstrained.
    output: { schema: {}, render: renderJson },
    async execute(args) {
      // octie_init carries its own path/name and must not resolve a project
      // up front (there is nothing open yet on the very first call).
      const project = options.resolveProject === false
        ? undefined
        : await resolveProject(service, args && args.project);
      return execute(args || {}, project);
    },
  };
}

function buildTools(service) {
  return [
    makeTool(service, 'octie_init',
      'Initialize a new Octie project at a path and open it as the current project.',
      { name: stringParam(true, 'Unique project name'), path: stringParam(false, 'Project directory (default: current working directory)') },
      async (args) => service.init(args.name, { path: args.path }),
      { resolveProject: false }),
    makeTool(service, 'octie_create',
      'Create an atomic task in the Octie graph. Enforces atomic validation (action-verb title, quantitative success criteria, specific deliverables).',
      {
        title: stringParam(true, 'Task title (<=200 chars, must contain an action verb)'),
        description: stringParam(true, 'Detailed task description (50-10000 chars)'),
        successCriteria: { type: 'array', items: { type: 'string' }, required: true, description: '1-10 quantitative success criteria' },
        deliverables: { type: 'array', items: { type: 'string' }, required: true, description: '1-10 specific deliverables (paths or concrete outputs)' },
        priority: { type: 'string', enum: ['top', 'second', 'later'], required: false },
        blockers: { type: 'array', items: { type: 'string' }, required: false, description: 'Task IDs that block this task (requires dependencyExplanation)' },
        dependencyExplanation: stringParam(false, 'Why this task depends on its blockers (required if blockers set)'),
        relatedFiles: { type: 'array', items: { type: 'string' }, required: false },
        notes: stringParam(false, 'Context or comments'),
      },
      async (args) => service.createTask({
        title: args.title,
        description: args.description,
        successCriteria: asArray(args.successCriteria) || [],
        deliverables: asArray(args.deliverables) || [],
        priority: args.priority,
        blockers: asArray(args.blockers),
        dependencyExplanation: args.dependencyExplanation,
        relatedFiles: asArray(args.relatedFiles),
        notes: args.notes,
      })),
    makeTool(service, 'octie_list',
      'List tasks in the Octie graph, optionally filtered by status or priority.',
      {
        status: { type: 'string', enum: ['ready', 'in_progress', 'in_review', 'completed', 'blocked'], required: false },
        priority: { type: 'string', enum: ['top', 'second', 'later'], required: false },
      },
      async (args) => service.listTasks({ status: args.status, priority: args.priority })),
    makeTool(service, 'octie_get',
      'Get one task with full details (supports full UUID or 7-8 char prefix).',
      { id: stringParam(true, 'Task ID (full UUID or short prefix)') },
      async (args) => service.getTask(args.id)),
    makeTool(service, 'octie_find',
      'Search tasks. withoutBlockers finds tasks with no blockers; orphans finds disconnected tasks; leaves finds end tasks.',
      {
        title: stringParam(false, 'Case-insensitive title substring'),
        search: stringParam(false, 'Full-text search across title, description, notes, criteria, deliverables'),
        hasFile: stringParam(false, 'Find tasks referencing a file path'),
        verified: stringParam(false, 'Find tasks with C7 verification from a library'),
        withoutBlockers: { type: 'boolean', required: false },
        orphans: { type: 'boolean', required: false },
        leaves: { type: 'boolean', required: false },
        status: { type: 'string', enum: ['ready', 'in_progress', 'in_review', 'completed', 'blocked'], required: false },
        priority: { type: 'string', enum: ['top', 'second', 'later'], required: false },
      },
      async (args) => service.findTasks({
        title: args.title, search: args.search, hasFile: args.hasFile, verified: args.verified,
        withoutBlockers: args.withoutBlockers, orphans: args.orphans, leaves: args.leaves,
        status: args.status, priority: args.priority,
      })),
    makeTool(service, 'octie_update',
      'Update task progress: complete criteria/deliverables/need_fix items, add need_fix, change priority, manage blockers. Status is derived — never set manually.',
      {
        id: stringParam(true, 'Task ID'),
        priority: { type: 'string', enum: ['top', 'second', 'later'], required: false },
        completeCriteria: { type: 'array', items: { type: 'string' }, required: false, description: 'Criterion IDs to mark complete' },
        completeDeliverables: { type: 'array', items: { type: 'string' }, required: false },
        completeNeedFix: { type: 'array', items: { type: 'string' }, required: false },
        addNeedFix: { type: 'array', items: { type: 'string' }, required: false, description: 'Blocking issues found (blocks review until resolved)' },
        addSuccessCriteria: { type: 'array', items: { type: 'string' }, required: false },
        addDeliverables: { type: 'array', items: { type: 'string' }, required: false },
        notes: stringParam(false, 'Notes to append'),
        blockers: stringParam(false, 'One blocker task ID to add (requires dependencyExplanation)'),
        dependencyExplanation: stringParam(false, 'Why this task depends on the new blocker'),
        unblock: stringParam(false, 'Blocker task ID to remove'),
      },
      async (args) => service.updateTask(args.id, {
        priority: args.priority,
        completeCriteria: asArray(args.completeCriteria),
        completeDeliverables: asArray(args.completeDeliverables),
        completeNeedFix: asArray(args.completeNeedFix),
        addNeedFix: (asArray(args.addNeedFix) || []).map(text => ({ text })),
        addSuccessCriteria: asArray(args.addSuccessCriteria),
        addDeliverables: asArray(args.addDeliverables),
        notes: args.notes,
        blockers: args.blockers ? { id: args.blockers, explanation: args.dependencyExplanation || '' } : undefined,
        unblock: args.unblock,
      })),
    makeTool(service, 'octie_approve',
      'Approve an in_review task (the only manual status transition: in_review -> completed). Unblocks dependents via BFS propagation.',
      { id: stringParam(true, 'Task ID') },
      async (args) => service.approveTask(args.id)),
    makeTool(service, 'octie_wire',
      'Insert a task between two connected tasks on a blocker chain (A->C becomes A->B->C).',
      {
        id: stringParam(true, 'Task to insert'),
        after: stringParam(true, 'Predecessor task ID'),
        before: stringParam(true, 'Successor task ID (must currently be blocked by after)'),
        depOnAfter: stringParam(true, 'Why the inserted task depends on --after'),
        depOnBefore: stringParam(true, 'Why --before depends on the inserted task'),
      },
      async (args) => service.wireTask(args.id, {
        after: args.after, before: args.before, depOnAfter: args.depOnAfter, depOnBefore: args.depOnBefore,
      })),
    makeTool(service, 'octie_merge',
      'Merge two tasks into one (source is deleted; criteria, deliverables, notes, related files and blockers transfer to target).',
      { source: stringParam(true, 'Source task ID (deleted after merge)'), target: stringParam(true, 'Target task ID (receives merged content)') },
      async (args) => service.mergeTask(args.source, args.target)),
    makeTool(service, 'octie_delete',
      'Delete a task. mode=simple removes it and cleans blocker references; reconnect splices the chain; cascade deletes dependents too.',
      {
        id: stringParam(true, 'Task ID'),
        mode: { type: 'string', enum: ['simple', 'reconnect', 'cascade'], required: false },
      },
      async (args) => service.deleteTask(args.id, args.mode)),
    makeTool(service, 'octie_graph',
      'Graph statistics and health: counts, roots, orphans, cycles, topological order, critical path; validate=true adds reference/cycle validation.',
      { validate: { type: 'boolean', required: false } },
      async (args) => {
        const stats = await service.graph();
        if (args.validate) stats.validation = await service.validateGraph();
        return stats;
      }),
    makeTool(service, 'octie_history',
      'Inspect immutable snapshots (action=list) or restore one (action=restore).',
      {
        action: { type: 'string', enum: ['list', 'restore'], required: true },
        snapshotId: stringParam(false, 'Snapshot ID (required when action=restore)'),
      },
      async (args) => {
        if (args.action === 'restore') {
          if (!args.snapshotId) throw new Error('snapshotId is required when action=restore');
          return service.restoreSnapshot(args.snapshotId);
        }
        return service.listSnapshots();
      }),
    makeTool(service, 'octie_handoff',
      'Create a loose subproject handoff: initializes the child project under .octie/subprojects/<name> and creates the parent gate task.',
      {
        subprojectName: stringParam(true, 'Subproject folder name'),
        title: stringParam(true, 'Parent gate task title (action verb)'),
        description: stringParam(true, 'Parent gate task description (50-10000 chars)'),
        successCriteria: { type: 'array', items: { type: 'string' }, required: true },
        deliverables: { type: 'array', items: { type: 'string' }, required: true },
        priority: { type: 'string', enum: ['top', 'second', 'later'], required: false },
      },
      async (args) => service.createHandoff({
        subprojectName: args.subprojectName,
        title: args.title,
        description: args.description,
        successCriteria: asArray(args.successCriteria) || [],
        deliverables: asArray(args.deliverables) || [],
        priority: args.priority,
      })),
  ];
}

export function apply(ctx) {
  const service = new OctieService(ctx);
  const disposers = [];

  // Provide the `octie` service for other plugins (inject: ['octie']).
  if (typeof ctx.provide === 'function') {
    disposers.push(ctx.provide('octie', service));
  }

  // Register the model tools; disposers returned by the registry are owned
  // by this plugin's lifecycle.
  for (const tool of buildTools(service)) {
    disposers.push(ctx.tools.register(tool));
  }

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose(); } catch { /* best-effort teardown */ }
    }
  }, 'octie-dsh: service + tools');
}
