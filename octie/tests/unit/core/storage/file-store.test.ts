/**
 * TaskStorage Unit Tests
 *
 * Tests for TaskStorage class including:
 * - Load/save tests
 * - Directory structure tests
 * - Snapshot history tests
 * - Path utilities tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { TaskGraphStore } from '../../../../src/core/graph/index.js';

describe('TaskStorage', () => {
  let tempDir: string;
  let storage: TaskStorage;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should use default values', () => {
      const defaultStorage = new TaskStorage();

      expect(defaultStorage.octieDirPath).toContain('.octie');
      expect(defaultStorage.projectFilePath).toContain('project.json');
    });

    it('should use custom project directory', () => {
      const customStorage = new TaskStorage({ projectDir: '/custom/path' });

      // Normalize paths for comparison (handle Windows vs Unix)
      const expected = customStorage.octieDirPath.split(sep).join('/');
      const actual = '/custom/path/.octie'.split('/').join(sep);
      expect(customStorage.octieDirPath).toContain('.octie');
    });

    it('should use custom octie directory name', () => {
      const customStorage = new TaskStorage({
        projectDir: tempDir,
        octieDirName: '.custom',
      });

      expect(customStorage.octieDirPath).toBe(join(tempDir, '.custom'));
    });
  });

  describe('path getters', () => {
    it('should return octie directory path', () => {
      expect(storage.octieDirPath).toBe(join(tempDir, '.octie'));
    });

    it('should return project file path', () => {
      expect(storage.projectFilePath).toBe(join(tempDir, '.octie', 'project.json'));
    });

    it('should return backup file path', () => {
      expect(storage.backupFilePath).toBe(join(tempDir, '.octie', 'project.bak'));
    });

    it('should return history directory path', () => {
      expect(storage.historyDirPath).toBe(join(tempDir, '.octie', 'history'));
    });

    it('should return snapshots directory path', () => {
      expect(storage.snapshotsDirPath).toBe(join(tempDir, '.octie', 'history', 'snapshots'));
    });

    it('should return history file path', () => {
      expect(storage.historyFilePath).toBe(join(tempDir, '.octie', 'history', 'history.ndjson'));
    });
  });

  describe('init', () => {
    it('should create .octie directory structure', async () => {
      await storage.init();

      const octieExists = await storage._writer.exists(storage.octieDirPath);
      expect(octieExists).toBe(true);
    });

    it('should not create extra directories during bare init', async () => {
      await storage.init();

      expect(existsSync(storage.indexesDirPath)).toBe(false);
      expect(existsSync(storage.cacheDirPath)).toBe(false);
      expect(existsSync(storage.historyDirPath)).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return false when project does not exist', async () => {
      const exists = await storage.exists();
      expect(exists).toBe(false);
    });

    it('should return true when project exists', async () => {
      const graph = new TaskGraphStore();
      await storage.init();
      await storage.save(graph);

      const exists = await storage.exists();
      expect(exists).toBe(true);
    });
  });

  describe('createProject', () => {
    it('should create new project with metadata', async () => {
      await storage.createProject('Test Project');

      const loaded = await storage.load();
      expect(loaded.metadata.project_name).toBe('Test Project');
      expect(loaded.size).toBe(0);
    });

    it('should create .octie directory structure', async () => {
      await storage.createProject('Test Project');

      const octieExists = await storage._writer.exists(storage.octieDirPath);
      expect(octieExists).toBe(true);
    });

    it('should create project.json file', async () => {
      await storage.createProject('Test Project');

      const projectExists = await storage._writer.exists(storage.projectFilePath);
      expect(projectExists).toBe(true);
    });

    it('should create history baseline files', async () => {
      await storage.createProject('Test Project');

      expect(existsSync(storage.historyDirPath)).toBe(true);
      expect(existsSync(storage.snapshotsDirPath)).toBe(true);
      expect(existsSync(storage.historyFilePath)).toBe(true);

      const snapshotFiles = readdirSync(storage.snapshotsDirPath);
      expect(snapshotFiles.length).toBe(1);
    });
  });

  describe('save and load', () => {
    it('should save and load empty graph', async () => {
      await storage.init();

      const graph = new TaskGraphStore();
      await storage.save(graph);

      const loaded = await storage.load();
      expect(loaded.size).toBe(0);
      expect(loaded.metadata.project_name).toBeDefined();
    });

    it('should save and load graph with tasks', async () => {
      await storage.init();

      const graph = new TaskGraphStore();

      const task = new TaskNode({
        title: 'Implement feature with modules',
        description: 'Create a new feature with comprehensive functionality and proper error handling. The implementation should follow best practices.',
        success_criteria: [
          { id: uuidv4(), text: 'Feature works correctly with tests', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/feature.ts', completed: false },
        ],
      });

      graph.addNode(task);
      await storage.save(graph);

      const loaded = await storage.load();
      expect(loaded.size).toBe(1);
      expect(loaded.hasNode(task.id)).toBe(true);

      const loadedTask = loaded.getNode(task.id);
      expect(loadedTask?.title).toBe('Implement feature with modules');
    });

    it('should save and load graph with edges', async () => {
      await storage.init();

      const graph = new TaskGraphStore();

      const taskA = new TaskNode({
        title: 'Implement task A module',
        description: 'Task A description with sufficient detail for testing purposes.',
        success_criteria: [
          { id: uuidv4(), text: 'Criterion A is met', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/a.ts', completed: false },
        ],
      });

      const taskB = new TaskNode({
        title: 'Implement task B module',
        description: 'Task B description with sufficient detail for testing purposes.',
        success_criteria: [
          { id: uuidv4(), text: 'Criterion B is met', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/b.ts', completed: false },
        ],
      });

      graph.addNode(taskA);
      graph.addNode(taskB);
      graph.addEdge(taskA.id, taskB.id);

      await storage.save(graph);

      const loaded = await storage.load();
      expect(loaded.hasEdge(taskA.id, taskB.id)).toBe(true);
      expect(loaded.getOutgoingEdges(taskA.id)).toEqual([taskB.id]);
      expect(loaded.getIncomingEdges(taskB.id)).toEqual([taskA.id]);
    });

    it('should preserve timestamps', async () => {
      await storage.init();

      const graph = new TaskGraphStore();

      const task = new TaskNode({
        title: 'Create test module',
        description: 'Test task description with sufficient detail for validation purposes.',
        success_criteria: [
          { id: uuidv4(), text: 'Test passes with coverage', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/test.ts', completed: false },
        ],
      });

      graph.addNode(task);
      const originalCreatedAt = task.created_at;
      const originalUpdatedAt = task.updated_at;

      await storage.save(graph);

      const loaded = await storage.load();
      const loadedTask = loaded.getNode(task.id);

      expect(loadedTask?.created_at).toBe(originalCreatedAt);
      expect(loadedTask?.updated_at).toBe(originalUpdatedAt);
    });

    it('should append immutable snapshot history on save', async () => {
      await storage.createProject('Snapshot Project');

      const graph = await storage.load();
      graph.addNode(new TaskNode({
        title: 'Implement snapshot test module',
        description: 'Create a task so snapshot history can verify that post-save committed graph state is recorded after a real graph mutation.',
        success_criteria: [
          { id: uuidv4(), text: 'Task is persisted to the live graph', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/snapshot.ts', completed: false },
        ],
      }));

      await storage.save(graph);

      const historyEntries = await storage.listHistory();
      expect(historyEntries.length).toBe(2);
      expect(historyEntries[0]?.task_count).toBe(1);
      expect(historyEntries[0]?.snapshot_file).toContain('history/snapshots/');
      expect(historyEntries[0]?.reason).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete project file', async () => {
      await storage.init();
      await storage.createProject('Test Project');

      await storage.delete();

      const exists = await storage.exists();
      expect(exists).toBe(false);
    });

    it('should handle deletion of non-existent project gracefully', async () => {
      // Should not throw error even if project doesn't exist
      await expect(storage.delete()).resolves.not.toThrow();
    });
  });

  describe('restore history', () => {
    it('should restore a snapshot after first recording a pre-restore snapshot', async () => {
      await storage.createProject('Restore Project');

      const graph = await storage.load();
      const task = new TaskNode({
        title: 'Implement restoreable task',
        description: 'Create a task that can later be removed from the live graph so snapshot restore can verify returning to an older version.',
        success_criteria: [
          { id: uuidv4(), text: 'Task exists before restore', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/restore.ts', completed: false },
        ],
      });
      graph.addNode(task);
      await storage.save(graph);

      const snapshotToRestore = (await storage.listHistory())[0]!;

      graph.removeNode(task.id);
      await storage.save(graph);
      expect((await storage.load()).hasNode(task.id)).toBe(false);

      await storage.restoreSnapshot(snapshotToRestore.snapshot_id, {
        sourceCommand: 'octie history restore',
      });

      const restoredGraph = await storage.load();
      expect(restoredGraph.hasNode(task.id)).toBe(true);

      const historyEntries = await storage.listHistory();
      expect(historyEntries[0]?.reason).toBe('pre_restore');
      expect(historyEntries[0]?.restored_from_snapshot_id).toBe(snapshotToRestore.snapshot_id);
    });
  });
});
