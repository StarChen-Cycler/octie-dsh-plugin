/**
 * Tests for pruneStaleProjects (global registry hygiene).
 *
 * node:os.homedir is mocked (repo registry-test pattern) so the real
 * ~/.octie/projects.json is never touched.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

let homedirTarget = '';

vi.doMock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, homedir: () => homedirTarget };
});

let pruneStaleProjects: typeof import('../../../../src/core/registry/index.js').pruneStaleProjects;
let loadRegistry: typeof import('../../../../src/core/registry/index.js').loadRegistry;

describe('pruneStaleProjects', () => {
  let liveDir: string;
  let deadDir: string;

  beforeAll(async () => {
    vi.resetModules();
    homedirTarget = join(tmpdir(), `octie-prune-home-${uuidv4()}`);
    mkdirSync(homedirTarget, { recursive: true });
    const mod = await import('../../../../src/core/registry/index.js');
    pruneStaleProjects = mod.pruneStaleProjects;
    loadRegistry = mod.loadRegistry;
  });

  afterAll(() => {
    vi.doUnmock('node:os');
    try { rmSync(homedirTarget, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('removes entries whose path is gone and keeps live ones', () => {
    liveDir = join(tmpdir(), `octie-prune-live-${uuidv4()}`);
    deadDir = join(tmpdir(), `octie-prune-dead-${uuidv4()}`);
    mkdirSync(liveDir, { recursive: true });

    const registry = {
      version: '1.0.0',
      projects: {
        live: {
          path: liveDir, name: 'live-project',
          registeredAt: new Date().toISOString(), lastAccessed: new Date().toISOString(), taskCount: 1,
        },
        dead: {
          path: deadDir, name: 'dead-project',
          registeredAt: new Date().toISOString(), lastAccessed: new Date().toISOString(), taskCount: 1,
        },
      },
    };

    const result = pruneStaleProjects(registry);
    expect(result.removed.length).toBe(1);
    expect(result.removed[0]!.path).toBe(deadDir);

    const persisted = loadRegistry();
    expect(persisted.projects.live).toBeDefined();
    expect(persisted.projects.dead).toBeUndefined();

    rmSync(liveDir, { recursive: true, force: true });
  });

  it('is a no-op with zero changes when nothing is stale', () => {
    const keepDir = join(tmpdir(), `octie-prune-keep-${uuidv4()}`);
    mkdirSync(keepDir, { recursive: true });
    const registry = {
      version: '1.0.0',
      projects: {
        keep: {
          path: keepDir, name: 'keep-project',
          registeredAt: new Date().toISOString(), lastAccessed: new Date().toISOString(), taskCount: 0,
        },
      },
    };
    const result = pruneStaleProjects(registry);
    expect(result.removed.length).toBe(0);
    expect(result.kept).toBe(1);
    rmSync(keepDir, { recursive: true, force: true });
  });
});
