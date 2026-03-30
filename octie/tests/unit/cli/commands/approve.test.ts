/**
 * Tests for approve command
 */

import { execSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { approveCommand } from '../../../../src/cli/commands/approve.js';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import type { TaskGraphStore } from '../../../../src/core/graph/index.js';

describe('approve command', () => {
  let tempDir: string;
  let outsideDir: string;
  let tempHome: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;
  let storage: TaskStorage;
  let graph: TaskGraphStore;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `octie-approve-test-${uuidv4()}`);
    outsideDir = join(tmpdir(), `octie-approve-outside-${uuidv4()}`);
    tempHome = join(tmpdir(), `octie-approve-home-${uuidv4()}`);
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
    env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
    };
    mkdirSync(outsideDir, { recursive: true });
    mkdirSync(tempHome, { recursive: true });
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');
    graph = await storage.load();
  });

  afterEach(async () => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should approve a task in in_review status', async () => {
    // Create a task with all criteria/deliverables complete
    const taskId = uuidv4();
    const task = new TaskNode({
      id: taskId,
      title: 'Test task for approval',
      description: 'This is a test task that has all criteria and deliverables completed for approval testing purposes.',
      success_criteria: [
        { id: uuidv4(), text: 'Criterion 1 completed', completed: true },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test.ts', completed: true },
      ],
      status: 'in_review',
    });
    graph.addNode(task);
    await storage.save(graph);

    // Execute approve command
    await approveCommand(taskId, { project: tempDir });

    // Reload and verify
    const graph2 = await storage.load();
    const approvedTask = graph2.getNode(taskId);

    expect(approvedTask).toBeDefined();
    expect(approvedTask!.status).toBe('completed');
    expect(approvedTask!.completed_at).not.toBeNull();
  });

  it('should reject approval when task is not in in_review status', async () => {
    // Create a task that is NOT in review
    const taskId = uuidv4();
    const task = new TaskNode({
      id: taskId,
      title: 'Test task not ready for approval',
      description: 'This is a test task that is still in progress and not ready for approval yet.',
      success_criteria: [
        { id: uuidv4(), text: 'Criterion 1', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test.ts', completed: false },
      ],
      status: 'in_progress',
    });
    graph.addNode(task);
    await storage.save(graph);

    // Execute approve command - should throw
    await expect(
      approveCommand(taskId, { project: tempDir })
    ).rejects.toThrow();

    // Verify status unchanged
    const graph2 = await storage.load();
    const unchangedTask = graph2.getNode(taskId);
    expect(unchangedTask!.status).toBe('in_progress');
  });

  it('should reject approval for ready status', async () => {
    const taskId = uuidv4();
    const task = new TaskNode({
      id: taskId,
      title: 'Test task ready status',
      description: 'This is a test task that is in ready status and should not be approvable.',
      success_criteria: [
        { id: uuidv4(), text: 'Criterion 1', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test.ts', completed: false },
      ],
      status: 'ready',
    });
    graph.addNode(task);
    await storage.save(graph);

    await expect(
      approveCommand(taskId, { project: tempDir })
    ).rejects.toThrow();
  });

  it('should reject approval for blocked status', async () => {
    const taskId = uuidv4();
    const blockerId = uuidv4();

    // Create blocker task
    const blocker = new TaskNode({
      id: blockerId,
      title: 'Blocker task',
      description: 'This is a blocker task that prevents the main task from being approved.',
      success_criteria: [
        { id: uuidv4(), text: 'Blocker criterion', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/blocker.ts', completed: false },
      ],
    });
    graph.addNode(blocker);

    const task = new TaskNode({
      id: taskId,
      title: 'Test task blocked',
      description: 'This is a test task that is blocked by another task and should not be approvable.',
      success_criteria: [
        { id: uuidv4(), text: 'Criterion 1', completed: true },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test.ts', completed: true },
      ],
      blockers: [blockerId],
      dependencies: 'Waiting for blocker task to complete',
      status: 'blocked',
    });
    graph.addNode(task);
    await storage.save(graph);

    await expect(
      approveCommand(taskId, { project: tempDir })
    ).rejects.toThrow();
  });

  it('should reject approval for already completed status', async () => {
    const taskId = uuidv4();
    const task = new TaskNode({
      id: taskId,
      title: 'Test task already completed',
      description: 'This is a test task that is already completed and should not be approvable again.',
      success_criteria: [
        { id: uuidv4(), text: 'Criterion 1', completed: true },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test.ts', completed: true },
      ],
      status: 'completed',
    });
    graph.addNode(task);
    await storage.save(graph);

    await expect(
      approveCommand(taskId, { project: tempDir })
    ).rejects.toThrow();
  });

  it('should work with short task ID prefix', async () => {
    const taskId = 'abc12345-def6-7890-abcd-ef1234567890';
    const task = new TaskNode({
      id: taskId,
      title: 'Test task with prefix',
      description: 'This is a test task that tests approval using a short ID prefix instead of full ID.',
      success_criteria: [
        { id: uuidv4(), text: 'Criterion 1', completed: true },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test.ts', completed: true },
      ],
      status: 'in_review',
    });
    graph.addNode(task);
    await storage.save(graph);

    // Use short prefix
    await approveCommand('abc12345', { project: tempDir });

    // Verify approved
    const graph2 = await storage.load();
    const approvedTask = graph2.getNode(taskId);
    expect(approvedTask!.status).toBe('completed');
  });

  it('should reject non-existent task ID', async () => {
    await expect(
      approveCommand('nonexistent', { project: tempDir })
    ).rejects.toThrow();
  });

  it('should honor global and local --project when run outside the project directory', async () => {
    const globalTaskId = uuidv4();
    const localTaskId = uuidv4();

    graph.addNode(new TaskNode({
      id: globalTaskId,
      title: 'Write global approve regression test',
      description: 'Verify that approve uses the explicit global project option instead of falling back to cwd auto-detection.',
      success_criteria: [
        { id: uuidv4(), text: 'Global --project approve succeeds outside the project directory', completed: true },
      ],
      deliverables: [
        { id: uuidv4(), text: 'tests/approve-global-regression.txt', completed: true },
      ],
      status: 'in_review',
    }));

    graph.addNode(new TaskNode({
      id: localTaskId,
      title: 'Write local approve regression test',
      description: 'Verify that approve also honors the subcommand-local project option when invoked outside the project directory.',
      success_criteria: [
        { id: uuidv4(), text: 'Local approve --project succeeds outside the project directory', completed: true },
      ],
      deliverables: [
        { id: uuidv4(), text: 'tests/approve-local-regression.txt', completed: true },
      ],
      status: 'in_review',
    }));

    await storage.save(graph);

    const globalOutput = execSync(
      `node "${cliPath}" --project "${tempDir}" approve ${globalTaskId}`,
      { cwd: outsideDir, env, encoding: 'utf-8' }
    );
    expect(globalOutput).toContain('Task approved');

    const localOutput = execSync(
      `node "${cliPath}" approve ${localTaskId} --project "${tempDir}"`,
      { cwd: outsideDir, env, encoding: 'utf-8' }
    );
    expect(localOutput).toContain('Task approved');

    const graph2 = await storage.load();
    expect(graph2.getNode(globalTaskId)?.status).toBe('completed');
    expect(graph2.getNode(localTaskId)?.status).toBe('completed');
  });
});
