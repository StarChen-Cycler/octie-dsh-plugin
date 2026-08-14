/**
 * Tests for invalidateProjectCache skip logic: without a known server the
 * probe must not fire; with OCTIE_SERVER_URL it must fire.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

let homedirTarget = '';

vi.doMock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, homedir: () => homedirTarget };
});

describe('invalidateProjectCache', () => {
  let invalidateProjectCache: typeof import('../../../src/service/engine.js').invalidateProjectCache;
  let fetchCalls: number;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    vi.resetModules();
    homedirTarget = join(tmpdir(), `octie-cache-home-${uuidv4()}`);
    mkdirSync(homedirTarget, { recursive: true });
    invalidateProjectCache = (await import('../../src/service/engine.js')).invalidateProjectCache;
  });

  afterAll(() => {
    vi.doUnmock('node:os');
    try { rmSync(homedirTarget, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  beforeEach(() => {
    fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;
    delete process.env.OCTIE_SERVER_URL;
    delete process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.OCTIE_SERVER_URL;
  });

  it('skips the probe when no server has ever run', async () => {
    await invalidateProjectCache('C:/fake/project');
    expect(fetchCalls).toBe(0);
  });

  it('fires the probe when OCTIE_SERVER_URL is set', async () => {
    process.env.OCTIE_SERVER_URL = 'http://localhost:3999';
    await invalidateProjectCache('C:/fake/project');
    expect(fetchCalls).toBe(1);
  });

  it('fires the probe when the server-url file exists', async () => {
    mkdirSync(join(homedirTarget, '.octie'), { recursive: true });
    writeFileSync(join(homedirTarget, '.octie', '.last-server-url'), 'http://localhost:3999\n');
    await invalidateProjectCache('C:/fake/project');
    expect(fetchCalls).toBe(1);
  });
});
