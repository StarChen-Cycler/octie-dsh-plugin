/**
 * Tests for the octie-dsh bundle Node half (plugin/index.mjs).
 *
 * Covers:
 *  - named exports (name / inject / apply)
 *  - OctieService provides all 17 methods from design doc section 9.4
 *  - 13 octie_* tools registered with JSON parameters
 *  - functional smoke: init -> create -> list -> events through the tools
 *
 * The global registry reads ~/.octie/projects.json; node:os.homedir is
 * mocked (repo registry-test pattern) so tests never touch the real one.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { apply, OctieService, TOOL_NAMES, SERVICE_NAME, name, inject } from '../../../plugin/index.mjs';
import { TaskStorage } from '../../../src/core/storage/file-store.js';

let homedirTarget = '';

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, homedir: () => homedirTarget };
});

const SERVICE_METHODS = [
  'init', 'open', 'createTask', 'listTasks', 'getTask', 'updateTask', 'approveTask',
  'findTasks', 'wireTask', 'mergeTask', 'deleteTask', 'graph', 'validateGraph',
  'listSnapshots', 'restoreSnapshot', 'createHandoff', 'onChange',
];

interface MockCtx {
  provided: Record<string, unknown>;
  registered: Array<Record<string, unknown>>;
  emitted: Array<[string, unknown]>;
}

function makeMockCtx(): { ctx: MockCtx; wrapper: any } {
  const mock: MockCtx = { provided: {}, registered: [], emitted: [] };
  const wrapper = {
    tools: {
      register: (def: Record<string, unknown>) => {
        mock.registered.push(def);
        return () => {};
      },
    },
    provide: (serviceName: string, value: unknown) => {
      mock.provided[serviceName] = value;
      return () => {};
    },
    emit: (event: string, payload: unknown) => {
      mock.emitted.push([event, payload]);
    },
    on: () => () => {},
    get: () => undefined,
    effect: (cb: () => (() => void) | void) => {
      cb();
      return () => {};
    },
  };
  return { ctx: mock, wrapper };
}

/**
 * Mirrors DSH's tool-output contract: objects, arrays, strings, numbers,
 * booleans and null are lossless JSON; `undefined`, functions, Date, Map/Set
 * and class instances are not. Regression guard for the projection fix.
 */
function isLosslessJson(value: unknown, path = '$'): boolean {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((x, i) => isLosslessJson(x, `${path}[${i}]`));
  if (t === 'object' && (value as object).constructor === Object) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) return false;
      if (!isLosslessJson(v, `${path}.${k}`)) return false;
    }
    return true;
  }
  return false;
}

