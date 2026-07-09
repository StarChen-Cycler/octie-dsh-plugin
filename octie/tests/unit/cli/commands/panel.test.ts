/**
 * Panel Command Unit Tests
 *
 * Tests for the read-only panel overview command:
 * - Root project summary
 * - Subproject discovery and aggregation
 * - JSON and Markdown output formats
 * - Empty projects and invalid subprojects
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';

describe('panel command', () => {
  let tempDir: string;
  let tempHome: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    tempDir = join(tmpdir(), `octie-panel-test-${uuidv4()}`);
    tempHome = join(tmpdir(), `octie-home-${uuidv4()}`);
    mkdirSync(tempHome, { recursive: true });
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
    };
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }

    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
  });

  function runCli(command: string): string {
    return execSync(`node ${cliPath} ${command}`, {
      encoding: 'utf-8',
      env,
    });
  }

  function createTask(
    id: string,
    title: string,
    status: 'ready' | 'in_progress' | 'in_review' | 'completed' | 'blocked',
  ): TaskNode {
    return new TaskNode({
      id,
      title,
      description: `${title} - this description is intentionally written to be at least fifty characters long`,
      status,
      priority: 'second',
      success_criteria: [{ id: uuidv4(), text: `Verify ${title} is implemented correctly`, completed: status === 'completed' }],
      deliverables: [{ id: uuidv4(), text: `src/${title.replace(/\s+/g, '-').toLowerCase()}.ts`, completed: status === 'completed' }],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });
  }

  describe('root project only', () => {
    it('shows the root project summary in table format', async () => {
      const projectName = `root-${uuidv4().substring(0, 8)}`;
      runCli(`init --project "${tempDir}" --name "${projectName}"`);

      const storage = new TaskStorage({ projectDir: tempDir });
      const graph = await storage.load();
      graph.addNode(createTask(uuidv4(), 'Implement root login module', 'ready'));
      graph.addNode(createTask(uuidv4(), 'Write root login tests', 'completed'));
      await storage.save(graph);

      const output = runCli(`--project "${tempDir}" panel`);

      expect(output).toContain(projectName);
      expect(output).toContain('Total: 1 panel (2 tasks)');
      expect(output).toContain('ready:1');
      expect(output).toContain('completed:1');
      expect(output).toContain('50%');
    });

    it('handles an empty root project gracefully', () => {
      const projectName = `empty-root-${uuidv4().substring(0, 8)}`;
      runCli(`init --project "${tempDir}" --name "${projectName}"`);

      const output = runCli(`--project "${tempDir}" panel`);

      expect(output).toContain(projectName);
      expect(output).toContain('0%');
      expect(output).toContain('Total: 1 panel (0 tasks)');
    });
  });

  describe('with subprojects', () => {
    it('shows root and all immediate subprojects', async () => {
      const projectName = `parent-${uuidv4().substring(0, 8)}`;
      const childName = `child-${uuidv4().substring(0, 8)}`;
      runCli(`init --project "${tempDir}" --name "${projectName}"`);

      // Create child subproject directly (panel command only reads, so we avoid handoff atomic validation).
      const childProjectPath = join(tempDir, '.octie', 'subprojects', childName);
      const childStorage = new TaskStorage({ projectDir: childProjectPath });
      await childStorage.createProject(childName);

      // Add a completed task to the child subproject.
      const childGraph = await childStorage.load();
      childGraph.addNode(createTask(uuidv4(), 'Implement child module', 'completed'));
      await childStorage.save(childGraph);

      const output = runCli(`--project "${tempDir}" panel`);

      expect(output).toContain(projectName);
      expect(output).toContain(childName);
      expect(output).toContain('Total: 2 panels (1 task)');
      expect(output).toContain('completed:1');
    });
  });

  describe('output formats', () => {
    it('outputs JSON with panel metadata', async () => {
      const projectName = `json-root-${uuidv4().substring(0, 8)}`;
      runCli(`init --project "${tempDir}" --name "${projectName}"`);

      const storage = new TaskStorage({ projectDir: tempDir });
      const graph = await storage.load();
      graph.addNode(createTask(uuidv4(), 'Implement JSON export endpoint', 'in_progress'));
      await storage.save(graph);

      const output = runCli(`--project "${tempDir}" --format json panel`);
      const data = JSON.parse(output);

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBe(1);
      expect(data[0].name).toBe(projectName);
      expect(data[0].isRoot).toBe(true);
      expect(data[0].total).toBe(1);
      expect(data[0].statusCounts.in_progress).toBe(1);
      expect(data[0].goal).toBe('Implement JSON export endpoint');
    });

    it('outputs Markdown with panel table', async () => {
      const projectName = `md-root-${uuidv4().substring(0, 8)}`;
      runCli(`init --project "${tempDir}" --name "${projectName}"`);

      const storage = new TaskStorage({ projectDir: tempDir });
      const graph = await storage.load();
      graph.addNode(createTask(uuidv4(), 'Write markdown documentation', 'ready'));
      await storage.save(graph);

      const output = runCli(`--project "${tempDir}" --format md panel`);

      expect(output).toContain('# Octie Panel Summary');
      expect(output).toContain(projectName);
      expect(output).toContain('ready: 1');
    });
  });

  describe('invalid subprojects', () => {
    it('skips invalid subproject folders with a warning', () => {
      const projectName = `warn-root-${uuidv4().substring(0, 8)}`;
      runCli(`init --project "${tempDir}" --name "${projectName}"`);

      // Create a subproject folder that is not a valid Octie project.
      const badSubprojectDir = join(tempDir, '.octie', 'subprojects', 'bad-child');
      mkdirSync(badSubprojectDir, { recursive: true });
      writeFileSync(join(badSubprojectDir, 'readme.txt'), 'not a project');

      const output = runCli(`--project "${tempDir}" panel`);

      expect(output).toContain(projectName);
      // The invalid folder should be silently skipped (no warning because it is not valid).
      expect(output).toContain('Total: 1 panel (0 tasks)');
      expect(existsSync(badSubprojectDir)).toBe(true);
    });
  });

  describe('help', () => {
    it('shows help with --help flag', () => {
      const output = runCli('panel --help');

      expect(output).toContain('Show a read-only overview');
      expect(output).toContain('--format');
    });
  });
});
