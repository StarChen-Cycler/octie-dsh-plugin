/**
 * Create Command Unit Tests
 *
 * Tests for create command functionality including:
 * - Task creation with all required fields
 * - Atomic task validation
 * - Error handling for invalid input
 * - Blockers and dependencies handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { TaskGraphStore } from '../../../../src/core/graph/index.js';
import { execSync } from 'node:child_process';
import { executeTaskCreation, preflightTaskCreation } from '../../../../src/cli/commands/shared-helpers.js';

describe('create command', () => {
  let tempDir: string;
  let storage: TaskStorage;
  let graph: TaskGraphStore;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('test-project');
    graph = await storage.load();
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('task creation with required fields', () => {
    it('should create task with all required fields', () => {
      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      graph.addNode(task);
      expect(graph.size).toBe(1);

      const retrieved = graph.getNode(taskId);
      expect(retrieved?.title).toBe('Implement login endpoint');
      expect(retrieved?.status).toBe('ready');
      expect(retrieved?.priority).toBe('second');
    });

    it('should accept multiple success criteria', () => {
      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        title: 'Add password hashing',
        description: 'Create hashPassword function using bcrypt with 10 salt rounds for secure password storage',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'hashPassword function returns bcrypt hash', completed: false },
          { id: uuidv4(), text: 'Hash uses 10 salt rounds', completed: false },
          { id: uuidv4(), text: 'Unit tests pass with 100% coverage', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/auth/hashing.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.success_criteria.length).toBe(3);
    });

    it('should accept multiple deliverables', () => {
      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        title: 'Write unit tests',
        description: 'Create comprehensive unit tests for User model with full coverage of all methods and edge cases',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'All tests pass', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'tests/models/user.test.ts', completed: false },
          { id: uuidv4(), text: 'tests/models/user.factory.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.deliverables.length).toBe(2);
    });
  });

  describe('atomic task validation', () => {
    it('should reject vague title without action verb', () => {
      const taskData = {
        id: uuidv4(),
        title: 'Fix stuff',
        description: 'Fix various issues in the codebase to improve overall quality and performance',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Issues are fixed', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'fixed-code.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });

    it('should reject description that is too short (< 50 chars)', () => {
      const taskData = {
        id: uuidv4(),
        title: 'Implement login',
        description: 'Add login',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Login works', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'login.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });

    it('should reject too many success criteria (> 10)', () => {
      const criteria = Array.from({ length: 11 }, () => ({
        id: uuidv4(),
        text: 'Criterion',
        completed: false,
      }));

      const taskData = {
        id: uuidv4(),
        title: 'Too many criteria',
        description: 'This task has too many success criteria and should be split into smaller tasks',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: criteria,
        deliverables: [
          { id: uuidv4(), text: 'output.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });

    it('should reject too many deliverables (> 5)', () => {
      const deliverables = Array.from({ length: 6 }, () => ({
        id: uuidv4(),
        text: 'file.ts',
        completed: false,
      }));

      const taskData = {
        id: uuidv4(),
        title: 'Too many deliverables',
        description: 'This task has too many deliverables and should be split into smaller tasks',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'All deliverables complete', completed: false },
        ],
        deliverables: deliverables,
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });

    it('should reject subjective success criteria', () => {
      const taskData = {
        id: uuidv4(),
        title: 'Make code better',
        description: 'Improve the code quality significantly through refactoring and optimization',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Code is good', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'better-code.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });

    it('should accept valid atomic task', () => {
      const taskData = {
        id: uuidv4(),
        title: 'Implement login endpoint with JWT',
        description: 'Create POST /auth/login endpoint that accepts username/password and returns JWT token with 1 hour expiration',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT on correct credentials', completed: false },
          { id: uuidv4(), text: 'Endpoint returns 401 on invalid credentials', completed: false },
          { id: uuidv4(), text: 'Password is hashed with bcrypt before comparison', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          { id: uuidv4(), text: 'tests/api/auth/login.test.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.title).toBe('Implement login endpoint with JWT');
    });
  });

  describe('error handling', () => {
    it('should reject empty title', () => {
      const taskData = {
        id: uuidv4(),
        title: '',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Criterion', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'output.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });

    it('should reject empty description', () => {
      const taskData = {
        id: uuidv4(),
        title: 'Implement feature',
        description: '',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Criterion', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'output.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      expect(() => new TaskNode(taskData)).toThrow();
    });
  });

  describe('priority and options', () => {
    it('should set priority to top', () => {
      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        title: 'Critical fix',
        description: 'Fix critical security vulnerability in authentication system immediately',
        status: 'ready' as const,
        priority: 'top' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Vulnerability fixed', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'fix.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.priority).toBe('top');
    });

    it('should default priority to second', () => {
      const taskData = {
        id: uuidv4(),
        title: 'Create test task',
        description: 'Valid description that is long enough to meet minimum requirements for testing',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Criterion', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'output.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.priority).toBe('second');
    });
  });

  describe('blockers and dependencies', () => {
    it('should create task with blockers', () => {
      const blockerId = uuidv4();
      const taskId = uuidv4();

      // Create blocker task first
      const blockerData = {
        id: blockerId,
        title: 'Implement blocker task',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready' as const,
        priority: 'top' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Blocker complete', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'blocker.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const blocker = new TaskNode(blockerData);
      graph.addNode(blocker);

      // Create dependent task
      const taskData = {
        id: taskId,
        title: 'Create dependent task',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Dependent complete', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'dependent.ts', completed: false },
        ],
        blockers: [blockerId],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.blockers).toContain(blockerId);
    });

    it('should accept multiple blockers', () => {
      const blocker1Id = uuidv4();
      const blocker2Id = uuidv4();
      const taskId = uuidv4();

      // Create blocker tasks
      const blocker1Data = {
        id: blocker1Id,
        title: 'Implement first blocker task',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready' as const,
        priority: 'top' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Complete', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'blocker1.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const blocker2Data = {
        id: blocker2Id,
        title: 'Implement second blocker task',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready' as const,
        priority: 'top' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Complete', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'blocker2.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      graph.addNode(new TaskNode(blocker1Data));
      graph.addNode(new TaskNode(blocker2Data));

      const taskData = {
        id: taskId,
        title: 'Create dependent task',
        description: 'Valid description that is long enough to meet minimum requirements',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Dependent complete', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'dependent.ts', completed: false },
        ],
        blockers: [blocker1Id, blocker2Id],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.blockers.length).toBe(2);
    });
  });

  describe('C7 verification', () => {
    it('should create task with C7 verification', () => {
      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [
          { library_id: '/expressjs/express', verified_at: new Date().toISOString() },
        ],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.c7_verified).toHaveLength(1);
      expect(task.c7_verified[0].library_id).toBe('/expressjs/express');
    });

    it('should create task with C7 verification including notes', () => {
      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
        status: 'ready' as const,
        priority: 'second' as const,
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
        blockers: [],
        dependencies: '',
        related_files: [],
        notes: '',
        c7_verified: [
          { library_id: '/mongodb/docs', verified_at: new Date().toISOString(), notes: 'Query patterns' },
        ],
        sub_items: [],
        edges: [],
      };

      const task = new TaskNode(taskData);
      expect(task.c7_verified).toHaveLength(1);
      expect(task.c7_verified[0].library_id).toBe('/mongodb/docs');
      expect(task.c7_verified[0].notes).toBe('Query patterns');
    });
  });

  describe('C7 verification (CLI integration)', () => {
    let cliTempDir: string;
    let cliStorage: TaskStorage;
    let cliPath: string;

    beforeEach(async () => {
      cliTempDir = join(tmpdir(), `octie-cli-c7-${uuidv4()}`);
      cliStorage = new TaskStorage({ projectDir: cliTempDir });
      await cliStorage.createProject('cli-c7-project');
      cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
    });

    afterEach(() => {
      try {
        rmSync(cliTempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should normalize Git Bash converted C7 paths during create', async () => {
      execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement create C7 normalization task" ` +
        `--description "Create a task so Git Bash converted C7 paths are normalized during CLI task creation and stored as canonical Unix-style library identifiers." ` +
        `--success-criterion "Stores canonical library id after create" ` +
        `--deliverable "src/create-c7.ts" ` +
        `--c7-verified "C:/Program Files/Git/mongodb/docs:Query patterns"`,
        { encoding: 'utf-8' }
      );

      const graph = await cliStorage.load();
      const task = graph.getAllTasks()[0];
      expect(task?.c7_verified[0]?.library_id).toBe('/mongodb/docs');
      expect(task?.c7_verified[0]?.notes).toBe('Query patterns');
    });
  });

  describe('notes file option (CLI integration)', () => {
    let cliTempDir: string;
    let cliStorage: TaskStorage;
    let notesDir: string;
    let cliPath: string;

    beforeEach(async () => {
      cliTempDir = join(tmpdir(), `octie-cli-test-${uuidv4()}`);
      cliStorage = new TaskStorage({ projectDir: cliTempDir });
      await cliStorage.createProject('cli-test-project');
      notesDir = join(tmpdir(), `octie-notes-${uuidv4()}`);
      mkdirSync(notesDir, { recursive: true });
      cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
    });

    afterEach(() => {
      try {
        rmSync(cliTempDir, { recursive: true, force: true });
        rmSync(notesDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create task with notes from file', async () => {
      const notesFile = join(notesDir, 'notes.txt');
      writeFileSync(notesFile, 'Implementation notes:\n- Use bcrypt\n- Handle edge cases');

      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement login endpoint" ` +
        `--description "Create POST /auth/login endpoint that validates credentials and returns JWT token for secure authentication" ` +
        `--success-criterion "Returns 200 with valid JWT" ` +
        `--deliverable "src/auth/login.ts" ` +
        `--notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task created');

      // Reload from storage to get the created task
      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      expect(task?.notes).toContain('Implementation notes:');
      expect(task?.notes).toContain('Use bcrypt');
    });

    it('should handle markdown notes file', async () => {
      const notesFile = join(notesDir, 'notes.md');
      writeFileSync(notesFile, '# API Design\n\n## Endpoints\n- POST /login\n- POST /logout\n\n```typescript\ninterface LoginRequest {\n  email: string;\n}\n```');

      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement logout endpoint" ` +
        `--description "Create POST /auth/logout endpoint that invalidates JWT tokens and clears session data for secure logout functionality" ` +
        `--success-criterion "Returns 200 on successful logout" ` +
        `--deliverable "src/auth/logout.ts" ` +
        `--notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task created');

      // Reload from storage
      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      expect(task?.notes).toContain('# API Design');
      expect(task?.notes).toContain('POST /login');
      expect(task?.notes).toContain('interface LoginRequest');
    });

    it('should reject non-existent notes file', () => {
      const missingFile = join(notesDir, 'missing.txt');

      expect(() => {
        execSync(
          `node ${cliPath} --project "${cliTempDir}" create ` +
          `--title "Implement feature" ` +
          `--description "Create a new feature endpoint with validation and error handling for production use cases" ` +
          `--success-criterion "Feature works correctly" ` +
          `--deliverable "src/feature.ts" ` +
          `--notes-file "${missingFile}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('should append --notes to --notes-file when both provided', async () => {
      const notesFile = join(notesDir, 'file-notes.txt');
      writeFileSync(notesFile, 'Notes from file');

      execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement settings endpoint" ` +
        `--description "Create GET /settings endpoint that returns user preferences and application configuration for client consumption" ` +
        `--success-criterion "Returns user settings" ` +
        `--deliverable "src/settings.ts" ` +
        `--notes "Inline notes" ` +
        `--notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      // Reload from storage
      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      // When both are provided, inline notes are appended to file notes with double newline
      expect(task?.notes).toBe('Notes from file\n\nInline notes');
    });

    it('should trim whitespace from file content', async () => {
      const notesFile = join(notesDir, 'padded.txt');
      writeFileSync(notesFile, '\n   \n  Trimmed content  \n   \n');

      execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement profile endpoint" ` +
        `--description "Create GET /profile endpoint that returns user profile information including name email and avatar for display" ` +
        `--success-criterion "Returns profile data" ` +
        `--deliverable "src/profile.ts" ` +
        `--notes-file "${notesFile}"`,
        { encoding: 'utf-8' }
      );

      // Reload from storage
      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      expect(task?.notes).toBe('Trimmed content');
    });
  });

  describe('related-files multiple values (CLI integration)', () => {
    let cliTempDir: string;
    let cliStorage: TaskStorage;
    let cliPath: string;

    beforeEach(async () => {
      cliTempDir = join(tmpdir(), `octie-cli-files-test-${uuidv4()}`);
      cliStorage = new TaskStorage({ projectDir: cliTempDir });
      await cliStorage.createProject('cli-files-test-project');
      cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
    });

    afterEach(() => {
      try {
        rmSync(cliTempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should support multiple --related-files flags', async () => {
      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement auth module" ` +
        `--description "Create authentication module with login logout and session management for secure user authentication" ` +
        `--success-criterion "Auth module works correctly" ` +
        `--deliverable "src/auth/index.ts" ` +
        `--related-files "src/auth/login.ts" ` +
        `--related-files "src/auth/logout.ts"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task created');

      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      expect(task?.related_files).toContain('src/auth/login.ts');
      expect(task?.related_files).toContain('src/auth/logout.ts');
      expect(task?.related_files.length).toBe(2);
    });

    it('should support comma-separated --related-files', async () => {
      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement API endpoints" ` +
        `--description "Create REST API endpoints for user management including CRUD operations with proper validation" ` +
        `--success-criterion "API endpoints work correctly" ` +
        `--deliverable "src/api/users.ts" ` +
        `--related-files "src/api/users.ts,src/api/types.ts,src/api/middleware.ts"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task created');

      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      expect(task?.related_files).toContain('src/api/users.ts');
      expect(task?.related_files).toContain('src/api/types.ts');
      expect(task?.related_files).toContain('src/api/middleware.ts');
      expect(task?.related_files.length).toBe(3);
    });

    it('should support mixed --related-files usage', async () => {
      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement database layer" ` +
        `--description "Create database access layer with connection pooling and query optimization for better performance" ` +
        `--success-criterion "Database layer works correctly" ` +
        `--deliverable "src/db/connection.ts" ` +
        `--related-files "src/db/connection.ts,src/db/pool.ts" ` +
        `--related-files "src/db/queries.ts"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task created');

      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      const task = tasks[tasks.length - 1];
      // Should have all 3 files from mixed usage
      expect(task?.related_files).toContain('src/db/connection.ts');
      expect(task?.related_files).toContain('src/db/pool.ts');
      expect(task?.related_files).toContain('src/db/queries.ts');
      expect(task?.related_files.length).toBe(3);
    });
  });

  describe('twin validation (blockers + dependencies)', () => {
    let cliTempDir: string;
    let cliStorage: TaskStorage;
    let cliPath: string;
    let blockerId: string;

    beforeEach(async () => {
      cliTempDir = join(tmpdir(), `octie-cli-twin-${uuidv4()}`);
      cliStorage = new TaskStorage({ projectDir: cliTempDir });
      await cliStorage.createProject('twin-test-project');
      cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

      // Create a blocker task for twin tests
      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement base API" ` +
        `--description "Create the base API infrastructure including server setup and routing for all endpoints to use" ` +
        `--success-criterion "API server starts successfully" ` +
        `--deliverable "src/api/server.ts"`,
        { encoding: 'utf-8' }
      );
      // Extract blocker ID from output
      const match = output.match(/Task created: ([a-f0-9-]+)/);
      blockerId = match?.[1] || '';
    });

    afterEach(() => {
      try {
        rmSync(cliTempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create task with both blockers and dependencies together (twin)', async () => {
      const output = execSync(
        `node ${cliPath} --project "${cliTempDir}" create ` +
        `--title "Implement user endpoint" ` +
        `--description "Create GET /user endpoint that returns user profile information from the database" ` +
        `--success-criterion "Returns user profile with 200 status" ` +
        `--deliverable "src/api/user.ts" ` +
        `--blockers "${blockerId}" ` +
        `--dependencies "Needs base API server from blocker"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Task created');

      const graph = await cliStorage.load();
      const tasks = graph.getAllTasks();
      const task = tasks.find(t => t.title === 'Implement user endpoint');
      expect(task).toBeDefined();
      expect(task?.blockers).toContain(blockerId);
      expect(task?.dependencies).toBe('Needs base API server from blocker');
    });

    it('should reject --blockers without --dependencies (partial twin)', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${cliTempDir}" create ` +
          `--title "Implement profile endpoint" ` +
          `--description "Create GET /profile endpoint that returns user profile data from database storage" ` +
          `--success-criterion "Returns profile data" ` +
          `--deliverable "src/api/profile.ts" ` +
          `--blockers "${blockerId}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('blockers');
      expect(errorMsg).toContain('dependencies');
      expect(errorMsg).toContain('required');
    });

    it('should reject --dependencies without --blockers (partial twin)', () => {
      let errorMsg = '';
      try {
        execSync(
          `node ${cliPath} --project "${cliTempDir}" create ` +
          `--title "Implement settings endpoint" ` +
          `--description "Create GET /settings endpoint that returns user application settings and preferences" ` +
          `--success-criterion "Returns settings" ` +
          `--deliverable "src/api/settings.ts" ` +
          `--dependencies "Some dependency explanation"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        errorMsg = err.stderr?.toString() || err.stdout?.toString() || '';
      }

      expect(errorMsg).toContain('dependencies');
      expect(errorMsg).toContain('blockers');
      expect(errorMsg).toContain('required');
    });
  });

  describe('cache invalidation behavior', () => {
    it('should bound cache invalidation latency and warn when a timeout occurs', async () => {
      const originalFetch = global.fetch;
      const originalTimeout = process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS = '25';

      global.fetch = vi.fn(async (_input, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (!signal) {
          throw new Error('Missing abort signal');
        }

        return await new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(signal.reason ?? new Error('aborted')),
            { once: true },
          );
        });
      }) as typeof fetch;

      try {
        const prepared = preflightTaskCreation(graph, {
          title: 'Implement cache timeout regression module',
          description: 'Create a task so post-save cache invalidation can be tested under a deterministic hanging fetch without blocking task creation indefinitely.',
          successCriterion: ['Task creation returns within the configured timeout window'],
          deliverable: ['src/cache/timeout.ts'],
        });

        const startedAt = Date.now();
        await executeTaskCreation(tempDir, graph, prepared);
        const elapsedMs = Date.now() - startedAt;

        expect(elapsedMs).toBeLessThan(1000);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cache invalidation skipped'),
        );
      } finally {
        global.fetch = originalFetch;
        if (originalTimeout === undefined) {
          delete process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS;
        } else {
          process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS = originalTimeout;
        }
        warnSpy.mockRestore();
      }
    });
  });
});
