/**
 * Tests for the octie-dsh bundle Node half (plugin/index.mjs).
 *
 * Covers:
 *  - named exports (name / inject / apply)
 *  - OctieService provides all 17 methods from design doc section 9.4
 *  - 13 octie_* tools registered with JSON parameters
 *  - functional smoke: init -> create -> list -> events through the tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { apply, OctieService, TOOL_NAMES, SERVICE_NAME, name, inject } from '../../../plugin/index.mjs';

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

describe('octie-dsh bundle Node half', () => {
  let tempDir: string;
  let tempHome: string;
  let oldHome: string | undefined;
  let oldUserProfile: string | undefined;

  beforeEach(() => {
    tempDir = join(tmpdir(), `octie-plugin-test-${uuidv4()}`);
    tempHome = join(tmpdir(), `octie-plugin-home-${uuidv4()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(tempHome, { recursive: true });
    oldHome = process.env.HOME;
    oldUserProfile = process.env.USERPROFILE;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
  });

  afterEach(() => {
    process.env.HOME = oldHome;
    process.env.USERPROFILE = oldUserProfile;
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(tempHome, { recursive: true, force: true }); } catch { /* ignore */ }
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

  it('functional smoke: init -> create -> list -> events', async () => {
    const { ctx, wrapper } = makeMockCtx();
    apply(wrapper);
    const tools: Record<string, any> = {};
    for (const tool of ctx.registered as any[]) tools[tool.name] = tool;

    const handle = await tools.octie_init.execute({ name: 'smoke-project', path: tempDir });
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

    const listed = await tools.octie_list.execute({ status: 'ready' });
    expect(listed.length).toBe(1);
    expect(listed[0].title).toBe('Implement smoke task');

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
    await service.init('onchange-project', { path: tempDir });
    await service.createTask({
      title: 'Implement onChange task',
      description: 'Verify the onChange subscription fires for other plugins consuming the octie service.',
      successCriteria: ['onChange receives task-created with the task id'],
      deliverables: ['onChange task record'],
    });
    expect(events.some(e => e.kind === 'task-created')).toBe(true);
  });
});
