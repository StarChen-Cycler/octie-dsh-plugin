/**
 * Graph Command Unit Tests
 *
 * Tests for graph command including:
 * - Graph validation
 * - Cycle detection
 * - Topological sort
 * - Critical path
 * - Orphan detection
 * - Statistics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { execSync } from 'node:child_process';

describe('graph command', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');

    // CLI entry point
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    // Create test tasks with dependencies
    const graph = await storage.load();

    const task1 = new TaskNode({
      id: uuidv4(),
      title: 'Create root test node for graph validation',
      description: 'Create a root task node in the graph to test graph command validation and traversal functionality',
      status: 'completed',
      priority: 'top',
      success_criteria: [{ id: uuidv4(), text: 'Node is added to graph', completed: true }],
      deliverables: [{ id: uuidv4(), text: 'src/graph/root.ts', completed: true }],
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
      title: 'Add child test node for graph operations',
      description: 'Add a child task node to test graph operations and edge traversal between parent and child nodes',
      status: 'in_progress',
      priority: 'second',
      success_criteria: [{ id: uuidv4(), text: 'Node is connected to root', completed: false }],
      deliverables: [{ id: uuidv4(), text: 'src/graph/child.ts', completed: false }],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });

    const task3 = new TaskNode({
      id: uuidv4(),
      title: 'Create orphan test node for isolation testing',
      description: 'Create an orphan task node with no dependencies to test graph isolation and orphan detection',
      status: 'ready',
      priority: 'later',
      success_criteria: [{ id: uuidv4(), text: 'Node has no edges', completed: false }],
      deliverables: [{ id: uuidv4(), text: 'src/graph/orphan.ts', completed: false }],
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

    // Create edge: task1 -> task2
    graph.addEdge(task1.id, task2.id);

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

  describe('validate subcommand', () => {
    it('should validate graph structure', () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" graph validate`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('valid');
    });

    it('should detect cycles in cyclic graph', async () => {
      // Create cyclic graph
      const graph = await storage.load();
      const taskIds = Array.from(graph.getAllTaskIds());

      // Create a cycle
      graph.addEdge(taskIds[1], taskIds[0]); // child -> parent
      await storage.save(graph);

      // Command exits with error when cycles found - catch the error
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" graph validate`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        // Check that stderr contains cycle message
        expect(err.stderr).toContain('cycle');
        return;
      }
      // If no error thrown, test should fail
      expect(true).toBe(false); // Should not reach here
    });
  });

  describe('cycles subcommand', () => {
    it('should detect no cycles in acyclic graph', () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" graph cycles`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('No cycles');
    });

    it('should detect cycles in cyclic graph', async () => {
      const graph = await storage.load();
      const taskIds = Array.from(graph.getAllTaskIds());

      // Create a cycle
      graph.addEdge(taskIds[1], taskIds[0]);
      await storage.save(graph);

      // Command exits with error when cycles found - catch the error
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" graph cycles`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        // Check that stderr contains cycle message
        expect(err.stderr).toContain('cycle');
        return;
      }
      // If no error thrown, test should fail
      expect(true).toBe(false); // Should not reach here
    });
  });

  describe('help', () => {
    it('should show help with --help flag', () => {
      const output = execSync(`node ${cliPath} graph --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Graph analysis');
      expect(output).toContain('validate');
      expect(output).toContain('cycles');
      // Note: topology, critical-path, orphans, stats subcommands not yet implemented
    });
  });
});
