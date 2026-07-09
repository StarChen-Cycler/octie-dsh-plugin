/**
 * Export Command Unit Tests
 *
 * Tests for export command including:
 * - JSON export
 * - Markdown export
 * - Custom output path
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { execSync } from 'node:child_process';

describe('export command', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;
  let exportDir: string;

  beforeEach(async () => {
    // Create unique temp directories
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    exportDir = join(tmpdir(), `octie-export-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');

    // CLI entry point
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    // Create test tasks
    const graph = await storage.load();

    const task1 = new TaskNode({
      id: uuidv4(),
      title: 'Implement login',
      description: 'Create login endpoint with JWT authentication for secure user access',
      status: 'in_progress',
      priority: 'top',
      success_criteria: [
        { id: uuidv4(), text: 'Login endpoint returns JWT', completed: true },
        { id: uuidv4(), text: 'Invalid credentials return 401', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'login.ts', completed: true },
        { id: uuidv4(), text: 'login.test.ts', completed: false },
      ],
      blockers: [],
      dependencies: '',
      related_files: ['src/auth/'],
      notes: 'Use bcrypt',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });

    graph.addNode(task1);
    await storage.save(graph);
  });

  afterEach(async () => {
    // Clean up temp directories
    try {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(exportDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function getExecErrorText(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  describe('JSON export', () => {
    it('should export project as JSON', () => {
      const outputPath = join(exportDir, 'export.json');

      const output = execSync(
        `node ${cliPath} --project "${tempDir}" export --type json --output "${outputPath}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Exported');
      expect(existsSync(outputPath)).toBe(true);

      // Verify JSON is valid
      const content = readFileSync(outputPath, 'utf-8');
      const data = JSON.parse(content);
      expect(data).toHaveProperty('nodes');
    });

    it('should include all task data in JSON export', () => {
      const outputPath = join(exportDir, 'export.json');

      execSync(
        `node ${cliPath} --project "${tempDir}" export --type json --output "${outputPath}"`,
        { encoding: 'utf-8' }
      );

      const content = readFileSync(outputPath, 'utf-8');
      const data = JSON.parse(content);

      expect(Object.keys(data.nodes).length).toBe(1);
      const task = Object.values(data.nodes)[0] as any;
      expect(task.title).toBe('Implement login');
      expect(task.success_criteria).toHaveLength(2);
      expect(task.deliverables).toHaveLength(2);
    });
  });

  describe('markdown export', () => {
    it('should export project as markdown', () => {
      const outputPath = join(exportDir, 'export.md');

      const output = execSync(
        `node ${cliPath} --project "${tempDir}" export --type md --output "${outputPath}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Exported');
      expect(existsSync(outputPath)).toBe(true);

      // Verify markdown content
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('#'); // Markdown heading
      expect(content).toContain('Implement login');
      expect(content).toContain('[ ]'); // Checkbox
    });

    it('should include checkboxes for incomplete items', () => {
      const outputPath = join(exportDir, 'export.md');

      execSync(
        `node ${cliPath} --project "${tempDir}" export --type md --output "${outputPath}"`,
        { encoding: 'utf-8' }
      );

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('[ ]'); // Incomplete items
      expect(content).toContain('[x]'); // Completed items
    });
  });

  describe('output options', () => {
    it('should use default output path when not specified', () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" export --type json`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Exported');
      // Should create file in current directory with default name
    });

    it('should create parent directories if they do not exist', () => {
      const deepPath = join(exportDir, 'deep', 'path', 'export.json');

      execSync(
        `node ${cliPath} --project "${tempDir}" export --type json --output "${deepPath}"`,
        { encoding: 'utf-8' }
      );

      expect(existsSync(deepPath)).toBe(true);
    });

    it('should still export successfully when the parent directory already exists', () => {
      const existingDir = join(exportDir, 'existing');
      rmSync(existingDir, { recursive: true, force: true });
      mkdirSync(existingDir, { recursive: true });

      const outputPath = join(existingDir, 'export.json');
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" export --type json --output "${outputPath}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Exported');
      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should report non-EEXIST mkdir failures clearly', () => {
      let errorText = '';

      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" export --type json --output "${join(exportDir, 'forced', 'export.json')}"`,
          {
            encoding: 'utf-8',
            env: {
              ...process.env,
              OCTIE_TEST_FORCE_EXPORT_MKDIR_FAILURE: '1',
            },
            stdio: 'pipe',
          }
        );
      } catch (error) {
        errorText = getExecErrorText(error);
      }

      expect(errorText).toContain('Injected export mkdir failure');
      expect((errorText.match(/Injected export mkdir failure/g) || [])).toHaveLength(1);
    });

    it('should default to JSON when export type is invalid', () => {
      const outputPath = join(tempDir, 'fallback.json');
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" export --type invalid --output "${outputPath}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      expect(output).toContain('Exported to');
      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('help', () => {
    it('should show help with --help flag', () => {
      const output = execSync(`node ${cliPath} export --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Export project');
      expect(output).toContain('--type');
      expect(output).toContain('--output');
    });
  });
});
