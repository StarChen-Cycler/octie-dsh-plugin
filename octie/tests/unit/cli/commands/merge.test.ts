/**
 * Merge Command Unit Tests
 *
 * Tests for merge command including:
 * - Task merging
 * - Property deduplication
 * - Edge reconnection
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { execSync } from 'node:child_process';

describe('merge command', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;
  let sourceTaskId: string;
  let targetTaskId: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');

    // CLI entry point
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    // Create test tasks
    const graph = await storage.load();
    sourceTaskId = uuidv4();
    targetTaskId = uuidv4();
    const criterion1Id = uuidv4();
    const criterion2Id = uuidv4();
    const deliverable1Id = uuidv4();
    const deliverable2Id = uuidv4();

    const sourceTask = new TaskNode({
      id: sourceTaskId,
      title: 'Implement login',
      description: 'Create login endpoint with JWT authentication for secure user login',
      status: 'in_progress',
      priority: 'top',
      success_criteria: [
        { id: criterion1Id, text: 'Login endpoint works', completed: true },
      ],
      deliverables: [
        { id: deliverable1Id, text: 'login.ts', completed: true },
      ],
      blockers: [],
      dependencies: '',
      related_files: ['src/auth/'],
      notes: 'Use bcrypt',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });

    const targetTask = new TaskNode({
      id: targetTaskId,
      title: 'Build authentication system with session',
      description: 'Build complete authentication system with JWT tokens and session management for user access',
      status: 'ready',
      priority: 'second',
      success_criteria: [
        { id: criterion2Id, text: 'Authentication system accepts valid credentials', completed: false },
      ],
      deliverables: [
        { id: deliverable2Id, text: 'src/services/auth.service.ts', completed: false },
      ],
      blockers: [],
      dependencies: '',
      related_files: ['src/services/'],
      notes: 'Include session management',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });

    graph.addNode(sourceTask);
    graph.addNode(targetTask);

    await storage.save(graph);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('task merging', () => {
    it('should merge two tasks successfully', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${targetTaskId}`,
        { encoding: 'utf-8', input: 'y\n' } // Confirm the merge
      );

      expect(output).toContain('Tasks merged');

      const graph = await storage.load();

      // Source task should be deleted
      expect(graph.hasNode(sourceTaskId)).toBe(false);

      // Target task should still exist
      expect(graph.hasNode(targetTaskId)).toBe(true);
    });

    it('should combine success criteria from both tasks', async () => {
      execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${targetTaskId}`,
        { encoding: 'utf-8', input: 'y\n' }
      );

      const graph = await storage.load();
      const task = graph.getNode(targetTaskId);

      expect(task?.success_criteria.length).toBe(2);
    });

    it('should combine deliverables from both tasks', async () => {
      execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${targetTaskId}`,
        { encoding: 'utf-8', input: 'y\n' }
      );

      const graph = await storage.load();
      const task = graph.getNode(targetTaskId);

      expect(task?.deliverables.length).toBe(2);
    });

    it('should merge related files without duplicates', async () => {
      execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${targetTaskId}`,
        { encoding: 'utf-8', input: 'y\n' }
      );

      const graph = await storage.load();
      const task = graph.getNode(targetTaskId);

      expect(task?.related_files.length).toBe(2);
      expect(task?.related_files).toContain('src/auth/');
      expect(task?.related_files).toContain('src/services/');
    });

    it('should append notes from source task', async () => {
      execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${targetTaskId}`,
        { encoding: 'utf-8', input: 'y\n' }
      );

      const graph = await storage.load();
      const task = graph.getNode(targetTaskId);

      expect(task?.notes).toContain('session management');
      expect(task?.notes).toContain('bcrypt');
    });

    it('should recalculate downstream blocked status after merge rewires blockers', async () => {
      const graph = await storage.load();
      graph.clear();

      const sourceId = uuidv4();
      const targetId = uuidv4();
      const childId = uuidv4();

      graph.addNode(new TaskNode({
        id: sourceId,
        title: 'Implement merge source status gate',
        description: 'Create a source task whose children stay blocked until merge rewires the blocker chain to a completed target task for status propagation testing.',
        status: 'in_review',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Source work is complete', completed: true }],
        deliverables: [{ id: uuidv4(), text: 'src/source.ts', completed: true }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [childId],
      }));

      graph.addNode(new TaskNode({
        id: targetId,
        title: 'Implement merge target completion gate',
        description: 'Create a completed target task so merging the source into it should immediately unblock children whose only remaining parent becomes completed.',
        status: 'completed',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Target work is complete', completed: true }],
        deliverables: [{ id: uuidv4(), text: 'src/target.ts', completed: true }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      }));

      graph.addNode(new TaskNode({
        id: childId,
        title: 'Implement downstream merge child task',
        description: 'Create a downstream child task that should transition from blocked to ready as soon as merge rewires its parent to the completed target task.',
        status: 'blocked',
        priority: 'second',
        success_criteria: [{ id: uuidv4(), text: 'Child is ready after merge', completed: false }],
        deliverables: [{ id: uuidv4(), text: 'src/child.ts', completed: false }],
        blockers: [sourceId],
        dependencies: 'Waiting on merge source completion',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      }));

      await storage.save(graph);

      execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceId} ${targetId}`,
        { encoding: 'utf-8', input: 'y\n' }
      );

      const updatedGraph = await storage.load();
      expect(updatedGraph.getNode(childId)?.status).toBe('ready');
    });
  });

  describe('preview', () => {
    it('should show merge preview before confirming', () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${targetTaskId}`,
        { encoding: 'utf-8', input: 'n\n' } // Answer 'no' to cancel
      );

      // Should show what will be merged
      expect(output).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should reject merging same task', () => {
      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" merge ${targetTaskId} ${targetTaskId}`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should reject invalid source task ID', () => {
      const fakeId = uuidv4();

      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" merge ${fakeId} ${targetTaskId}`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should reject invalid target task ID', () => {
      const fakeId = uuidv4();

      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" merge ${sourceTaskId} ${fakeId}`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('help', () => {
    it('should show help with --help flag', () => {
      const output = execSync(`node ${cliPath} merge --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Merge two tasks');
    });
  });
});