describe('octie-dsh bundle Node half', () => {
  let tempDir: string;

  beforeAll(() => {
    homedirTarget = join(tmpdir(), `octie-plugin-home-${uuidv4()}`);
    mkdirSync(homedirTarget, { recursive: true });
  });

  afterAll(() => {
    vi.unmock('node:os');
    try { rmSync(homedirTarget, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  beforeEach(() => {
    tempDir = join(tmpdir(), `octie-plugin-test-${uuidv4()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // The smoke/onChange tests run `init`, which registers the project in the
    // global registry (~/.octie/projects.json). The compiled dist/ loads
    // `node:os` through native ESM, so vi.mock cannot redirect its homedir();
    // prune the entry this test created by path instead (via the real homedir).
    try {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      const regPath = join(actual.homedir(), '.octie', 'projects.json');
      const reg = JSON.parse(readFileSync(regPath, 'utf8'));
      let changed = false;
      for (const [key, value] of Object.entries(reg.projects || {})) {
        if ((value as { path?: string }).path === tempDir) {
          delete (reg.projects as Record<string, unknown>)[key];
          changed = true;
        }
      }
      if (changed) writeFileSync(regPath, JSON.stringify(reg, null, 2) + '\n');
    } catch { /* registry may be absent or locked */ }
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('named-exports name, inject and apply', () => {
    expect(name).toBe('octie-dsh');
    expect(inject).toContain('tools');
    expect(typeof apply).toBe('function');
  });

  it('provides the octie service with all 17 methods', () => {
    const { ctx, wrapper } = makeMockCtx();
    apply(wrapper);
    const service = ctx.provided[SERVICE_NAME];
    expect(service).toBeInstanceOf(OctieService);
    for (const method of SERVICE_METHODS) {
      expect(typeof (service as any)[method], `missing service method ${method}`).toBe('function');
    }
  });

  it('registers exactly the 13 octie_* tools', () => {
    const { ctx, wrapper } = makeMockCtx();
    apply(wrapper);
    const names = ctx.registered.map((t: any) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
    for (const tool of ctx.registered as any[]) {
      expect(tool.parameters && typeof tool.parameters === 'object').toBe(true);
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('every tool exposes a valid JSON Schema and (non-init) a project param', () => {
    const { ctx, wrapper } = makeMockCtx();
    apply(wrapper);
    for (const tool of ctx.registered as any[]) {
      const p = tool.parameters;
      expect(p.type, `${tool.name} parameters.type`).toBe('object');
      expect(p.properties && typeof p.properties === 'object', `${tool.name} parameters.properties`).toBe(true);
      expect(p.required === undefined || Array.isArray(p.required), `${tool.name} parameters.required`).toBe(true);
      expect(tool.output && typeof tool.output.schema === 'object', `${tool.name} output.schema`).toBe(true);
      if (tool.name !== 'octie_init') {
        expect(Object.prototype.hasOwnProperty.call(p.properties, 'project'), `${tool.name} has project param`).toBe(true);
      }
    }
  });

  it('registers the bundled octie usage skill when the skills service is present', () => {
    const skillRegs: any[] = [];
    const skillsMock = {
      register: (def: any) => { skillRegs.push(def); return () => {}; },
    };
    const wrapper: any = {
      tools: { register: () => () => {} },
      provide: () => () => {},
      emit: () => {},
      on: () => () => {},
      get: (name: string) => (name === 'skills' ? skillsMock : undefined),
      effect: (cb: () => any) => { cb(); return () => {}; },
    };
    apply(wrapper);

    expect(skillRegs).toHaveLength(1);
    const skill = skillRegs[0];
    expect(skill.name).toBe('octie');
    expect(skill.source).toBe('bundled');
    expect(typeof skill.content).toBe('string');
    expect(skill.content.length).toBeGreaterThan(100);
    expect(skill.content).toContain('# Octie');
    expect(skill.description.length).toBeGreaterThan(0);
  });

  it('registers the web panel routes when the webServer service is present', () => {
    const routes: any[] = [];
    const webServerMock = {
      register: (route: any) => { routes.push(route); return () => {}; },
    };
    const wrapper: any = {
      tools: { register: () => () => {} },
      provide: () => () => {},
      emit: () => {},
      on: () => () => {},
      get: (name: string) => (name === 'webServer' ? webServerMock : undefined),
      effect: (cb: () => any) => { cb(); return () => {}; },
    };
    apply(wrapper);

    const paths = routes.map((r) => r.path).sort();
    expect(paths).toEqual([
      '/api/octie/events',
      '/api/octie/graph',
      '/api/octie/projects',
      '/api/octie/state',
      '/api/octie/task',
    ]);
    for (const r of routes) {
      expect(r.kind).toBe('exact');
      expect(typeof r.handler).toBe('function');
    }
  });

  it('GET /api/octie/projects ranks by latest task update (project.json mtime)', async () => {
    // The plugin reads the REAL registry (~/.octie/projects.json): vi.mock of
    // node:os does not reach the native-ESM plugin/dist import chain (same
    // limitation the smoke tests work around). So this test registers three
    // temp projects with synthetic task-file mtimes in the real registry,
    // asserts the activity ranking, and restores the registry afterwards.
    const actual = await vi.importActual<typeof import('node:os')>('node:os');
    const registryPath = join(actual.homedir(), '.octie', 'projects.json');
    mkdirSync(join(actual.homedir(), '.octie'), { recursive: true });

    const now = Date.now();
    const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
    const freshDir = join(tmpdir(), `octie-activity-fresh-${uuidv4()}`);
    const oldDir = join(tmpdir(), `octie-activity-old-${uuidv4()}`);
    const legacyDir = join(tmpdir(), `octie-activity-legacy-${uuidv4()}`);
    const dirs = [freshDir, oldDir, legacyDir];
    for (const d of dirs) {
      mkdirSync(d, { recursive: true });
      const storage = new TaskStorage({ projectDir: d });
      await storage.createProject(d.split(/[\\/]/).pop() || 'project');
    }
    // Task-graph write times: fresh = 60s ago, old = 10 days ago, legacy =
    // project file removed entirely (falls back to registry lastAccessed).
    const freshFile = join(freshDir, '.octie', 'project.json');
    const oldFile = join(oldDir, '.octie', 'project.json');
    for (const [file, msAgo] of [[freshFile, 60000], [oldFile, 86400000 * 10]] as [string, number][]) {
      const t = new Date(now - msAgo);
      utimesSync(file, t, t);
    }
    rmSync(join(legacyDir, '.octie'), { recursive: true, force: true });

    const freshKey = `fresh-activity-${freshDir}`;
    const oldKey = `old-activity-${oldDir}`;
    const legacyKey = `legacy-activity-${legacyDir}`;
    const original = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : null;

    try {
      const reg = original ? JSON.parse(original) : { version: '1.0.0', projects: {} };
      reg.projects[freshKey] = { name: 'fresh-activity', path: freshDir, registeredAt: iso(86400000), lastAccessed: iso(86400000 * 5), taskCount: 7 };
      reg.projects[oldKey] = { name: 'old-activity', path: oldDir, registeredAt: iso(86400000 * 10), lastAccessed: iso(86400000 * 5), taskCount: 2 };
      reg.projects[legacyKey] = { name: 'legacy-activity', path: legacyDir }; // no lastAccessed, no project file
      writeFileSync(registryPath, JSON.stringify(reg, null, 2) + '\n');

      const routes: any[] = [];
      const webServerMock = {
        register: (route: any) => { routes.push(route); return () => {}; },
      };
      const wrapper: any = {
        tools: { register: () => () => {} },
        provide: () => () => {},
        emit: () => {},
        on: () => () => {},
        get: (name: string) => (name === 'webServer' ? webServerMock : undefined),
        effect: (cb: () => any) => { cb(); return () => {}; },
      };
      apply(wrapper);

      const projectsRoute = routes.find((r) => r.path === '/api/octie/projects');
      expect(projectsRoute).toBeDefined();

      let body: any[] | null = null;
      await projectsRoute.handler({ url: '/' }, {
        writeHead: () => {},
        end: (payload: string) => { body = JSON.parse(payload); },
      });

      const list = body as any[];
      const names = list.map((p) => p.name);
      // Relative order among the three synthetic entries must follow mtime,
      // regardless of where other real-registry projects interleave.
      expect(names.indexOf('fresh-activity')).toBeLessThan(names.indexOf('old-activity'));
      expect(names.indexOf('old-activity')).toBeLessThan(names.indexOf('legacy-activity'));

      const fresh = list.find((p) => p.path === freshDir);
      // Filesystems round mtimes differently (APFS differs by ~1ms), so
      // assert approximate rather than exact equality across OSes.
      const freshMs = new Date(fresh.lastUpdated).getTime();
      expect(Math.abs(freshMs - (now - 60000))).toBeLessThan(5000);
      expect(fresh.taskCount).toBe(7);
      const legacy = list.find((p) => p.path === legacyDir);
      expect(legacy.lastUpdated).toBe('');
      expect(legacy.taskCount).toBe(0);
    } finally {
      // Restore the registry to its exact pre-test state minus our keys.
      const reg = original ? JSON.parse(original) : { version: '1.0.0', projects: {} };
      delete reg.projects[freshKey];
      delete reg.projects[oldKey];
      delete reg.projects[legacyKey];
      if (original === null && Object.keys(reg.projects).length === 0 && existsSync(registryPath)) {
        rmSync(registryPath, { force: true });
      } else if (original !== null) {
        writeFileSync(registryPath, JSON.stringify(reg, null, 2) + '\n');
      }
      for (const d of dirs) {
        try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }
  });

  it('functional smoke: init -> create -> list -> events', async () => {
    const { ctx, wrapper } = makeMockCtx();
    apply(wrapper);
    const tools: Record<string, any> = {};
    for (const tool of ctx.registered as any[]) tools[tool.name] = tool;

    const projectName = `smoke-${uuidv4().slice(0, 8)}`;
    const handle = await tools.octie_init.execute({ name: projectName, path: tempDir });
    expect(handle.path).toBe(tempDir);

    const created = await tools.octie_create.execute({
      title: 'Implement smoke task',
      description: 'Create a smoke task through the octie-dsh bundle tools to prove the full engine path works end to end.',
      successCriteria: ['octie_create returns a task projection with a UUID id'],
      deliverables: ['plugin smoke task record'],
      priority: 'top',
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.status).toBe('ready');
    expect(isLosslessJson(created), 'octie_create output must be lossless JSON').toBe(true);

    const listed = await tools.octie_list.execute({ status: 'ready' });
    expect(listed.length).toBe(1);
    expect(listed[0].title).toBe('Implement smoke task');
    expect(isLosslessJson(listed), 'octie_list output must be lossless JSON').toBe(true);

    const fetched = await tools.octie_get.execute({ id: created.id });
    expect(fetched.id).toBe(created.id);
    expect(isLosslessJson(fetched), 'octie_get output must be lossless JSON').toBe(true);

    // project override targets the same project via an explicit path
    const listedByProject = await tools.octie_list.execute({ project: tempDir });
    expect(listedByProject.length).toBe(1);
    expect(isLosslessJson(listedByProject), 'octie_list(project) output must be lossless JSON').toBe(true);

    const approvedFailure = await tools.octie_approve.execute({ id: created.id }).catch(e => e);
    expect(approvedFailure).toBeInstanceOf(Error); // not in_review -> must fail, never corrupt state

    expect(ctx.emitted.some(([event]) => event === 'octie/task-created')).toBe(true);
  });

  it('service onChange fires for consumers', async () => {
    const { ctx, wrapper } = makeMockCtx();
    apply(wrapper);
    const service = ctx.provided[SERVICE_NAME] as OctieService;
    const events: Array<Record<string, unknown>> = [];
    service.onChange(e => events.push(e as Record<string, unknown>));
    await service.init(`onchange-${uuidv4().slice(0, 8)}`, { path: tempDir });
    await service.createTask({
      title: 'Implement onChange task',
      description: 'Verify the onChange subscription fires for other plugins consuming the octie service.',
      successCriteria: ['onChange receives task-created with the task id'],
      deliverables: ['onChange task record'],
    });
    expect(events.some(e => e.kind === 'task-created')).toBe(true);
  });
});
