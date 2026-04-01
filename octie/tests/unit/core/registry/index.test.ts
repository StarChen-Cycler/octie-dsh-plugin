import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';

describe('global registry', () => {
  let tempHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let originalHomeDrive: string | undefined;
  let originalHomePath: string | undefined;

  beforeEach(() => {
    vi.resetModules();

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
  });

  afterEach(() => {
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

    rmSync(tempHome, { recursive: true, force: true });
  });

  it('prunes stale registry entries when listing projects', async () => {
    const validProjectDir = join(tmpdir(), `octie-valid-project-${uuidv4()}`);
    const missingProjectDir = join(tmpdir(), `octie-missing-project-${uuidv4()}`);
    const registryPath = join(tempHome, '.octie', 'projects.json');

    try {
      const storage = new TaskStorage({ projectDir: validProjectDir });
      await storage.createProject('valid-project');

      writeFileSync(
        registryPath,
        JSON.stringify({
          version: '1.0.0',
          projects: {
            'valid-project': {
              path: validProjectDir,
              name: 'valid-project',
              registeredAt: '2026-03-23T00:00:00.000Z',
              lastAccessed: '2026-03-23T00:00:00.000Z',
              taskCount: 0,
            },
            'missing-project': {
              path: missingProjectDir,
              name: 'missing-project',
              registeredAt: '2026-03-23T00:00:00.000Z',
              lastAccessed: '2026-03-23T00:00:00.000Z',
              taskCount: 0,
            },
          },
        }, null, 2),
        'utf-8'
      );

      const { getAllProjects, getAllProjectsRaw, loadRegistry, verifyProjectExists } = await import(
        '../../../../src/core/registry/index.js'
      );

      const rawProjects = getAllProjectsRaw();
      const projects = getAllProjects();
      const registryAfterRead = loadRegistry();

      expect(rawProjects).toHaveLength(2);
      expect(projects).toHaveLength(1);
      expect(registryAfterRead.projects['valid-project']).toBeDefined();
      expect(registryAfterRead.projects['missing-project']).toBeUndefined();
      expect(verifyProjectExists(registryAfterRead.projects['valid-project']!)).toBe(true);
    } finally {
      rmSync(validProjectDir, { recursive: true, force: true });
    }
  });

  it('does not overwrite a different project that shares the same name', async () => {
    const projectDirA = join(tmpdir(), `octie-project-a-${uuidv4()}`);
    const projectDirB = join(tmpdir(), `octie-project-b-${uuidv4()}`);

    try {
      await new TaskStorage({ projectDir: projectDirA }).createProject('shared-name');
      await new TaskStorage({ projectDir: projectDirB }).createProject('shared-name');

      const { registerProject, loadRegistry } = await import(
        '../../../../src/core/registry/index.js'
      );

      registerProject(projectDirA);
      registerProject(projectDirB);

      const registry = loadRegistry();
      const entries = Object.entries(registry.projects);
      const paths = entries.map(([, project]) => project.path);
      const names = entries.map(([, project]) => project.name);

      expect(entries).toHaveLength(2);
      expect(paths).toContain(projectDirA);
      expect(paths).toContain(projectDirB);
      expect(names).toEqual(['shared-name', 'shared-name']);
      expect(registry.projects['shared-name']?.path).toBe(projectDirA);
      expect(registry.projects['shared-name#2']?.path).toBe(projectDirB);
    } finally {
      rmSync(projectDirA, { recursive: true, force: true });
      rmSync(projectDirB, { recursive: true, force: true });
    }
  });

  it('does not overwrite a corrupt registry snapshot during auto-registration', async () => {
    const projectDir = join(tmpdir(), `octie-corrupt-project-${uuidv4()}`);
    const registryPath = join(tempHome, '.octie', 'projects.json');

    try {
      await new TaskStorage({ projectDir: projectDir }).createProject('safe-project');

      const corruptContent = '{"version":"1.0.0","projects":';
      writeFileSync(registryPath, corruptContent, 'utf-8');

      const { registerProject } = await import('../../../../src/core/registry/index.js');

      const result = registerProject(projectDir);
      const registryAfterAttempt = readFileSync(registryPath, 'utf-8');

      expect(result).toBeNull();
      expect(registryAfterAttempt).toBe(corruptContent);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
