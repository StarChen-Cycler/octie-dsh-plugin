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
import { existsSync, mkdirSync, rmSync, readFileSync, appendFileSync, utimesSync, writeFileSync } from 'node:fs';
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
  let originalProvisionHook: string | undefined;

  beforeAll(() => {
    homedirTarget = join(tmpdir(), `octie-plugin-home-${uuidv4()}`);
    mkdirSync(homedirTarget, { recursive: true });
    // Keep the real DSH home free of preset writes during this suite; the
    // two provisioning tests below clear the hook around their own applies.
    originalProvisionHook = process.env.OCTIE_NO_PRESET_PROVISION;
    process.env.OCTIE_NO_PRESET_PROVISION = '1';
  });

  afterAll(() => {
    if (originalProvisionHook === undefined) {
      delete process.env.OCTIE_NO_PRESET_PROVISION;
    } else {
      process.env.OCTIE_NO_PRESET_PROVISION = originalProvisionHook;
    }
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
      '/api/octie/preset/status',
      '/api/octie/preset/update',
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

  it('GET /api/octie/events polls external file changes and emits external-change events', async () => {
    vi.useFakeTimers();
    const actual = await vi.importActual<typeof import('node:os')>('node:os');
    const registryPath = join(actual.homedir(), '.octie', 'projects.json');
    mkdirSync(join(actual.homedir(), '.octie'), { recursive: true });
    const originalRegistry = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : null;
    const dir = join(tmpdir(), `octie-events-test-${uuidv4()}`);
    const closeHandlers: Array<() => void> = [];
    try {
      if (originalRegistry === null) {
        writeFileSync(registryPath, JSON.stringify({ version: '1.0.0', projects: {} }, null, 2) + '\n');
      }
      mkdirSync(dir, { recursive: true });
      const storage = new TaskStorage({ projectDir: dir });
      await storage.createProject('events-test');
      const projectFile = join(dir, '.octie', 'project.json');

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

      const eventsRoute = routes.find((r) => r.path === '/api/octie/events');
      expect(eventsRoute).toBeDefined();

      const writes: string[] = [];
      const res = {
        writeHead: () => {},
        write: (chunk: string) => { writes.push(chunk); },
        end: () => {},
        on: (ev: string, fn: () => void) => { if (ev === 'close') closeHandlers.push(fn); },
      };
      const req = {
        url: `/?project=${encodeURIComponent(dir)}`,
        on: (ev: string, fn: () => void) => { if (ev === 'close') closeHandlers.push(fn); },
      };
      eventsRoute.handler(req, res);
      expect(writes[0]).toContain(': connected');

      // External task write: bump project.json mtime → one tasks-scope event.
      const future = new Date(Date.now() + 5000);
      utimesSync(projectFile, future, future);
      vi.advanceTimersByTime(3000);
      const taskEvents = writes.filter((w) => w.includes('"kind":"external-change"') && w.includes('"scope":"tasks"'));
      expect(taskEvents).toHaveLength(1);
      // SSE payloads JSON-escape backslashes in the path.
      expect(taskEvents[0]).toContain(JSON.stringify(dir).slice(1, -1));

      // No further event while nothing changed.
      vi.advanceTimersByTime(3000);
      expect(writes.filter((w) => w.includes('"scope":"tasks"'))).toHaveLength(1);

      // External registry write: rewrite identical bytes → mtime bump → projects-scope event.
      // (>=1: other test files may legitimately write the registry concurrently.)
      const registry = readFileSync(registryPath, 'utf8');
      writeFileSync(registryPath, registry);
      vi.advanceTimersByTime(3000);
      const projectEvents = writes.filter((w) => w.includes('"kind":"external-change"') && w.includes('"scope":"projects"'));
      expect(projectEvents.length).toBeGreaterThanOrEqual(1);
    } finally {
      closeHandlers.forEach((fn) => fn());
      vi.useRealTimers();
      if (originalRegistry === null) {
        try { rmSync(registryPath, { force: true }); } catch { /* ignore */ }
      } else {
        writeFileSync(registryPath, originalRegistry);
      }
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('provisions the octie agent preset into DSH_HOME on load, idempotently', () => {
    const origHome = process.env.DSH_HOME;
    const origHook = process.env.OCTIE_NO_PRESET_PROVISION;
    const fakeHome = join(tmpdir(), `octie-dshhome-${uuidv4()}`);
    mkdirSync(fakeHome, { recursive: true });
    process.env.DSH_HOME = fakeHome;
    delete process.env.OCTIE_NO_PRESET_PROVISION;
    try {
      const wrapper: any = {
        tools: { register: () => () => {} },
        provide: () => () => {},
        emit: () => {},
        on: () => () => {},
        get: () => undefined,
        effect: (cb: () => any) => { cb(); return () => {}; },
      };
      apply(wrapper);

      const presetDir = join(fakeHome, '.agent-presets', 'octie');
      expect(existsSync(join(presetDir, 'agent.cordis.yml'))).toBe(true);
      expect(existsSync(join(presetDir, 'preset.yml'))).toBe(true);
      const composition = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8');
      expect(composition).toContain('- id: persona');
      expect(composition).toContain('Core workflow');
      expect(readFileSync(join(presetDir, 'preset.yml'), 'utf8')).toContain('Octie 任务图模式');

      // Idempotent: a later load never overwrites user edits.
      appendFileSync(join(presetDir, 'agent.cordis.yml'), '\n# user marker\n');
      apply(wrapper);
      expect(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')).toContain('user marker');
    } finally {
      if (origHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = origHome;
      if (origHook === undefined) delete process.env.OCTIE_NO_PRESET_PROVISION; else process.env.OCTIE_NO_PRESET_PROVISION = origHook;
      try { rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('skips provisioning when the roster already supplies the preset id', async () => {
    const origHome = process.env.DSH_HOME;
    const origHook = process.env.OCTIE_NO_PRESET_PROVISION;
    const fakeHome = join(tmpdir(), `octie-dshhome-${uuidv4()}`);
    mkdirSync(fakeHome, { recursive: true });
    process.env.DSH_HOME = fakeHome;
    delete process.env.OCTIE_NO_PRESET_PROVISION;
    try {
      let listed = false;
      const wrapper: any = {
        tools: { register: () => () => {} },
        provide: () => () => {},
        emit: () => {},
        on: () => () => {},
        get: (name: string) => (name === 'agentPresets'
          ? { list: async () => { listed = true; return [{ id: 'octie' }]; } }
          : undefined),
        effect: (cb: () => any) => { cb(); return () => {}; },
      };
      apply(wrapper);
      await new Promise((resolve) => setTimeout(resolve, 0)); // flush the roster probe

      expect(listed).toBe(true);
      expect(existsSync(join(fakeHome, '.agent-presets', 'octie', 'agent.cordis.yml'))).toBe(false);
    } finally {
      if (origHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = origHome;
      if (origHook === undefined) delete process.env.OCTIE_NO_PRESET_PROVISION; else process.env.OCTIE_NO_PRESET_PROVISION = origHook;
      try { rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  describe('preset maintenance routes', () => {
    let fakeHome: string;
    let origHome: string | undefined;

    beforeEach(() => {
      origHome = process.env.DSH_HOME;
      fakeHome = join(tmpdir(), `octie-preset-home-${uuidv4()}`);
      mkdirSync(fakeHome, { recursive: true });
      process.env.DSH_HOME = fakeHome;
    });

    afterEach(() => {
      if (origHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = origHome;
      try { rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    function makeWrapper() {
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
      return { routes, wrapper };
    }

    function findRoute(routes: any[], path: string) {
      const r = routes.find((x) => x.path === path);
      expect(r, `route ${path} registered`).toBeDefined();
      return r;
    }

    async function call(handler: any): Promise<{ status?: number; body: any }> {
      let status: number | undefined;
      let body: any;
      await handler({ url: '/' }, {
        writeHead: (code: number) => { status = code; },
        end: (payload: string) => { body = JSON.parse(payload); },
      });
      return { status, body };
    }

    function provision(): any[] {
      const { routes, wrapper } = makeWrapper();
      const origHook = process.env.OCTIE_NO_PRESET_PROVISION;
      delete process.env.OCTIE_NO_PRESET_PROVISION;
      try {
        apply(wrapper);
      } finally {
        if (origHook === undefined) delete process.env.OCTIE_NO_PRESET_PROVISION;
        else process.env.OCTIE_NO_PRESET_PROVISION = origHook;
      }
      return routes;
    }

    it('status reports not-provisioned before any provisioning', async () => {
      const { routes, wrapper } = makeWrapper();
      apply(wrapper); // suite-wide hook keeps provisioning off

      const { body } = await call(findRoute(routes, '/api/octie/preset/status').handler);
      expect(body.provisioned).toBe(false);
      expect(body.updateAvailable).toBe(false);
      expect(body.bundledVersion).toBeGreaterThanOrEqual(1);
      expect(body.drifted).toBe(false);
    });

    it('provisioning stamps the copy and status then reports up-to-date', async () => {
      const routes = provision();
      const targetDir = join(fakeHome, '.agent-presets', 'octie');
      expect(existsSync(join(targetDir, '.octie-template.json'))).toBe(true);

      const { body } = await call(findRoute(routes, '/api/octie/preset/status').handler);
      expect(body.provisioned).toBe(true);
      expect(body.installedVersion).toBe(body.bundledVersion);
      expect(body.drifted).toBe(false);
      expect(body.updateAvailable).toBe(false);
      expect(body.path).toBe(targetDir);
    });

    it('flags drift after user edits, and update resets it', async () => {
      const routes = provision();
      const targetDir = join(fakeHome, '.agent-presets', 'octie');
      appendFileSync(join(targetDir, 'agent.cordis.yml'), '\n# user marker\n');

      const drifted = await call(findRoute(routes, '/api/octie/preset/status').handler);
      expect(drifted.body.drifted).toBe(true);
      expect(drifted.body.updateAvailable).toBe(true);

      const updated = await call(findRoute(routes, '/api/octie/preset/update').handler);
      expect(updated.status).toBe(200);
      expect(updated.body.provisioned).toBe(true);
      expect(updated.body.drifted).toBe(false);
      expect(updated.body.updateAvailable).toBe(false);
      expect(readFileSync(join(targetDir, 'agent.cordis.yml'), 'utf8')).not.toContain('user marker');

      // No update left: a second POST must refuse with an explicit error.
      const refused = await call(findRoute(routes, '/api/octie/preset/update').handler);
      expect(refused.status).toBe(409);
      expect(refused.body.error).toContain('no update available');
    });

    it('treats a legacy unversioned copy as updateable and restamps it', async () => {
      const routes = provision();
      const targetDir = join(fakeHome, '.agent-presets', 'octie');
      // Legacy copy: no stamp sidecar, no templateVersion field.
      rmSync(join(targetDir, '.octie-template.json'), { force: true });
      writeFileSync(join(targetDir, 'preset.yml'), 'name: Octie 任务图模式\n');

      const legacy = await call(findRoute(routes, '/api/octie/preset/status').handler);
      expect(legacy.body.drifted).toBe(null);
      expect(legacy.body.installedVersion).toBe(0);
      expect(legacy.body.updateAvailable).toBe(true);

      const updated = await call(findRoute(routes, '/api/octie/preset/update').handler);
      expect(updated.body.installedVersion).toBe(updated.body.bundledVersion);
      expect(updated.body.drifted).toBe(false);
      expect(existsSync(join(targetDir, '.octie-template.json'))).toBe(true);
    });
  });

  it('GET /api/octie/events pushes instantly when the .octie directory changes (fs.watch)', async () => {
    vi.useRealTimers();
    const dir = join(tmpdir(), `octie-watch-test-${uuidv4()}`);
    mkdirSync(dir, { recursive: true });
    const storage = new TaskStorage({ projectDir: dir });
    await storage.createProject('watch-test');
    const projectFile = join(dir, '.octie', 'project.json');
    const closeHandlers: Array<() => void> = [];
    try {
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

      const eventsRoute = routes.find((r) => r.path === '/api/octie/events');
      expect(eventsRoute).toBeDefined();

      const writes: string[] = [];
      const res = {
        writeHead: () => {},
        write: (chunk: string) => { writes.push(chunk); },
        end: () => {},
        on: (ev: string, fn: () => void) => { if (ev === 'close') closeHandlers.push(fn); },
      };
      const req = {
        url: `/?project=${encodeURIComponent(dir)}`,
        on: (ev: string, fn: () => void) => { if (ev === 'close') closeHandlers.push(fn); },
      };
      eventsRoute.handler(req, res);
      expect(writes[0]).toContain(': connected');

      // Any write into the project's .octie directory must push within ~1s
      // (fs.watch), well before the 3s fallback poll would fire.
      writeFileSync(projectFile, readFileSync(projectFile, 'utf8') + '\n');
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        if (writes.some((w) => w.includes('"kind":"external-change"') && w.includes('"scope":"tasks"'))) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const taskEvents = writes.filter((w) => w.includes('"kind":"external-change"') && w.includes('"scope":"tasks"'));
      expect(taskEvents.length).toBeGreaterThanOrEqual(1);
      expect(taskEvents[0]).toContain(JSON.stringify(dir).slice(1, -1));
    } finally {
      closeHandlers.forEach((fn) => fn());
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
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
