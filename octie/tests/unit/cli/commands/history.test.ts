import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';

describe('history command', () => {
  let tempDir: string;
  let tempHome: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `octie-history-test-${uuidv4()}`);
    tempHome = join(tmpdir(), `octie-home-${uuidv4()}`);
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
    env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
    };

    const storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('history-test-project');
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
  });

  it('lists snapshot history and respects global format output', async () => {
    const storage = new TaskStorage({ projectDir: tempDir });
    const graph = await storage.load();
    graph.addNode(new TaskNode({
      title: 'Implement history list module',
      description: 'Create a task so immutable snapshot history has a post-mutation entry that history list can render through the existing global format pathways.',
      success_criteria: [
        { id: uuidv4(), text: 'History list renders snapshot metadata', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/history/list.ts', completed: false },
      ],
    }));
    await storage.save(graph);

    const tableOutput = execSync(
      `node ${cliPath} --project "${tempDir}" history list`,
      { encoding: 'utf-8', env },
    );
    expect(tableOutput).toContain('Snapshot ID');
    expect(tableOutput).toContain('Reason');

    const markdownOutput = execSync(
      `node ${cliPath} --project "${tempDir}" --format md history list`,
      { encoding: 'utf-8', env },
    );
    expect(markdownOutput).toContain('# Snapshot History');
    expect(markdownOutput).toContain('Tasks: 1');

    const jsonOutput = execSync(
      `node ${cliPath} --project "${tempDir}" --format json history list`,
      { encoding: 'utf-8', env },
    );
    const entries = JSON.parse(jsonOutput);
    expect(entries[0].snapshot_id).toBeDefined();
    expect(entries[0].task_count).toBe(1);
    expect(entries[0].edge_count).toBeGreaterThanOrEqual(0);
  });

  it('restores a snapshot by recording a pre_restore snapshot first', async () => {
    const storage = new TaskStorage({ projectDir: tempDir });
    const graph = await storage.load();
    const task = new TaskNode({
      title: 'Implement restoreable history task',
      description: 'Create a task that can be removed and then restored through the history command to verify reversible snapshot-based recovery behavior.',
      success_criteria: [
        { id: uuidv4(), text: 'Task returns after restore', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/history/restore.ts', completed: false },
      ],
    });
    graph.addNode(task);
    await storage.save(graph);
    const snapshotToRestore = (await storage.listHistory())[0]!;

    graph.removeNode(task.id);
    await storage.save(graph);

    execSync(
      `node ${cliPath} --project "${tempDir}" history restore ${snapshotToRestore.snapshot_id} --force`,
      { encoding: 'utf-8', env },
    );

    const restoredGraph = await storage.load();
    expect(restoredGraph.hasNode(task.id)).toBe(true);

    const entries = await storage.listHistory();
    expect(entries[0]?.reason).toBe('pre_restore');
    expect(entries[0]?.restored_from_snapshot_id).toBe(snapshotToRestore.snapshot_id);
  });

  it('prompts for confirmation by default and cancels restore on no', async () => {
    const storage = new TaskStorage({ projectDir: tempDir });
    const graph = await storage.load();
    graph.addNode(new TaskNode({
      title: 'Implement prompt history task',
      description: 'Create a task so restore confirmation can be cancelled before mutating the live project.json state.',
      success_criteria: [
        { id: uuidv4(), text: 'Restore cancellation leaves state unchanged', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/history/prompt.ts', completed: false },
      ],
    }));
    await storage.save(graph);
    const snapshotToRestore = (await storage.listHistory())[0]!;

    graph.clear();
    await storage.save(graph);

    const output = execSync(
      `node ${cliPath} --project "${tempDir}" history restore ${snapshotToRestore.snapshot_id}`,
      { encoding: 'utf-8', env, input: 'n\n' },
    );

    expect(output).toContain('Restore cancelled');
    const liveGraph = await storage.load();
    expect(liveGraph.size).toBe(0);
  });
});
