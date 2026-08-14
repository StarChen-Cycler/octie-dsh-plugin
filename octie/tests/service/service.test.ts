/**
 * Service layer tests: validation, twin requirement, status derivation,
 * graph operations, projections, snapshots, handoffs.
 *
 * The global registry reads `~/.octie/projects.json`; node:os.homedir is
 * mocked (repo's registry-test pattern) so tests never touch the real one.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const mockHome = join(tmpdir(), `octie-svc-home-${uuidv4()}`);
let homedirTarget = mockHome;

vi.doMock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, homedir: () => homedirTarget };
});

let svc: typeof import('../../src/service/index.js');
let TaskStorage: typeof import('../../src/core/storage/file-store.js').TaskStorage;
let TaskNode: typeof import('../../src/core/models/task-node.js').TaskNode;

const DESC = 'A service layer test task description with enough length to pass atomic validation comfortably.';
const CRIT = 'Task graph contains exactly 1 new task with a UUID id';
const DELIV = 'tests/service/fixture-record.md';

function seed(graph: any, over: Partial<any> = {}): string {
  const id = uuidv4();
  const blockers: string[] = over.blockers ?? [];
  graph.addNode(new TaskNode({
    id,
    title: 'Test seed task',
    description: DESC,
    success_criteria: [{ id: uuidv4(), text: 'Seed task has status ready when unblocked', completed: false }],
    deliverables: [{ id: uuidv4(), text: 'tests/service/seed-record.md', completed: false }],
    ...over,
  }));
  for (const blocker of blockers) {
    graph.addEdge(blocker, id);
  }
  return id;
}

describe('octie-core service layer', () => {
  let dir: string;

  beforeAll(async () => {
    vi.resetModules();
    mkdirSync(mockHome, { recursive: true });
    svc = await import('../../src/service/index.js');
    ({ TaskStorage } = await import('../../src/core/storage/file-store.js'));
    ({ TaskNode } = await import('../../src/core/models/task-node.js'));
  });

  afterAll(() => {
    vi.doUnmock('node:os');
    try { rmSync(mockHome, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  beforeEach(async () => {
    dir = join(tmpdir(), `octie-svc-${uuidv4()}`);
    mkdirSync(dir, { recursive: true });
    const storage = new TaskStorage({ projectDir: dir });
    await storage.createProject('svc-project');
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('initProjectAt / openProject', () => {
    it('initializes a project and rejects duplicate names', async () => {
      const p = join(tmpdir(), `octie-svc-init-${uuidv4()}`);
      mkdirSync(p, { recursive: true });
      const uniqueName = `svc-init-${uuidv4().slice(0, 8)}`;
      const handle = await svc.initProjectAt(p, uniqueName);
      expect(handle.name).toBe(uniqueName);
      await expect(svc.initProjectAt(p, uniqueName)).rejects.toThrow(/already exists/i);
      rmSync(p, { recursive: true, force: true });
    });

    it('openProject accepts an explicit path', async () => {
      const handle = await svc.openProject(dir);
      expect(handle.path).toBe(dir);
    });
  });

  describe('createTask validation', () => {
    it('creates an atomic task and returns a JSON projection', async () => {
      const task = await svc.createTask(dir, {
        title: 'Implement service task',
        description: DESC,
        successCriteria: [CRIT],
        deliverables: [DELIV],
        priority: 'top',
        notes: 'projection check',
      });
      expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(task.status).toBe('ready');
      expect(task.success_criteria[0]!.completed).toBe(false);
      const roundTrip = JSON.parse(JSON.stringify(task));
      expect(roundTrip.id).toBe(task.id);
    });

    it('rejects empty title', async () => {
      await expect(svc.createTask(dir, { title: '  ', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] }))
        .rejects.toThrow(/Title is required/);
    });

    it('rejects missing criteria', async () => {
      await expect(svc.createTask(dir, { title: 'Implement x', description: DESC, successCriteria: [], deliverables: [DELIV] }))
        .rejects.toThrow(/success criterion is required/);
    });

    it('rejects blockers without dependency explanation (twin)', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const blocker = seed(g, { title: 'Build blocker task' });
      await storage.save(g);
      await expect(svc.createTask(dir, {
        title: 'Implement twin', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], blockers: [blocker],
      })).rejects.toThrow(/dependency-explanation/);
    });

    it('rejects dependency explanation without blockers (twin)', async () => {
      await expect(svc.createTask(dir, {
        title: 'Implement twin2', description: DESC, successCriteria: [CRIT], deliverables: [DELIV],
        dependencyExplanation: 'orphan explanation',
      })).rejects.toThrow(/dependency-explanation/);
    });

    it('rejects invalid priority and unknown blockers', async () => {
      await expect(svc.createTask(dir, {
        title: 'Implement prio', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], priority: 'urgent' as any,
      })).rejects.toThrow(/Invalid priority/);
      await expect(svc.createTask(dir, {
        title: 'Implement blocker', description: DESC, successCriteria: [CRIT], deliverables: [DELIV],
        blockers: ['00000000-0000-0000-0000-000000000000'], dependencyExplanation: 'needs it',
      })).rejects.toThrow(/not found/);
    });

    it('wires blockers and creates the graph edge', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const blocker = seed(g, { title: 'Build blocker task two' });
      await storage.save(g);
      const task = await svc.createTask(dir, {
        title: 'Implement dependent',
        description: DESC, successCriteria: [CRIT], deliverables: [DELIV],
        blockers: [blocker], dependencyExplanation: 'needs the blocker output',
      });
      expect(task.blockers).toContain(blocker);
      expect(task.status).toBe('blocked');
    });

    it('rejects notes-file that does not exist', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      await expect(
        (async () => {
          const { preflightTaskCreation, toCreateOptions } = await import('../../src/service/engine.js');
          const opts = toCreateOptions({ title: 'Implement notes', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], notes: '' });
          (opts as any).notesFile = join(dir, 'missing-notes.md');
          preflightTaskCreation(g, opts);
        })(),
      ).rejects.toThrow(/Notes file not found/);
    });
  });

  describe('list / get / find', () => {
    it('lists with status and priority filters', async () => {
      await svc.createTask(dir, { title: 'Implement one', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], priority: 'top' });
      await svc.createTask(dir, { title: 'Implement two', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], priority: 'later' });
      const ready = await svc.listTasks(dir, { status: 'ready' });
      expect(ready.length).toBe(2);
      const top = await svc.listTasks(dir, { priority: 'top' });
      expect(top.length).toBe(1);
    });

    it('gets by prefix and returns null for unknown', async () => {
      const t = await svc.createTask(dir, { title: 'Implement get', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      const byPrefix = await svc.getTask(dir, t.id.substring(0, 8));
      expect(byPrefix!.id).toBe(t.id);
      expect(await svc.getTask(dir, '00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('find supports text, file, verified, shape filters', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const a = seed(g, { title: 'Build alpha module', related_files: ['src/alpha.ts'], c7_verified: [{ library_id: 'express', verified_at: new Date().toISOString() }] });
      const b = seed(g, { title: 'Build beta module', blockers: [a] });
      (g.getNode(b))!.setDependencies('needs alpha');
      await storage.save(g);

      expect((await svc.findTasks(dir, { title: 'alpha' })).length).toBe(1);
      expect((await svc.findTasks(dir, { search: 'alpha' })).length).toBe(1);
      expect((await svc.findTasks(dir, { hasFile: 'alpha.ts' })).length).toBe(1);
      expect((await svc.findTasks(dir, { verified: 'express' })).length).toBe(1);
      expect((await svc.findTasks(dir, { withoutBlockers: true })).length).toBe(1);
      expect((await svc.findTasks(dir, { leaves: true })).length).toBe(1);
      expect((await svc.findTasks(dir, { status: 'ready' })).length).toBe(1);
      expect((await svc.findTasks(dir, { priority: 'second' })).length).toBe(2);
    });
  });

  describe('updateTask', () => {
    it('changes priority, completes items by prefix, appends notes', async () => {
      const t = await svc.createTask(dir, { title: 'Implement update', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      const updated = await svc.updateTask(dir, t.id, {
        priority: 'later',
        completeCriteria: [t.success_criteria[0]!.id.substring(0, 8)],
        completeDeliverables: [t.deliverables[0]!.id.substring(0, 8)],
        notes: 'progress note',
      });
      expect(updated.priority).toBe('later');
      expect(updated.success_criteria[0]!.completed).toBe(true);
      expect(updated.status).toBe('in_review');
      expect(updated.notes).toContain('progress note');
    });

    it('rejects ambiguous criterion prefix', async () => {
      const t = await svc.createTask(dir, { title: 'Implement amb', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const node = g.getNode(t.id)!;
      const sharedPrefix = t.success_criteria[0]!.id.substring(0, 8);
      node.success_criteria[0]!.id = `${sharedPrefix}eeee-0000-0000-000000000000`;
      node.addSuccessCriterion({ id: `${sharedPrefix}ffff-0000-0000-000000000000`, text: 'Second criterion shares the prefix', completed: false });
      await storage.save(g);
      await expect(svc.updateTask(dir, t.id, { completeCriteria: [sharedPrefix] }))
        .rejects.toThrow(/Ambiguous/);
    });

    it('adds and resolves need_fix items', async () => {
      const t = await svc.createTask(dir, { title: 'Implement needfix', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      const withFix = await svc.updateTask(dir, t.id, { addNeedFix: [{ text: 'runtime null pointer', source: 'runtime', file: 'src/x.ts' }] });
      expect(withFix.need_fix.length).toBe(1);
      expect(withFix.status).toBe('in_progress');
      const resolved = await svc.updateTask(dir, t.id, { completeNeedFix: [withFix.need_fix[0]!.id] });
      expect(resolved.need_fix[0]!.completed).toBe(true);
    });

    it('adds a blocker, prevents self-block and cycles, unblocks', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const a = seed(g, { title: 'Build blocker a' });
      const b = seed(g, { title: 'Build blocker b', blockers: [a] });
      (g.getNode(b))!.setDependencies('needs a');
      const c = seed(g, { title: 'Build blocker c' });
      await storage.save(g);

      await expect(svc.updateTask(dir, a, { blockers: { id: a, explanation: 'self' } })).rejects.toThrow(/cannot block itself/);
      await expect(svc.updateTask(dir, a, { blockers: { id: b, explanation: 'cycle' } })).rejects.toThrow(/cycle/);
      await expect(svc.updateTask(dir, b, { blockers: { id: '00000000-0000-0000-0000-000000000000', explanation: 'x' } })).rejects.toThrow(/not found/);

      const added = await svc.updateTask(dir, c, { blockers: { id: b, explanation: 'depends on b' } });
      expect(added.blockers).toContain(b);
      expect(added.status).toBe('blocked');

      const unblocked = await svc.updateTask(dir, c, { unblock: b });
      expect(unblocked.blockers).not.toContain(b);
      expect(unblocked.status).toBe('ready');
    });

    it('rejects unknown task', async () => {
      await expect(svc.updateTask(dir, '00000000-0000-0000-0000-000000000000', { priority: 'top' }))
        .rejects.toThrow(/Task not found/);
    });
  });

  describe('approveTask (derived status)', () => {
    it('refuses non-review status and approves in_review', async () => {
      const t = await svc.createTask(dir, { title: 'Implement approve', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      await expect(svc.approveTask(dir, t.id)).rejects.toThrow(/Cannot approve/);

      await svc.updateTask(dir, t.id, {
        completeCriteria: [t.success_criteria[0]!.id],
        completeDeliverables: [t.deliverables[0]!.id],
      });
      const approved = await svc.approveTask(dir, t.id);
      expect(approved.status).toBe('completed');
      expect(approved.completed_at).not.toBeNull();

      await expect(svc.approveTask(dir, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
    });
  });

  describe('graph operations', () => {
    it('wires B between A and C and validates all error branches', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const A = seed(g, { title: 'Build wire A' });
      const B = seed(g, { title: 'Build wire B' });
      const C = seed(g, { title: 'Build wire C', blockers: [A] });
      (g.getNode(C))!.setDependencies('needs A');
      const D = seed(g, { title: 'Build wire D' });
      await storage.save(g);

      await expect(svc.wireTask(dir, '00000000-0000-0000-0000-000000000000', { after: A, before: C, depOnAfter: 'x', depOnBefore: 'y' })).rejects.toThrow(/Task not found/);
      await expect(svc.wireTask(dir, A, { after: A, before: C, depOnAfter: 'x', depOnBefore: 'y' })).rejects.toThrow(/after itself/);
      await expect(svc.wireTask(dir, B, { after: A, before: B, depOnAfter: 'x', depOnBefore: 'y' })).rejects.toThrow(/before itself/);
      await expect(svc.wireTask(dir, B, { after: A, before: A, depOnAfter: 'x', depOnBefore: 'y' })).rejects.toThrow(/must be different/);
      await expect(svc.wireTask(dir, B, { after: A, before: D, depOnAfter: 'x', depOnBefore: 'y' })).rejects.toThrow(/No edge/);

      const result = await svc.wireTask(dir, B, { after: A, before: C, depOnAfter: 'B needs A', depOnBefore: 'C needs B' });
      expect(result.after).toEqual([A, B, C]);
    });

    it('merges two tasks and rejects bad inputs', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const a = seed(g, { title: 'Build merge A' });
      const b = seed(g, { title: 'Build merge B' });
      await storage.save(g);
      await expect(svc.mergeTask(dir, '00000000-0000-0000-0000-000000000000', b)).rejects.toThrow(/Source task not found/);
      await expect(svc.mergeTask(dir, a, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/Target task not found/);
      await expect(svc.mergeTask(dir, a, a)).rejects.toThrow(/itself/);
      const result = await svc.mergeTask(dir, a, b);
      expect(result.sourceId).toBe(a);
      expect(await svc.getTask(dir, a)).toBeNull();
      expect(await svc.getTask(dir, b)).not.toBeNull();
    });

    it('deletes in simple, reconnect and cascade modes', async () => {
      const storage = new TaskStorage({ projectDir: dir });
      const g = await storage.load();
      const A = seed(g, { title: 'Build del A' });
      const B = seed(g, { title: 'Build del B', blockers: [A] });
      (g.getNode(B))!.setDependencies('needs A');
      await storage.save(g);
      await expect(svc.deleteTask(dir, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/Task not found/);

      const simple = await svc.deleteTask(dir, B, 'simple');
      expect(simple.deletedIds).toEqual([B]);
      expect((await svc.listTasks(dir)).map(t => t.id)).toContain(A);

      const C = await svc.createTask(dir, { title: 'Implement del C', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], blockers: [A], dependencyExplanation: 'needs A' });
      const D = await svc.createTask(dir, { title: 'Implement del D', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], blockers: [C.id], dependencyExplanation: 'needs C' });
      const rec = await svc.deleteTask(dir, C.id, 'reconnect');
      expect(rec.deletedIds).toEqual([C.id]);
      const dAfter = await svc.getTask(dir, D.id);
      expect(dAfter!.blockers).toEqual([A]);

      const cas = await svc.deleteTask(dir, A, 'cascade');
      expect(cas.deletedIds).toContain(A);
      expect(await svc.getTask(dir, D.id)).toBeNull();
    });

    it('reports graph stats and validation', async () => {
      await svc.createTask(dir, { title: 'Implement stats', description: DESC, successCriteria: [CRIT], deliverables: [DELIV], priority: 'top' });
      const stats = await svc.graphStats(dir);
      expect(stats.taskCount).toBe(1);
      expect(stats.hasCycle).toBe(false);
      expect(stats.topologicalOrder.length).toBe(1);
      const validation = await svc.validateGraph(dir);
      expect(validation.valid).toBe(true);
    });
  });

  describe('history snapshots', () => {
    it('lists and restores snapshots', async () => {
      const before = await svc.listSnapshots(dir);
      await svc.createTask(dir, { title: 'Implement snap', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      const after = await svc.listSnapshots(dir);
      expect(after.length).toBeGreaterThanOrEqual(before.length + 1);

      await expect(svc.restoreSnapshot(dir, 'does-not-exist')).rejects.toThrow(/Snapshot not found/);

      const target = after.find(e => e.task_count === 0) ?? after[0]!;
      await svc.restoreSnapshot(dir, target.snapshot_id);
      expect((await svc.listTasks(dir)).length).toBeLessThanOrEqual(1);
    });
  });

  describe('handoff', () => {
    it('validates name and existing folder, then creates child + gate task', async () => {
      await expect(svc.createHandoff(dir, {
        subprojectName: '  ', title: 'Implement gate', description: DESC, successCriteria: [CRIT], deliverables: [DELIV],
      })).rejects.toThrow(/Subproject name is required/);

      const childName = `child-${uuidv4().slice(0, 8)}`;
      const gate = await svc.createHandoff(dir, {
        subprojectName: childName, title: 'Implement gate', description: DESC, successCriteria: [CRIT], deliverables: [DELIV],
      });
      expect(gate.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(gate.notes).toContain('OCTIE SUBTASK HANDOFF');

      await expect(svc.createHandoff(dir, {
        subprojectName: childName, title: 'Implement gate2', description: DESC, successCriteria: [CRIT], deliverables: [DELIV],
      })).rejects.toThrow(/already exists/);
    });
  });

  describe('projections', () => {
    it('projection contains only JSON-safe leaf fields', async () => {
      const t = await svc.createTask(dir, { title: 'Implement proj', description: DESC, successCriteria: [CRIT], deliverables: [DELIV] });
      expect(t).toEqual(expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        status: expect.any(String),
        priority: expect.any(String),
        blockers: expect.any(Array),
        related_files: expect.any(Array),
        created_at: expect.any(String),
      }));
      expect(typeof t.completed_at === 'string' || t.completed_at === null).toBe(true);
    });
  });
});
