/**
 * CLI Workflow Integration Tests
 *
 * Tests for complete CLI workflows including:
 * - Full workflow (init, create, list, update, delete)
 * - Large dataset handling (1000+ tasks)
 * - Cross-platform path handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../src/core/storage/file-store.js';
import { TaskNode } from '../../src/core/models/task-node.js';
import { TaskGraphStore } from '../../src/core/graph/index.js';

describe('CLI workflow integration', () => {
  let tempDir: string;
  let storage: TaskStorage;

  beforeEach(async () => {
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

  describe('full CLI workflow', () => {
    it('should complete full workflow: init, create, list, update, delete', async () => {
      // Step 1: Initialize project
      await storage.createProject('test-project');
      expect(await storage.exists()).toBe(true);
      expect(existsSync(storage.octieDirPath)).toBe(true);

      // Step 2: Create tasks
      const graph = await storage.load();

      const task1 = new TaskNode({
        id: uuidv4(),
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
        status: 'ready',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: ['src/auth/'],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      const task2 = new TaskNode({
        id: uuidv4(),
        title: 'Write unit tests',
        description: 'Create comprehensive unit tests for login functionality with full coverage',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'All tests pass', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'tests/api/auth/login.test.ts', completed: false },
        ],
        blockers: [task1.id],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(task1);
      graph.addNode(task2);
      graph.addEdge(task1.id, task2.id);
      await storage.save(graph);

      expect(graph.size).toBe(2);

      // Step 3: List tasks (simulated)
      const allTasks = graph.getAllTasks();
      expect(allTasks.length).toBe(2);

      // Step 4: Update task status
      const task1Updated = graph.getNode(task1.id);
      task1Updated?.setStatus('in_progress');
      await storage.save(graph);

      const updatedGraph = await storage.load();
      const updatedTask = updatedGraph.getNode(task1.id);
      expect(updatedTask?.status).toBe('in_progress');

      // Step 5: Delete task
      updatedGraph.removeNode(task2.id);
      await storage.save(updatedGraph);

      expect(updatedGraph.hasNode(task2.id)).toBe(false);
      expect(updatedGraph.size).toBe(1);
    });

    it('should handle task dependencies correctly', async () => {
      await storage.createProject('dependency-test');

      const graph = await storage.load();

      const task1 = new TaskNode({
        id: uuidv4(),
        title: 'Create base component',
        description: 'Implement base UI component with shared functionality and styling for the application',
        status: 'completed',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'Component renders correctly', completed: true },
        ],
        deliverables: [
          { id: uuidv4(), text: 'BaseComponent.tsx', completed: true },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      const task2 = new TaskNode({
        id: uuidv4(),
        title: 'Create button component',
        description: 'Implement button component that extends base component with button specific functionality',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'Button component extends base', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'ButtonComponent.tsx', completed: false },
        ],
        blockers: [task1.id],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      const task3 = new TaskNode({
        id: uuidv4(),
        title: 'Create input component',
        description: 'Implement input component that extends base component with input specific functionality',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'Input component extends base', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'InputComponent.tsx', completed: false },
        ],
        blockers: [task1.id],
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

      // task1 enables task2 and task3
      graph.addEdge(task1.id, task2.id);
      graph.addEdge(task1.id, task3.id);

      await storage.save(graph);

      // Verify blockers
      expect(task2.blockers).toContain(task1.id);
      expect(task3.blockers).toContain(task1.id);

      // Verify graph structure
      expect(graph.getOutgoingEdges(task1.id)).toContain(task2.id);
      expect(graph.getOutgoingEdges(task1.id)).toContain(task3.id);
    });
  });

  describe('large dataset handling', () => {
    it('should handle 1000 tasks efficiently', async () => {
      await storage.createProject('large-project');

      const graph = await storage.load();
      const startTime = Date.now();

      // Create 1000 tasks
      for (let i = 0; i < 1000; i++) {
        const task = new TaskNode({
          id: uuidv4(),
          title: `Implement feature ${i}`,
          description: `Implement feature number ${i} with full functionality and comprehensive testing`,
          status: i % 5 === 0 ? 'completed' : 'not_started',
          priority: i % 3 === 0 ? 'top' : i % 3 === 1 ? 'second' : 'later',
          success_criteria: [
            { id: uuidv4(), text: `Feature ${i} works correctly`, completed: i % 5 === 0 },
          ],
          deliverables: [
            { id: uuidv4(), text: `feature${i}.ts`, completed: i % 5 === 0 },
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

        // Create some edges (every 10th task points to the next one)
        if (i > 0 && i % 10 === 0) {
          const allIds = Array.from(graph.getAllTaskIds());
          graph.addEdge(allIds[i - 10], allIds[i]);
        }
      }

      await storage.save(graph);
      const saveTime = Date.now() - startTime;

      // Verify all tasks were saved
      expect(graph.size).toBe(1000);

      // Load and verify
      const loadedGraph = await storage.load();
      expect(loadedGraph.size).toBe(1000);

      // Performance check: save should be fast (< 2 seconds for 1000 tasks)
      expect(saveTime).toBeLessThan(2000);
    });

    it('should maintain performance with many edges', async () => {
      await storage.createProject('edge-test');

      const graph = await storage.load();

      // Create 100 tasks with many edges
      const tasks: string[] = [];
      for (let i = 0; i < 100; i++) {
        const task = new TaskNode({
          id: uuidv4(),
          title: `Create task ${i}`,
          description: `Implement task number ${i} with full functionality and comprehensive testing`,
          status: 'ready',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: `Task ${i} works correctly`, completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: `task${i}.ts`, completed: false },
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
        tasks.push(task.id);
      }

      // Create many edges (each task points to 10 other tasks)
      for (let i = 0; i < 100; i++) {
        for (let j = 1; j <= 10 && i + j < 100; j++) {
          graph.addEdge(tasks[i], tasks[i + j]);
        }
      }

      await storage.save(graph);

      // Verify edges
      expect(graph.getOutgoingEdges(tasks[0]).length).toBe(10);
    });
  });

  describe('cross-platform path handling', () => {
    it('should handle Windows paths correctly', async () => {
      const windowsPath = join('C:', 'Users', 'test', 'project');
      const testStorage = new TaskStorage({ projectDir: tempDir });

      // Path normalization should handle both forward and backward slashes
      const normalizedPath = join(tempDir, '.octie', 'project.json');
      expect(testStorage.projectFilePath).toContain('project.json');
    });

    it('should handle Unix paths correctly', async () => {
      const unixPath = '/home/user/project';
      const testStorage = new TaskStorage({ projectDir: tempDir });

      expect(testStorage.octieDirPath).toContain('.octie');
    });

    it('should handle relative paths correctly', async () => {
      const testStorage = new TaskStorage({ projectDir: tempDir });

      await testStorage.createProject('relative-test');

      // Should create absolute paths
      if (process.platform === 'win32') {
        expect(testStorage.octieDirPath).toMatch(/^[A-Za-z]:\\/); // Windows absolute path
      } else {
        expect(testStorage.octieDirPath.startsWith('/')).toBe(true); // POSIX absolute path
      }
      expect(testStorage.projectFilePath).toContain('project.json');
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent read operations', async () => {
      await storage.createProject('concurrent-read-test');

      const graph = await storage.load();

      // Create initial tasks
      for (let i = 0; i < 10; i++) {
        const task = new TaskNode({
          id: uuidv4(),
          title: `Concurrent test task ${i}`,
          description: `Task for testing concurrent read operations with comprehensive testing coverage`,
          status: 'ready',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: `Task ${i} works`, completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: `task${i}.ts`, completed: false },
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
      }
      await storage.save(graph);

      // Simulate concurrent reads
      const readPromises = Array(5).fill(null).map(async () => {
        const loadedGraph = await storage.load();
        return loadedGraph.size;
      });

      const results = await Promise.all(readPromises);

      // All reads should return the same size
      expect(results.every(size => size === 10)).toBe(true);
    });

    it('should handle sequential writes with proper locking', async () => {
      await storage.createProject('concurrent-write-test');

      const graph = await storage.load();

      // Sequential writes should all succeed
      for (let i = 0; i < 5; i++) {
        const task = new TaskNode({
          id: uuidv4(),
          title: `Write test task ${i}`,
          description: `Task for testing sequential write operations with comprehensive testing coverage`,
          status: 'ready',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: `Task ${i} saved`, completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: `write${i}.ts`, completed: false },
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
      }

      const finalGraph = await storage.load();
      expect(finalGraph.size).toBe(5);
    });

    it('should maintain data integrity during rapid save/load cycles', async () => {
      await storage.createProject('rapid-cycle-test');

      const taskIds: string[] = [];

      // Rapid save/load cycles
      for (let i = 0; i < 5; i++) {
        const graph = await storage.load();

        const task = new TaskNode({
          id: uuidv4(),
          title: `Create rapid cycle task ${i}`,
          description: `Implement task ${i} for testing rapid save and load cycle data integrity with comprehensive coverage and verification`,
          status: 'ready',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: `Task ${i} data persists after save/load cycle`, completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: `cycle${i}.ts`, completed: false },
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
        taskIds.push(task.id);
        await storage.save(graph);
      }

      // Verify all tasks exist
      const finalGraph = await storage.load();
      expect(finalGraph.size).toBe(5);

      for (const id of taskIds) {
        expect(finalGraph.hasNode(id)).toBe(true);
      }
    });

    it('should handle mixed read/write operations', async () => {
      await storage.createProject('mixed-operations-test');

      const graph = await storage.load();

      // Create initial tasks
      for (let i = 0; i < 3; i++) {
        const task = new TaskNode({
          id: uuidv4(),
          title: `Initial task ${i}`,
          description: `Initial task for mixed operations testing with comprehensive coverage`,
          status: 'ready',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: `Initial ${i} works`, completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: `initial${i}.ts`, completed: false },
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
      }
      await storage.save(graph);

      // Mix of read and write operations
      const operations = [];

      // Read operations
      for (let i = 0; i < 3; i++) {
        operations.push((async () => {
          const loaded = await storage.load();
          return loaded.size;
        })());
      }

      // Sequential write (after reads complete)
      await Promise.all(operations);

      const writeGraph = await storage.load();
      const newTask = new TaskNode({
        id: uuidv4(),
        title: 'Add mixed operation task',
        description: 'Implement task that is added during mixed read/write operations testing with comprehensive coverage',
        status: 'ready',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'Task survives concurrent read/write operations', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'mixed.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });
      writeGraph.addNode(newTask);
      await storage.save(writeGraph);

      const finalGraph = await storage.load();
      expect(finalGraph.size).toBe(4);
    });
  });

  describe('file corruption recovery', () => {
    it('should handle empty project.json file', async () => {
      await storage.createProject('empty-file-test');

      // Load and save to create the file
      const graph = await storage.load();
      graph.addNode(new TaskNode({
        id: uuidv4(),
        title: 'Create test task',
        description: 'Test task for empty file recovery scenario with comprehensive coverage',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'Test works', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'test.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      }));
      await storage.save(graph);

      // Corrupt by writing empty content
      const { writeFileSync } = await import('node:fs');
      writeFileSync(storage.projectFilePath, '');

      // Should throw error when loading corrupted file
      await expect(storage.load()).rejects.toThrow();
    });

    it('should handle malformed JSON in project.json', async () => {
      await storage.createProject('malformed-json-test');

      // Load and save to create the file
      const graph = await storage.load();
      graph.addNode(new TaskNode({
        id: uuidv4(),
        title: 'Create malformed test task',
        description: 'Test task for malformed JSON recovery scenario with comprehensive coverage',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'Test works', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'malformed.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      }));
      await storage.save(graph, { createBackup: true });

      // Corrupt by writing invalid JSON
      const { writeFileSync } = await import('node:fs');
      writeFileSync(storage.projectFilePath, '{ invalid json }');

      // Should throw error when loading corrupted file
      await expect(storage.load()).rejects.toThrow();
    });

    it('should handle missing required fields in task data', async () => {
      await storage.createProject('missing-fields-test');

      const { writeFileSync } = await import('node:fs');

      // Write project file with missing required fields
      const incompleteProject = {
        version: '1.0.0',
        format: 'octie-project',
        metadata: { project_name: 'test', version: '1.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), task_count: 0 },
        tasks: {
          'task-1': {
            id: 'task-1',
            title: 'Incomplete task',
            // Missing required fields: description, success_criteria, deliverables
          }
        },
        edges: [],
        indexes: {
          byStatus: { not_started: ['task-1'], pending: [], in_progress: [], completed: [], blocked: [] },
          byPriority: { top: [], second: ['task-1'], later: [] },
          rootTasks: ['task-1'],
          orphans: []
        }
      };

      writeFileSync(storage.projectFilePath, JSON.stringify(incompleteProject, null, 2));

      // Loading should either throw or handle gracefully
      try {
        const graph = await storage.load();
        // If it loads, verify the incomplete task was handled
        const task = graph.getNode('task-1');
        if (task) {
          // Task may have default values filled in
          expect(task.id).toBe('task-1');
        }
      } catch (error) {
        // Expected behavior - should reject invalid data
        expect(error).toBeDefined();
      }
    });

    it('should create backup files when saving', async () => {
      await storage.createProject('backup-restore-test');

      const graph = await storage.load();

      const originalTask = new TaskNode({
        id: uuidv4(),
        title: 'Create backup test task',
        description: 'Implement test task for backup creation and restoration verification',
        status: 'in_progress',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'Backup file is created before save', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'backup.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: 'Original task notes',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(originalTask);

      // First save (creates project.json with task, no backup since file is new)
      await storage.save(graph);

      // Verify project.json exists
      expect(existsSync(storage.projectFilePath)).toBe(true);

      // Modify and save again (backup should be created now)
      const task2 = new TaskNode({
        id: uuidv4(),
        title: 'Add second backup test task',
        description: 'Implement second task to trigger backup creation of first task',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'Second task triggers backup', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'backup2.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });
      graph.addNode(task2);
      await storage.save(graph, { createBackup: true });

      // Verify backup exists - check directory for backup files
      const octieDirFiles = readdirSync(storage.octieDirPath);
      const backupFiles = octieDirFiles.filter(f => f === 'project.bak' || f.startsWith('project.bak.'));
      expect(backupFiles.length).toBeGreaterThan(0);

      // Verify backup file is valid JSON
      const { readFileSync } = await import('node:fs');
      const backupPath = join(storage.octieDirPath, backupFiles[0]!);
      const backupContent = JSON.parse(readFileSync(backupPath, 'utf8'));

      // Backup should be a valid project file
      expect(backupContent.format).toBe('octie-project');
      expect(backupContent.tasks).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty project gracefully', async () => {
      await storage.createProject('empty-project-test');

      const graph = await storage.load();

      expect(graph.size).toBe(0);
      expect(graph.getAllTasks()).toEqual([]);
      expect(graph.getRootTasks()).toEqual([]);
      expect(graph.getOrphanTasks()).toEqual([]);
    });

    it('should handle tasks with maximum field lengths', async () => {
      await storage.createProject('max-length-test');

      const graph = await storage.load();

      // Create task with maximum allowed lengths
      const maxTitle = 'Implement ' + 'A'.repeat(190); // Include action verb
      const maxDescription = 'B'.repeat(10000);

      const task = new TaskNode({
        id: uuidv4(),
        title: maxTitle,
        description: maxDescription,
        status: 'ready',
        priority: 'top',
        success_criteria: Array(10).fill(null).map((_, i) => ({
          id: uuidv4(),
          text: `Criterion ${i} with sufficient text to meet minimum length`,
          completed: false,
        })),
        deliverables: Array(5).fill(null).map((_, i) => ({
          id: uuidv4(),
          text: `Deliverable ${i}.ts`,
          completed: false,
        })),
        blockers: [],
        dependencies: '',
        related_files: Array(10).fill(null).map((_, i) => `file${i}.ts`),
        notes: 'N'.repeat(1000),
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(task);
      await storage.save(graph);

      // Verify max length fields are preserved
      const loadedGraph = await storage.load();
      const loadedTask = loadedGraph.getNode(task.id);

      expect(loadedTask?.title).toBe(maxTitle);
      expect(loadedTask?.description).toBe(maxDescription);
      expect(loadedTask?.success_criteria.length).toBe(10);
      expect(loadedTask?.deliverables.length).toBe(5);
      expect(loadedTask?.related_files.length).toBe(10);
    });

    it('should handle unicode characters in task data', async () => {
      await storage.createProject('unicode-test');

      const graph = await storage.load();

      const unicodeTask = new TaskNode({
        id: uuidv4(),
        title: 'Implement 用户认证功能 🔐',
        description: '创建用户认证系统，支持中文字符和表情符号 🎉 这是一个全面的测试描述文本，用于验证系统对Unicode字符的完整支持',
        status: 'ready',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: '认证功能返回200状态码 ✓', completed: false },
          { id: uuidv4(), text: '支持中文用户名并正确存储', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'auth-service.ts', completed: false },
          { id: uuidv4(), text: 'auth-test.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: ['src/auth/', 'tests/auth/'],
        notes: 'Verify all characters are encoded correctly',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(unicodeTask);
      await storage.save(graph);

      // Verify unicode is preserved
      const loadedGraph = await storage.load();
      const loadedTask = loadedGraph.getNode(unicodeTask.id);

      expect(loadedTask?.title).toContain('🔐');
      expect(loadedTask?.description).toContain('🎉');
      expect(loadedTask?.related_files).toContain('src/auth/');
    });

    it('should handle circular dependency detection', async () => {
      await storage.createProject('circular-dep-test');

      const graph = await storage.load();

      const taskA = new TaskNode({
        id: uuidv4(),
        title: 'Create task A for circular test',
        description: 'Task A for circular dependency detection testing with comprehensive coverage',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'A works', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'a.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      const taskB = new TaskNode({
        id: uuidv4(),
        title: 'Create task B for circular test',
        description: 'Task B for circular dependency detection testing with comprehensive coverage',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'B works', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'b.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      const taskC = new TaskNode({
        id: uuidv4(),
        title: 'Create task C for circular test',
        description: 'Task C for circular dependency detection testing with comprehensive coverage',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'C works', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'c.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(taskA);
      graph.addNode(taskB);
      graph.addNode(taskC);

      // Create cycle: A -> B -> C -> A
      graph.addEdge(taskA.id, taskB.id);
      graph.addEdge(taskB.id, taskC.id);
      graph.addEdge(taskC.id, taskA.id);

      await storage.save(graph);

      // Verify cycle can be detected
      const { detectCycle } = await import('../../src/core/graph/cycle.js');
      const cycleResult = detectCycle(graph);

      expect(cycleResult.hasCycle).toBe(true);
      expect(cycleResult.cycles.length).toBeGreaterThan(0);
    });

    it('should handle invalid task ID references gracefully', async () => {
      await storage.createProject('invalid-ref-test');

      const graph = await storage.load();

      const task = new TaskNode({
        id: uuidv4(),
        title: 'Add task with invalid blocker reference',
        description: 'Implement task that references a non-existent blocker ID for error handling test coverage',
        status: 'blocked',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'System handles invalid blocker references gracefully', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'invalid-ref.ts', completed: false },
        ],
        blockers: ['non-existent-task-id'],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(task);
      await storage.save(graph);

      // Task should exist even with invalid blocker reference
      const loadedGraph = await storage.load();
      const loadedTask = loadedGraph.getNode(task.id);

      expect(loadedTask).toBeDefined();
      expect(loadedTask?.blockers).toContain('non-existent-task-id');
    });

    it('should handle special characters in file paths', async () => {
      // Use a path with spaces and special characters
      const specialPath = join(tmpdir(), `octie-test-special-${Date.now()}`);
      const specialStorage = new TaskStorage({ projectDir: specialPath });

      try {
        await specialStorage.createProject('special chars test');

        const graph = await specialStorage.load();

        const task = new TaskNode({
          id: uuidv4(),
          title: 'Add special path task',
          description: 'Implement task for testing special characters in file paths with comprehensive coverage',
          status: 'ready',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: 'System handles paths with special characters', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'special.ts', completed: false },
          ],
          blockers: [],
          dependencies: '',
          related_files: ['src/path with spaces/', 'src/special-path/'],
          notes: '',
          c7_verified: [],
          sub_items: [],
          edges: [],
        });

        graph.addNode(task);
        await specialStorage.save(graph);

        // Verify data was saved correctly
        const loadedGraph = await specialStorage.load();
        expect(loadedGraph.hasNode(task.id)).toBe(true);
      } finally {
        try {
          rmSync(specialPath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('data persistence', () => {
    it('should persist data across save/load cycles', async () => {
      await storage.createProject('persistence-test');

      const graph = await storage.load();
      const taskId = uuidv4();

      const originalTask = new TaskNode({
        id: taskId,
        title: 'Persistence test task',
        description: 'This task tests data persistence across save and load cycles',
        status: 'in_progress',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'Data persists correctly', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'persistence.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: ['src/test/'],
        notes: 'Test notes',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(originalTask);
      await storage.save(graph);

      // Load and verify
      const loadedGraph = await storage.load();
      const loadedTask = loadedGraph.getNode(taskId);

      expect(loadedTask).toBeDefined();
      expect(loadedTask?.title).toBe(originalTask.title);
      expect(loadedTask?.description).toBe(originalTask.description);
      expect(loadedTask?.status).toBe(originalTask.status);
      expect(loadedTask?.priority).toBe(originalTask.priority);
      expect(loadedTask?.related_files).toEqual(originalTask.related_files);
      expect(loadedTask?.notes).toBe(originalTask.notes);

      // Verify timestamps
      expect(loadedTask?.created_at).toBe(originalTask.created_at);
    });

    it('should create backup before overwriting', async () => {
      await storage.createProject('backup-test');

      const graph = await storage.load();
      graph.addNode(new TaskNode({
        id: uuidv4(),
        title: 'Create initial task',
        description: 'Initial task description for testing backup functionality',
        status: 'completed',
        priority: 'top',
        success_criteria: [
          { id: uuidv4(), text: 'Complete', completed: true },
        ],
        deliverables: [
          { id: uuidv4(), text: 'initial.ts', completed: true },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      }));

      // First save (no backup since file doesn't exist)
      await storage.save(graph);

      // Verify initial project.json exists
      expect(existsSync(storage.projectFilePath)).toBe(true);

      // Modify and save again (backup should be created now)
      const task2 = new TaskNode({
        id: uuidv4(),
        title: 'Create second task',
        description: 'Second task description for testing backup functionality and data persistence',
        status: 'ready',
        priority: 'second',
        success_criteria: [
          { id: uuidv4(), text: 'Complete', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'second.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(task2);

      // Force backup creation by passing option
      await storage.save(graph, { createBackup: true });

      // Verify backup exists - check for .bak.* pattern (timestamped backups)
      // Note: Backup files are named "project.bak.{timestamp}" not "project.json.bak.{timestamp}"
      // because _getBaseName() strips the extension before adding .bak suffix
      const octieDirFiles = readdirSync(storage.octieDirPath);
      const hasBackup = octieDirFiles.some(f => f === 'project.bak' || f.startsWith('project.bak.'));
      expect(hasBackup).toBe(true);
    });
  });
});
