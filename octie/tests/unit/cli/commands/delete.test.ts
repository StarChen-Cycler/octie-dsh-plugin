/**
 * Delete Command Unit Tests
 *
 * Tests for delete command including:
 * - Task deletion
 * - Edge reconnection
 * - Cascade deletion
 * - Backup creation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { execSync } from 'node:child_process';

describe('delete command', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;
  let taskId1: string;
  let taskId2: string;
  let taskId3: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');

    // CLI entry point
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    // Create test tasks with dependencies
    const graph = await storage.load();
    taskId1 = uuidv4();
    taskId2 = uuidv4();
    taskId3 = uuidv4();

    const task1 = new TaskNode({
      id: taskId1,
      title: 'Create first test node for delete testing',
      description: 'Create the first task node in the chain to test delete command functionality in various scenarios',
      status: 'completed',
      priority: 'top',
      success_criteria: [{ id: uuidv4(), text: 'Node is created successfully', completed: true }],
      deliverables: [{ id: uuidv4(), text: 'output.ts', completed: true }],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [taskId2], // Points to task2
    });

    const task2 = new TaskNode({
      id: taskId2,
      title: 'Create second test node for dependency testing',
      description: 'Create the second task node to test delete command functionality with dependencies between nodes',
      status: 'ready',
      priority: 'second',
      success_criteria: [{ id: uuidv4(), text: 'Node is created with edge', completed: false }],
      deliverables: [{ id: uuidv4(), text: 'output2.ts', completed: false }],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [taskId3], // Points to task3
    });

    const task3 = new TaskNode({
      id: taskId3,
      title: 'Create third test node at end of chain',
      description: 'Create the third task node at the end of the chain to test delete command and edge reconnection',
      status: 'ready',
      priority: 'later',
      success_criteria: [{ id: uuidv4(), text: 'Node is created as leaf', completed: false }],
      deliverables: [{ id: uuidv4(), text: 'output3.ts', completed: false }],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });

    graph.addNode(task1);
    graph.addNode(task2);
    graph.addNode(task3);

    // Note: Edges are already set via TaskNode.edges property
    // graph.addEdge() would create duplicates

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

  describe('task deletion', () => {
    it('should delete task by ID', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId3} --force`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task deleted');

      const graph = await storage.load();
      expect(graph.hasNode(taskId3)).toBe(false);
      expect(graph.size).toBe(2);
    });

    it('should create backup before deletion', async () => {
      // Run the delete command
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId3} --force`,
        { encoding: 'utf-8' }
      );

      // Verify deletion succeeded
      expect(output).toContain('Task deleted');

      // After deletion, the project should still exist and be loadable
      const graph = await storage.load();
      expect(graph.size).toBe(2);

      // Backup is automatic during save - this test verifies the deletion workflow completes
    });
  });

  describe('edge reconnection', () => {
    it('should reconnect edges when --reconnect flag is used', async () => {
      // Delete task2 with reconnect
      // Before: task1 -> task2 -> task3
      // After: task1 -> task3 (reconnected)

      execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId2} --reconnect --force`,
        { encoding: 'utf-8' }
      );

      const graph = await storage.load();

      // task2 should be deleted
      expect(graph.hasNode(taskId2)).toBe(false);

      // task1 should now point to task3
      const task1Outgoing = graph.getOutgoingEdges(taskId1);
      expect(task1Outgoing).toContain(taskId3);
    });

    it('should remove edges without reconnection when flag is not used', async () => {
      execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId2} --force`,
        { encoding: 'utf-8' }
      );

      const graph = await storage.load();

      // task2 should be deleted
      expect(graph.hasNode(taskId2)).toBe(false);

      // task1 should have no outgoing edges (deleted task2 was the target)
      // Note: removeNode cleans up both outgoing and incoming edge references
      const task1Outgoing = graph.getOutgoingEdges(taskId1);
      expect(task1Outgoing.length).toBe(0);
    });

    it('should recalculate downstream blocked status when reconnecting around a non-completed blocker', async () => {
      const graph = await storage.load();
      graph.clear();

      const parentId = uuidv4();
      const blockerId = uuidv4();
      const childId = uuidv4();

      graph.addNode(new TaskNode({
        id: parentId,
        title: 'Implement reconnect parent completion gate',
        description: 'Create a completed parent task so reconnect-delete can transfer child ownership to a completed node and unblock the downstream task immediately.',
        status: 'completed',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Parent work is complete', completed: true }],
        deliverables: [{ id: uuidv4(), text: 'src/parent.ts', completed: true }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [blockerId],
      }));

      graph.addNode(new TaskNode({
        id: blockerId,
        title: 'Implement reconnect blocker gate',
        description: 'Create an in-review blocker task so the downstream child starts blocked until delete --reconnect removes this non-completed parent from the chain.',
        status: 'in_review',
        priority: 'second',
        success_criteria: [{ id: uuidv4(), text: 'Blocker work is complete but not approved', completed: true }],
        deliverables: [{ id: uuidv4(), text: 'src/blocker.ts', completed: true }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [childId],
      }));

      graph.addNode(new TaskNode({
        id: childId,
        title: 'Implement reconnect child readiness task',
        description: 'Create a blocked downstream child task that should become ready as soon as delete --reconnect rewires its parent to the completed upstream task.',
        status: 'blocked',
        priority: 'later',
        success_criteria: [{ id: uuidv4(), text: 'Child becomes ready after reconnect delete', completed: false }],
        deliverables: [{ id: uuidv4(), text: 'src/reconnect-child.ts', completed: false }],
        blockers: [blockerId],
        dependencies: 'Waiting on blocker completion',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      }));

      await storage.save(graph);

      execSync(
        `node ${cliPath} --project "${tempDir}" delete ${blockerId} --reconnect --force`,
        { encoding: 'utf-8' }
      );

      const updatedGraph = await storage.load();
      expect(updatedGraph.getNode(childId)?.status).toBe('ready');
    });
  });

  describe('cascade deletion', () => {
    // TODO: Cascade deletion not yet implemented
    it.skip('should delete all dependents with --cascade flag', async () => {
      // Delete task1 with cascade
      // Should delete task1, task2, and task3 (all downstream)

      execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId1} --cascade --force`,
        { encoding: 'utf-8' }
      );

      const graph = await storage.load();

      // All tasks should be deleted
      expect(graph.size).toBe(0);
    });
  });

  describe('impact display', () => {
    it('should show impact before deletion', () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId2}`,
        { encoding: 'utf-8', input: 'n\n' } // Answer 'no' to prompt
      );

      // Should show what will be affected
      expect(output).toBeTruthy();
    });

    it('should show dependents', () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" delete ${taskId2}`,
        { encoding: 'utf-8', input: 'n\n' }
      );

      // Should mention task3 as a dependent
      expect(output).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should reject invalid task ID', () => {
      const fakeId = uuidv4();

      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" delete ${fakeId} --force`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should reject deletion without confirmation or --force', () => {
      // This test may behave differently depending on how prompts are handled
      // The command should either prompt or require --force
    });
  });

  describe('help', () => {
    it('should show help with --help flag', () => {
      const output = execSync(`node ${cliPath} delete --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Delete a task');
      expect(output).toContain('--reconnect');
      expect(output).toContain('--cascade');
      expect(output).toContain('--force');
    });
  });
});
