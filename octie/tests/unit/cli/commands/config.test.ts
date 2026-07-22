/**
 * Config Command & Sticky Format Tests
 *
 * Tests for:
 * - octie config set/get format (writes .octie/config.json, preserves other keys, validates values)
 * - Sticky format resolution: config default honored, explicit --format wins, table fallback
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'node:child_process';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';

describe('config command and sticky format', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;
  let testTaskId: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
    configPath = join(tempDir, '.octie', 'config.json');

    const graph = await storage.load();
    testTaskId = uuidv4();
    const task = new TaskNode({
      id: testTaskId,
      title: 'Implement login endpoint',
      description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
      status: 'ready',
      priority: 'second',
      success_criteria: [
        { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
      ],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });
    graph.addNode(task);
    await storage.save(graph);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const run = (args: string): string =>
    execSync(`node ${cliPath} --project "${tempDir}" ${args}`, { encoding: 'utf-8' });

  describe('config set/get', () => {
    it('should write format to config.json preserving pre-existing keys', () => {
      writeFileSync(configPath, JSON.stringify({ otherKey: 'keep-me' }, null, 2));

      const output = run('config set format md');

      expect(output).toContain('format = md');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.format).toBe('md');
      expect(config.otherKey).toBe('keep-me');
    });

    it('should reject an invalid format value', () => {
      let exitCode = 0;
      let errorMsg = '';
      try {
        run('config set format yaml');
      } catch (err: any) {
        exitCode = err.status;
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(exitCode).toBe(1);
      expect(errorMsg).toContain('Invalid format');
    });

    it('should print the effective format via config get', () => {
      run('config set format md');

      const output = run('config get format');

      expect(output).toContain('format = md');
    });
  });

  describe('sticky format resolution', () => {
    it('should emit markdown from octie list when config format is md and no --format passed', () => {
      run('config set format md');

      const output = run('list');

      expect(output.startsWith('# Tasks')).toBe(true);
    });

    it('should let explicit --format json override the config value in all 5 consuming commands', () => {
      run('config set format md');

      expect(() => JSON.parse(run('--format json list'))).not.toThrow();
      expect(() => JSON.parse(run(`--format json get ${testTaskId}`))).not.toThrow();
      expect(() => JSON.parse(run('--format json find --search login'))).not.toThrow();
      expect(() => JSON.parse(run('--format json history list'))).not.toThrow();
      expect(() => JSON.parse(run('--format json panel'))).not.toThrow();
    });

    it('should fall back to table output when config.json is absent', () => {
      const output = run('list');

      expect(output.startsWith('# Tasks')).toBe(false);
      expect(() => JSON.parse(output)).toThrow();
    });

    it('should fall back to table output when config.json is malformed', () => {
      writeFileSync(configPath, '{ not valid json');

      const output = run('list');

      expect(output.startsWith('# Tasks')).toBe(false);
      expect(() => JSON.parse(output)).toThrow();
    });
  });
});
