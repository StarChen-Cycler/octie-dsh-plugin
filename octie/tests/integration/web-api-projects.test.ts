/**
 * Web API Projects Registry Integration Tests
 *
 * Tests for the global project registry endpoints including:
 * - GET /api/projects auto-registration of on-disk subprojects
 * - Subproject discovery under .octie/subprojects/
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { WebServer } from '../../src/web/server.js';
import { TaskStorage } from '../../src/core/storage/file-store.js';

describe('Web API Project Registry Integration Tests', () => {
  let tempDir: string;
  let tempHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let originalHomeDrive: string | undefined;
  let originalHomePath: string | undefined;

  beforeEach(async () => {
    vi.resetModules();

    tempDir = join(tmpdir(), `octie-api-projects-test-${uuidv4()}`);
    tempHome = join(tmpdir(), `octie-registry-home-${uuidv4()}`);
    mkdirSync(join(tempHome, '.octie'), { recursive: true });

    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        homedir: () => tempHome,
      };
    });

    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    originalHomeDrive = process.env.HOMEDRIVE;
    originalHomePath = process.env.HOMEPATH;

    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    process.env.HOMEDRIVE = tempHome.slice(0, 2);
    process.env.HOMEPATH = tempHome.slice(2);

    // Create root project and load graph
    const storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('root-project');
    const graph = await storage.load();

    // Register the root project so the endpoint has a parent to scan.
    const { registerProject } = await import('../../src/core/registry/index.js');
    registerProject(tempDir);

    // Create WebServer instance without starting it
    const { WebServer: MockedWebServer } = await import('../../src/web/server.js');
    const server = new MockedWebServer(tempDir, { logging: false, cors: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any)._graph = graph;

    thisApp = server.app;
  });

  afterEach(async () => {
    vi.doUnmock('node:os');

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    if (originalHomeDrive === undefined) {
      delete process.env.HOMEDRIVE;
    } else {
      process.env.HOMEDRIVE = originalHomeDrive;
    }

    if (originalHomePath === undefined) {
      delete process.env.HOMEPATH;
    } else {
      process.env.HOMEPATH = originalHomePath;
    }

    rmSync(tempDir, { recursive: true, force: true });
    rmSync(tempHome, { recursive: true, force: true });
  });

  let thisApp: express.Express;

  it('GET /api/projects auto-registers valid subprojects that exist only on disk', async () => {
    const subprojectName = 'unregistered-child';
    const subprojectPath = join(tempDir, '.octie', 'subprojects', subprojectName);

    // Create a subproject on disk without registering it in the global registry.
    const childStorage = new TaskStorage({ projectDir: subprojectPath });
    await childStorage.createProject(subprojectName);

    const response = await request(thisApp)
      .get('/api/projects')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.projects).toBeInstanceOf(Array);

    const paths = response.body.data.projects.map((p: { path: string }) => p.path);
    expect(paths).toContain(tempDir);
    expect(paths).toContain(subprojectPath);
  });

  it('GET /api/projects ignores non-Octie folders under .octie/subprojects/', async () => {
    const bogusSubprojectPath = join(tempDir, '.octie', 'subprojects', 'not-a-project');
    mkdirSync(bogusSubprojectPath, { recursive: true });
    writeFileSync(join(bogusSubprojectPath, 'readme.txt'), 'not an octie project', 'utf-8');

    const response = await request(thisApp)
      .get('/api/projects')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    const paths = response.body.data.projects.map((p: { path: string }) => p.path);
    expect(paths).toContain(tempDir);
    expect(paths).not.toContain(bogusSubprojectPath);
  });

  it('GET /api/projects does not duplicate already-registered subprojects', async () => {
    const subprojectName = 'registered-child';
    const subprojectPath = join(tempDir, '.octie', 'subprojects', subprojectName);

    const childStorage = new TaskStorage({ projectDir: subprojectPath });
    await childStorage.createProject(subprojectName);

    // Pre-register the subproject manually.
    const { registerProject } = await import('../../src/core/registry/index.js');
    registerProject(subprojectPath);

    const response = await request(thisApp)
      .get('/api/projects')
      .expect('Content-Type', /json/)
      .expect(200);

    const matches = response.body.data.projects.filter(
      (p: { path: string }) => p.path === subprojectPath,
    );
    expect(matches).toHaveLength(1);
  });
});
