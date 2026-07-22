/**
 * Update Command Unit Tests
 *
 * Tests for update command including:
 * - Task status updates
 * - Priority updates
 * - Success criterion completion
 * - Deliverable completion
 * - Blocker management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { execSync } from 'node:child_process';

describe('update command', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;
  let testTaskId: string;
  let criterionId: string;
  let deliverableId: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');

    // CLI entry point
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    // Create test task
    const graph = await storage.load();
    testTaskId = uuidv4();
    criterionId = uuidv4();
    deliverableId = uuidv4();

    const task = new TaskNode({
      id: testTaskId,
      title: 'Implement login endpoint',
      description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
      status: 'ready',
      priority: 'second',
      success_criteria: [
        { id: criterionId, text: 'Endpoint returns 200 with valid JWT', completed: false },
      ],
      deliverables: [
        { id: deliverableId, text: 'src/api/auth/login.ts', completed: false },
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

  afterEach(async () => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('priority updates', () => {
    it('should update task priority to top', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --priority top`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.priority).toBe('top');
    });

    it('should update task priority to later', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --priority later`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.priority).toBe('later');
    });

    it('should reject invalid priority value', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --priority urgent`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('invalid');
      expect(errorMsg).toContain('urgent');
      expect(errorMsg).toContain('top, second, later');
    });
  });

  describe('success criterion completion', () => {
    it('should add new success criterion', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --add-success-criterion "Unit tests pass"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.success_criteria.length).toBe(2);
    });

    it('should mark success criterion as complete', async () => {
      // Complete the criterion
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-criterion "${criterionId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const criterion = task?.success_criteria.find(c => c.id === criterionId);
      expect(criterion?.completed).toBe(true);
    });
  });

  describe('criterion evidence', () => {
    it('should store evidence when completing a criterion with --evidence', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-criterion "${criterionId}" --evidence "0.86 ms median, n=810"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const criterion = task?.success_criteria.find(c => c.id === criterionId);
      expect(criterion?.completed).toBe(true);
      expect(criterion?.evidence).toBe('0.86 ms median, n=810');
    });

    it('should reject --evidence without --complete-criterion', () => {
      let errorMsg = '';
      let exitCode = 0;
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --evidence "some proof"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        exitCode = err.status;
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(exitCode).toBe(1);
      expect(errorMsg).toContain('--evidence requires --complete-criterion');
    });

    it('should leave pre-evidence criteria without an evidence key on load', async () => {
      // The beforeEach fixture writes a criterion with no evidence field (pre-evidence format)
      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const criterion = task?.success_criteria.find(c => c.id === criterionId);
      expect(criterion).toBeDefined();
      expect(criterion?.evidence).toBeUndefined();
    });
  });

  describe('deliverable completion', () => {
    it('should add new deliverable', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --add-deliverable "tests/api/auth/login.test.ts"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.deliverables.length).toBe(2);
    });

    it('should mark deliverable as complete', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-deliverable "${deliverableId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const deliverable = task?.deliverables.find(d => d.id === deliverableId);
      expect(deliverable?.completed).toBe(true);
    });
  });

  describe('blocker management', () => {
    it('should add blocker to task with dependency explanation (twin)', async () => {
      // Create another task to use as blocker
      const graph = await storage.load();
      const blockerTaskId = uuidv4();

      const blockerTask = new TaskNode({
        id: blockerTaskId,
        title: 'Blocker task',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Complete', completed: false }],
        deliverables: [{ id: uuidv4(), text: 'output.ts', completed: false }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(blockerTask);
      await storage.save(graph);

      // Add blocker with dependency explanation (twin validation)
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --blockers "${blockerTaskId}" --dependency-explanation "Needs output from blocker task"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const updatedGraph = await storage.load();
      const task = updatedGraph.getNode(testTaskId);
      expect(task?.blockers).toContain(blockerTaskId);
      expect(task?.dependencies).toContain('Needs output from blocker task');
    });

    /**
     * Create two blocker tasks and return their IDs
     */
    async function seedTwoBlockers(): Promise<{ blockerA: string; blockerB: string }> {
      const graph = await storage.load();
      const blockerA = uuidv4();
      const blockerB = uuidv4();
      for (const [id, title] of [[blockerA, 'Blocker task A'], [blockerB, 'Blocker task B']] as const) {
        graph.addNode(new TaskNode({
          id,
          title,
          description: 'Valid description that is long enough to meet minimum requirements',
          status: 'ready',
          priority: 'top',
          success_criteria: [{ id: uuidv4(), text: 'Complete', completed: false }],
          deliverables: [{ id: uuidv4(), text: 'output.ts', completed: false }],
          blockers: [],
          dependencies: '',
          related_files: [],
          notes: '',
          c7_verified: [],
          sub_items: [],
          edges: [],
        }));
      }
      await storage.save(graph);
      return { blockerA, blockerB };
    }

    it('should reject comma-separated --blockers with a one-per-call error', async () => {
      const { blockerA, blockerB } = await seedTwoBlockers();

      let exitCode = 0;
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --blockers "${blockerA},${blockerB}" --dependency-explanation "Needs both outputs"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        exitCode = err.status;
        errorMsg = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
      }

      expect(exitCode).toBe(1);
      expect(errorMsg).toContain('one task ID per call');
      expect(errorMsg).toContain('Received 2 IDs');

      // Nothing was applied
      const after = await storage.load();
      expect(after.getNode(testTaskId)?.blockers.length).toBe(0);
    });

    it('should reject repeated --blockers flags instead of silently keeping the last', async () => {
      const { blockerA, blockerB } = await seedTwoBlockers();

      let exitCode = 0;
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --blockers "${blockerA}" --blockers "${blockerB}" --dependency-explanation "Needs both outputs"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        exitCode = err.status;
        errorMsg = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
      }

      expect(exitCode).toBe(1);
      expect(errorMsg).toContain('one task ID per call');
      expect(errorMsg).toContain('Received 2 IDs');

      // Nothing was applied
      const after = await storage.load();
      expect(after.getNode(testTaskId)?.blockers.length).toBe(0);
    });
  });

  describe('notes', () => {
    it('should append notes to task', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --notes "Use bcrypt with 10 rounds"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.notes).toContain('bcrypt');
    });

    it('should append multiple notes with multiple --notes flags', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--notes "First note" ` +
        `--notes "Second note" ` +
        `--notes "Third note"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.notes).toContain('First note');
      expect(task?.notes).toContain('Second note');
      expect(task?.notes).toContain('Third note');
    });
  });

  describe('remove operations', () => {
    it('should remove a success criterion', async () => {
      // First add a second criterion so we can remove one
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --add-success-criterion "Unit tests pass"`,
        { encoding: 'utf-8' }
      );

      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-criterion "${criterionId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.success_criteria.length).toBe(1);
      expect(task?.success_criteria.find(c => c.id === criterionId)).toBeUndefined();
    });

    it('should reject removing last success criterion', async () => {
      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-criterion "${criterionId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should remove a deliverable', async () => {
      // First add a second deliverable so we can remove one
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --add-deliverable "tests/api/auth/login.test.ts"`,
        { encoding: 'utf-8' }
      );

      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-deliverable "${deliverableId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.deliverables.length).toBe(1);
      expect(task?.deliverables.find(d => d.id === deliverableId)).toBeUndefined();
    });

    it('should reject removing last deliverable', async () => {
      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-deliverable "${deliverableId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should set and clear dependencies explanation', async () => {
      // Create another task to use as blocker
      const graph = await storage.load();
      const blockerTaskId = uuidv4();

      const blockerTask = new TaskNode({
        id: blockerTaskId,
        title: 'Implement blocker task',
        description: 'Valid description that is long enough to meet minimum requirements for the test case',
        status: 'ready',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Complete', completed: false }],
        deliverables: [{ id: uuidv4(), text: 'output.ts', completed: false }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });

      graph.addNode(blockerTask);
      await storage.save(graph);

      // Add blocker with dependency explanation (twin validation)
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --blockers "${blockerTaskId}" --dependency-explanation "Needs output from blocker"`,
        { encoding: 'utf-8' }
      );

      let updatedGraph = await storage.load();
      let task = updatedGraph.getNode(testTaskId);
      expect(task?.blockers).toContain(blockerTaskId);
      expect(task?.dependencies).toBe('Needs output from blocker');

      // Clear dependencies by removing the blocker (auto-clear)
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --unblock "${blockerTaskId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');
      expect(output).toContain('cleared');

      updatedGraph = await storage.load();
      task = updatedGraph.getNode(testTaskId);
      expect(task?.blockers).not.toContain(blockerTaskId);
      expect(task?.dependencies).toBe('');
    });

    it('should add and remove a related file', async () => {
      // Add related file
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --add-related-file "src/auth/login.ts"`,
        { encoding: 'utf-8' }
      );

      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      expect(task?.related_files).toContain('src/auth/login.ts');

      // Remove related file
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-related-file "src/auth/login.ts"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.related_files).not.toContain('src/auth/login.ts');
    });

    it('should reject removing non-existent criterion', async () => {
      const fakeId = uuidv4();
      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-criterion "${fakeId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should reject removing non-existent deliverable', async () => {
      const fakeId = uuidv4();
      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-deliverable "${fakeId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('C7 verification operations', () => {
    it('should add C7 verification with library ID only', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --verify-c7 "/expressjs/express"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.c7_verified).toHaveLength(1);
      expect(task?.c7_verified[0].library_id).toBe('/expressjs/express');
    });

    it('should add C7 verification with library ID and notes', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --verify-c7 "/mongodb/docs:Query patterns"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.c7_verified).toHaveLength(1);
      expect(task?.c7_verified[0].library_id).toBe('/mongodb/docs');
      expect(task?.c7_verified[0].notes).toBe('Query patterns');
    });

    it('should remove C7 verification', async () => {
      // First add a verification
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --verify-c7 "/expressjs/express"`,
        { encoding: 'utf-8' }
      );

      // Then remove it
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-c7-verified "/expressjs/express"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.c7_verified).toHaveLength(0);
    });

    it('should normalize Git Bash converted C7 paths when adding and removing verification', async () => {
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --verify-c7 "C:/Program Files/Git/mongodb/docs:Query patterns"`,
        { encoding: 'utf-8' }
      );

      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      expect(task?.c7_verified[0]?.library_id).toBe('/mongodb/docs');

      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --remove-c7-verified "C:/Program Files/Git/mongodb/docs"`,
        { encoding: 'utf-8' }
      );

      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.c7_verified).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should reject invalid task ID', () => {
      const fakeId = uuidv4();

      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${fakeId} --priority top`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should reject invalid priority value', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --priority urgent`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('invalid');
      expect(errorMsg).toContain('top, second, later');
    });

    it('should accept valid priority value "second"', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --priority second`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.priority).toBe('second');
    });
  });

  describe('notes file option', () => {
    let notesDir: string;

    beforeEach(() => {
      notesDir = join(tmpdir(), `octie-notes-${uuidv4()}`);
      mkdirSync(notesDir, { recursive: true });
    });

    afterEach(() => {
      try {
        rmSync(notesDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should append notes from file to existing task notes', async () => {
      const notesFile = join(notesDir, 'test-notes.txt');
      writeFileSync(notesFile, 'This is additional context from file.\nWith multiple lines.');

      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.notes).toContain('This is additional context from file.');
      expect(task?.notes).toContain('With multiple lines.');
    });

    it('should handle markdown files', async () => {
      const notesFile = join(notesDir, 'notes.md');
      writeFileSync(notesFile, '# Implementation Notes\n\n- Item 1\n- Item 2\n\n```typescript\nconst x = 1;\n```');

      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.notes).toContain('# Implementation Notes');
      expect(task?.notes).toContain('const x = 1;');
    });

    it('should reject non-existent notes file', () => {
      const missingFile = join(notesDir, 'missing.txt');

      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --notes-file "${missingFile}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should trim whitespace from file content', async () => {
      const notesFile = join(notesDir, 'padded.txt');
      writeFileSync(notesFile, '   \n  Trimmed content  \n   ');

      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      // The content should be trimmed but not completely empty
      expect(task?.notes).toContain('Trimmed content');
    });

    it('should work with both --notes and --notes-file together', async () => {
      const notesFile = join(notesDir, 'combined.txt');
      writeFileSync(notesFile, 'File content here');

      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --notes "Inline note" --notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.notes).toContain('Inline note');
      expect(task?.notes).toContain('File content here');
    });
  });

  describe('help', () => {
    it('should show help with --help flag', () => {
      const output = execSync(`node ${cliPath} update --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Update an existing task');
      expect(output).toContain('--priority');
      expect(output).toContain('--add-deliverable');
      expect(output).toContain('--complete-criterion');
      expect(output).toContain('--dependency-explanation');
      expect(output).not.toContain('--dependencies <text>');
    });
  });

  describe('multiple ID support for complete operations', () => {
    let criterionId2: string;
    let deliverableId2: string;

    beforeEach(async () => {
      // Add second criterion and deliverable for multi-complete tests
      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      if (task) {
        criterionId2 = uuidv4();
        deliverableId2 = uuidv4();
        task.addSuccessCriterion({ id: criterionId2, text: 'Second criterion for testing', completed: false });
        task.addDeliverable({ id: deliverableId2, text: 'second-file.ts', completed: false });
        graph.updateNode(task);
        await storage.save(graph);
      }
    });

    it('should complete single deliverable (backward compatibility)', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-deliverable "${deliverableId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const deliverable = task?.deliverables.find(d => d.id === deliverableId);
      expect(deliverable?.completed).toBe(true);
    });

    it('should complete multiple deliverables with comma-separated format', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-deliverable "${deliverableId},${deliverableId2}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const del1 = task?.deliverables.find(d => d.id === deliverableId);
      const del2 = task?.deliverables.find(d => d.id === deliverableId2);
      expect(del1?.completed).toBe(true);
      expect(del2?.completed).toBe(true);
    });

    it('should complete multiple criteria with comma-separated format', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-criterion "${criterionId},${criterionId2}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const crit1 = task?.success_criteria.find(c => c.id === criterionId);
      const crit2 = task?.success_criteria.find(c => c.id === criterionId2);
      expect(crit1?.completed).toBe(true);
      expect(crit2?.completed).toBe(true);
    });

    it('should complete single criterion (backward compatibility)', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-criterion "${criterionId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      const criterion = task?.success_criteria.find(c => c.id === criterionId);
      expect(criterion?.completed).toBe(true);
    });

    it('should handle invalid IDs gracefully in multi-complete', async () => {
      // First criterion is valid, second is invalid
      // The CLI should complete the first and error on the second
      expect(() => {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} --complete-criterion "${criterionId},invalid-uuid"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('twin validation (block + dependencies)', () => {
    let blockerTaskId: string;

    beforeEach(async () => {
      // Create a blocker task
      const blockerOutput = execSync(
        `node ${cliPath} --project "${tempDir}" create ` +
        `--title "Blocker task for twin test" ` +
        `--description "This is a blocker task that will be used to test twin validation in update command" ` +
        `--success-criterion "Blocker complete" ` +
        `--deliverable "blocker.ts"`,
        { encoding: 'utf-8' }
      );
      const match = blockerOutput.match(/Task created: ([a-f0-9-]+)/);
      blockerTaskId = match?.[1] || '';
    });

    it('should add blocker with dependencies (twin)', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--blockers "${blockerTaskId}" ` +
        `--dependency-explanation "Needs blocker output to proceed"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.blockers).toContain(blockerTaskId);
      expect(task?.dependencies).toContain('Needs blocker output to proceed');
    });

    it('should reject --blockers without --dependency-explanation', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--blockers "${blockerTaskId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('block');
      expect(errorMsg).toContain('dependency-explanation');
      expect(errorMsg).toContain('required');
    });

    it('should still accept --dependencies as an alias', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--blockers "${blockerTaskId}" ` +
        `--dependencies "Needs blocker output to proceed"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.blockers).toContain(blockerTaskId);
      expect(task?.dependencies).toContain('Needs blocker output to proceed');
    });

    it('should auto-clear dependencies when last blocker is removed', async () => {
      // First add a blocker with dependencies
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--blockers "${blockerTaskId}" ` +
        `--dependency-explanation "Initial dependency explanation"`,
        { encoding: 'utf-8' }
      );

      // Verify blocker and dependencies are set
      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      expect(task?.blockers).toContain(blockerTaskId);
      expect(task?.dependencies).toContain('Initial dependency');

      // Remove the blocker
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--unblock "${blockerTaskId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');
      expect(output).toContain('dependencies');
      expect(output).toContain('cleared');

      // Verify blocker removed and dependencies cleared
      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.blockers).not.toContain(blockerTaskId);
      expect(task?.dependencies).toBe('');
    });

    it('should show current dependencies info on partial update attempt', () => {
      // First set up blockers and dependencies
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--blockers "${blockerTaskId}" ` +
        `--dependency-explanation "Current dependency reason"`,
        { encoding: 'utf-8' }
      );

      // Try to add another blocker without dependency-explanation
      let errorMsg = '';
      try {
        // Create another blocker
        const blocker2Output = execSync(
          `node ${cliPath} --project "${tempDir}" create ` +
          `--title "Second blocker" ` +
          `--description "Another blocker task for testing partial update error messages" ` +
          `--success-criterion "Complete" ` +
          `--deliverable "blocker2.ts"`,
          { encoding: 'utf-8' }
        );
        const match = blocker2Output.match(/Task created: ([a-f0-9-]+)/);
        const blocker2Id = match?.[1] || '';

        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--blockers "${blocker2Id}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      // Error should show current dependencies info
      expect(errorMsg).toContain('dependency-explanation');
      expect(errorMsg).toContain('required');
    });

    it('should add blocker using short UUID prefix', async () => {
      // Use first 8 characters of blocker task ID
      const shortId = blockerTaskId.substring(0, 8);

      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--blockers "${shortId}" ` +
        `--dependency-explanation "Needs blocker output to proceed"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      // Should contain the FULL UUID, not the short one
      expect(task?.blockers).toContain(blockerTaskId);
    });

    it('should unblock using short UUID prefix', async () => {
      // First add a blocker with dependencies using short UUID
      const shortId = blockerTaskId.substring(0, 8);
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--blockers "${shortId}" ` +
        `--dependency-explanation "Initial dependency explanation"`,
        { encoding: 'utf-8' }
      );

      // Verify blocker was added
      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      expect(task?.blockers).toContain(blockerTaskId);

      // Now remove using short UUID
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--unblock "${shortId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');
      expect(output).toContain('dependencies explanation cleared');

      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.blockers).not.toContain(blockerTaskId);
      expect(task?.dependencies).toBe('');
    });

    it('should reject --blockers with invalid short UUID', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--blockers "invalid1" ` +
          `--dependency-explanation "Test"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('not found');
      expect(errorMsg).toContain('invalid1');
    });

    it('should reject --unblock with invalid short UUID', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--unblock "invalid1"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('not found');
      expect(errorMsg).toContain('invalid1');
    });

    it('should reject self-blocking (task cannot block itself)', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--blockers "${testTaskId}" ` +
          `--dependency-explanation "Self block test"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('cannot block itself');
    });

    it('should reject adding blocker that would create a cycle', async () => {
      // Create two tasks: A and B
      const graph = await storage.load();

      const taskAId = uuidv4();
      const taskA = new TaskNode({
        id: taskAId,
        title: 'Task A for cycle test',
        description: 'First task in potential cycle - testing that the system prevents cycle creation',
        status: 'ready',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Complete', completed: false }],
        deliverables: [{ id: uuidv4(), text: 'a.ts', completed: false }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });
      graph.addNode(taskA);

      const taskBId = uuidv4();
      const taskB = new TaskNode({
        id: taskBId,
        title: 'Task B for cycle test',
        description: 'Second task in potential cycle - testing that the system prevents cycle creation',
        status: 'ready',
        priority: 'top',
        success_criteria: [{ id: uuidv4(), text: 'Complete', completed: false }],
        deliverables: [{ id: uuidv4(), text: 'b.ts', completed: false }],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      });
      graph.addNode(taskB);
      await storage.save(graph);

      // Make B block A
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${taskAId} ` +
        `--blockers "${taskBId}" ` +
        `--dependency-explanation "B blocks A"`,
        { encoding: 'utf-8' }
      );

      // Try to make A block B (would create cycle: A -> B -> A)
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${taskBId} ` +
          `--blockers "${taskAId}" ` +
          `--dependency-explanation "A blocks B"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('cycle');
    });
  });

  describe('need_fix operations', () => {
    it('should add a need_fix item with default source (review)', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Found null pointer in edge case"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.need_fix).toHaveLength(1);
      expect(task?.need_fix[0].text).toBe('Found null pointer in edge case');
      expect(task?.need_fix[0].source).toBe('review');
      expect(task?.need_fix[0].completed).toBe(false);
    });

    it('should add a need_fix item with explicit source', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Runtime error on null input" ` +
        `--need-fix-source runtime`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.need_fix).toHaveLength(1);
      expect(task?.need_fix[0].source).toBe('runtime');
    });

    it('should add a need_fix item with file path', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Type error in login.ts" ` +
        `--need-fix-source review ` +
        `--need-fix-file "src/api/auth/login.ts"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.need_fix).toHaveLength(1);
      expect(task?.need_fix[0].file_path).toBe('src/api/auth/login.ts');
    });

    it('should add regression need_fix item', async () => {
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Feature broke after recent changes" ` +
        `--need-fix-source regression`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.need_fix).toHaveLength(1);
      expect(task?.need_fix[0].source).toBe('regression');
    });

    it('should reject invalid need_fix source', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--add-need-fix "Test issue" ` +
          `--need-fix-source invalid`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('invalid');
      expect(errorMsg).toContain('review, runtime, regression');
    });

    it('should complete a need_fix item', async () => {
      // First add a need_fix item
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Issue to resolve"`,
        { encoding: 'utf-8' }
      );

      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      const needFixId = task?.need_fix[0].id;

      // Now complete it
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--complete-need-fix "${needFixId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.need_fix[0].completed).toBe(true);
    });

    it('should complete need_fix item using short UUID', async () => {
      // First add a need_fix item
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Issue with short UUID test"`,
        { encoding: 'utf-8' }
      );

      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      const needFixId = task?.need_fix[0].id;
      const shortId = needFixId?.substring(0, 8);

      // Complete using short UUID
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--complete-need-fix "${shortId}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.need_fix[0].completed).toBe(true);
    });

    it('should reject completing non-existent need_fix item', () => {
      const fakeId = uuidv4();
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
          `--complete-need-fix "${fakeId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('not found');
    });

    it('should add multiple need_fix items', async () => {
      // Add first need_fix
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "First issue"`,
        { encoding: 'utf-8' }
      );

      // Add second need_fix
      const output = execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Second issue"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task updated');

      const graph = await storage.load();
      const task = graph.getNode(testTaskId);
      expect(task?.need_fix).toHaveLength(2);
    });

    it('should change task status to in_progress when need_fix is added to ready task', async () => {
      // Task starts as ready
      let graph = await storage.load();
      let task = graph.getNode(testTaskId);
      expect(task?.status).toBe('ready');

      // Add need_fix item
      execSync(
        `node ${cliPath} --project "${tempDir}" update ${testTaskId} ` +
        `--add-need-fix "Found an issue"`,
        { encoding: 'utf-8' }
      );

      // Verify status changed to in_progress
      graph = await storage.load();
      task = graph.getNode(testTaskId);
      expect(task?.status).toBe('in_progress');
    });
  });
});
