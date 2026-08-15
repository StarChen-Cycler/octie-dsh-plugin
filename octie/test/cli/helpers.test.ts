/**
 * Tests for CLI helpers — getProjectPath, loadGraph
 */

import { describe, it, expect, vi } from 'vitest';
import { getProjectPath, loadGraph } from '../../src/cli/utils/helpers.js';
import { registerProject } from '../../src/core/registry/index.js';
import { TaskStorage } from '../../src/core/storage/file-store.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

function makeTempDir(): string {
  const dir = join(tmpdir(), `octie-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('getProjectPath', () => {
  it('auto-detects project from cwd when no --project given', async () => {
    // Self-contained: create a real project in a temp dir and point process.cwd
    // at it, so the test does not depend on the repo checkout having .octie/
    // (which is gitignored and absent on CI). Mocking process.cwd avoids
    // process.chdir(), which is unsupported inside vitest worker threads.
    const dir = makeTempDir();
    const projectDir = join(dir, 'myproject');
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
    try {
      mkdirSync(join(projectDir, '.octie'), { recursive: true });
      const storage = new TaskStorage({ projectDir });
      await storage.createProject('autodetect-test');

      const result = await getProjectPath();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toBe(projectDir);
    } finally {
      cwdSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('getProjectPath --project .octie (Issue #1)', () => {
  it('resolves --project <parent-of-.octie> to parent directory', async () => {
    const dir = makeTempDir();
    try {
      // Create a minimal project in a subdirectory
      const projectDir = join(dir, 'myproject');
      const octieDir = join(projectDir, '.octie');
      mkdirSync(octieDir, { recursive: true });

      // Create project.json so storage.exists() returns true
      const storage = new TaskStorage({ projectDir });
      await storage.createProject('testproj');

      // Now pass the PARENT directory (normal case)
      const result = await getProjectPath(projectDir);
      expect(result).toBe(projectDir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('getProjectPath --project . (Issue #1)', () => {
  it('treats --project . as cwd and auto-detects', async () => {
    // --project . resolves to the current working directory.
    // If PWD contains an Octie project, auto-detection kicks in.
    // Self-contained: create the project in a temp dir and point process.cwd
    // at it so the test passes on CI where the repo checkout has no .octie/.
    const dir = makeTempDir();
    const projectDir = join(dir, 'myproject');
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
    try {
      mkdirSync(join(projectDir, '.octie'), { recursive: true });
      const storage = new TaskStorage({ projectDir });
      await storage.createProject('dot-project-test');

      const result = await getProjectPath('.');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toBe(projectDir);
    } finally {
      cwdSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadGraph error messages (Issue #6)', () => {
  it('includes hint when user passes .octie dir itself', async () => {
    const dir = makeTempDir();
    try {
      const octieDir = join(dir, '.octie');
      mkdirSync(octieDir, { recursive: true });
      // loadGraph will fail at this path — check error includes the hint
      await expect(loadGraph(dir)).rejects.toThrow();
      try {
        await loadGraph(dir);
      } catch (err: any) {
        expect(err.message).toContain('No Octie project found');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('error message includes path in error', async () => {
    const nonExistent = join(tmpdir(), `definitely-not-a-project-${randomUUID()}`);
    await expect(loadGraph(nonExistent)).rejects.toThrow();
    try {
      await loadGraph(nonExistent);
    } catch (err: any) {
      expect(err.message).toContain('No Octie project found at');
      expect(err.message).toContain(nonExistent);
    }
  });
});

describe('getProjectPath with .octie subdir passed directly', () => {
  it('handles --project path/to/.octie by resolving to parent', async () => {
    const dir = makeTempDir();
    try {
      const projectDir = join(dir, 'subproject');
      mkdirSync(join(projectDir, '.octie'), { recursive: true });

      const storage = new TaskStorage({ projectDir });
      await storage.createProject('subproj');

      // Pass the .octie directory itself
      const octiePath = join(projectDir, '.octie');
      const result = await getProjectPath(octiePath);
      expect(result).toBe(projectDir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws helpful error when .octie dir exists but no project inside', async () => {
    const dir = makeTempDir();
    try {
      const projectDir = join(dir, 'empty');
      // Create .octie dir but NO project.json inside
      mkdirSync(join(projectDir, '.octie'), { recursive: true });
      const octiePath = join(projectDir, '.octie');

      try {
        await getProjectPath(octiePath);
        // Should have thrown
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.message).toContain('Tip: For the root project, omit --project');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
