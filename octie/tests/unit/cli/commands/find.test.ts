/**
 * Tests for the find command
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { TaskGraphStore } from '../../../../src/core/graph/index.js';
import { TaskNode } from '../../../../src/core/models/task-node.js';

describe('find command', () => {
  let tempDir: string;
  let cliPath: string;
  let storage: TaskStorage;

  // Test task IDs
  let authTaskId: string;
  let apiTaskId: string;
  let dbTaskId: string;
  let orphanTaskId: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-find-test-${uuidv4()}`);
    cliPath = join(process.cwd(), 'dist/cli/index.js');

    // Initialize project
    storage = new TaskStorage({ projectDir: tempDir });
    await storage.createProject('find-test');

    // Load the created graph
    const graph = await storage.load();

    // Auth task - with C7 verification and related files
    const authTask = new TaskNode({
      title: 'Implement JWT authentication',
      description: 'Create authentication system using JWT tokens with refresh capability for secure user sessions',
      priority: 'top',
      success_criteria: [
        { id: 'sc-1', text: 'Login endpoint returns valid JWT', completed: true },
        { id: 'sc-2', text: 'Token refresh works correctly', completed: false }
      ],
      deliverables: [
        { id: 'del-1', text: 'auth.service.ts', completed: true, file_path: 'src/auth/auth.service.ts' },
        { id: 'del-2', text: 'auth.test.ts', completed: false }
      ],
      related_files: ['src/auth/auth.service.ts', 'src/auth/auth.test.ts'],
      c7_verified: [
        { library_id: '/auth0/node-jwks-rsa', verified_at: '2026-02-15T10:00:00Z', notes: 'JWT patterns' }
      ],
      notes: 'Use bcrypt for password hashing'
    });
    graph.addNode(authTask);
    authTaskId = authTask.id;

    // API task - blocked by auth
    const apiTask = new TaskNode({
      title: 'Create API endpoints',
      description: 'Build REST API endpoints for user management with CRUD operations and validation',
      priority: 'second',
      success_criteria: [
        { id: 'sc-3', text: 'GET /users returns list', completed: false }
      ],
      deliverables: [
        { id: 'del-3', text: 'api/users.ts', completed: false, file_path: 'src/api/users.ts' }
      ],
      blockers: [authTaskId],
      related_files: ['src/api/users.ts'],
      notes: 'Requires authentication from auth task'
    });
    graph.addNode(apiTask);
    apiTaskId = apiTask.id;

    // DB task - no blockers
    const dbTask = new TaskNode({
      title: 'Setup database connection',
      description: 'Configure PostgreSQL connection with connection pooling for optimal performance',
      priority: 'top',
      success_criteria: [
        { id: 'sc-4', text: 'Connection pool works', completed: true }
      ],
      deliverables: [
        { id: 'del-4', text: 'db/connection.ts', completed: true, file_path: 'src/db/connection.ts' }
      ],
      related_files: ['src/db/connection.ts'],
      c7_verified: [
        { library_id: '/mongodb/docs', verified_at: '2026-02-15T09:00:00Z' }
      ],
      notes: 'Use pg library for PostgreSQL'
    });
    graph.addNode(dbTask);
    dbTaskId = dbTask.id;

    // Orphan task - no relationships
    const orphanTask = new TaskNode({
      title: 'Write documentation',
      description: 'Create comprehensive API documentation for all endpoints with examples',
      priority: 'later',
      success_criteria: [
        { id: 'sc-5', text: 'All endpoints documented', completed: false }
      ],
      deliverables: [
        { id: 'del-5', text: 'docs/api.md', completed: false }
      ],
      notes: 'Use OpenAPI spec format'
    });
    graph.addNode(orphanTask);
    orphanTaskId = orphanTask.id;

    // Add edges
    graph.addEdge(authTaskId, apiTaskId, 'blocks');

    // Save graph
    await storage.save(graph);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('--title option', () => {
    it('should find tasks matching title (case-insensitive)', () => {
      const output = execSync(
        `node "${cliPath}" find --title "JWT" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Implement JWT authentication');
    });

    it('should find tasks with partial title match', () => {
      const output = execSync(
        `node "${cliPath}" find --title "API" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Create API endpoints');
    });

    it('should return empty array for no matches', () => {
      const output = execSync(
        `node "${cliPath}" find --title "nonexistent" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(0);
    });
  });

  describe('--search option', () => {
    it('should find tasks matching text in description', () => {
      const output = execSync(
        `node "${cliPath}" find --search "JWT tokens" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.some((t: TaskNode) => t.title === 'Implement JWT authentication')).toBe(true);
    });

    it('should find tasks matching text in notes', () => {
      const output = execSync(
        `node "${cliPath}" find --search "bcrypt" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Implement JWT authentication');
    });

    it('should find tasks matching text in success criteria', () => {
      const output = execSync(
        `node "${cliPath}" find --search "Login endpoint" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Implement JWT authentication');
    });

    it('should find tasks matching text in deliverables', () => {
      const output = execSync(
        `node "${cliPath}" find --search "auth.test.ts" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
    });
  });

  describe('--has-file option', () => {
    it('should find tasks referencing a specific file', () => {
      const output = execSync(
        `node "${cliPath}" find --has-file "auth.service.ts" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Implement JWT authentication');
    });

    it('should find tasks with partial file path match', () => {
      const output = execSync(
        `node "${cliPath}" find --has-file "src/api" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Create API endpoints');
    });
  });

  describe('--verified option', () => {
    it('should find tasks with C7 verification from specific library', () => {
      const output = execSync(
        `node "${cliPath}" find --verified "jwks" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Implement JWT authentication');
    });

    it('should find tasks with partial library ID match', () => {
      const output = execSync(
        `node "${cliPath}" find --verified "/mongodb" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Setup database connection');
    });

    it('should normalize Git Bash converted verified library paths', () => {
      const output = execSync(
        `node "${cliPath}" find --verified "C:/Program Files/Git/mongodb" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Setup database connection');
    });
  });

  describe('--without-blockers option', () => {
    it('should find tasks with no blockers', () => {
      const output = execSync(
        `node "${cliPath}" find --without-blockers --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      // Auth, DB, and Orphan have no blockers
      expect(tasks.length).toBe(3);
      expect(tasks.some((t: TaskNode) => t.title === 'Implement JWT authentication')).toBe(true);
      expect(tasks.some((t: TaskNode) => t.title === 'Setup database connection')).toBe(true);
      expect(tasks.some((t: TaskNode) => t.title === 'Write documentation')).toBe(true);
      expect(tasks.some((t: TaskNode) => t.title === 'Create API endpoints')).toBe(false);
    });
  });

  describe('--orphans option', () => {
    it('should find tasks with no relationships', () => {
      const output = execSync(
        `node "${cliPath}" find --orphans --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(2); // Orphan task and DB task (no edges)
      expect(tasks.some((t: TaskNode) => t.title === 'Write documentation')).toBe(true);
    });
  });

  describe('--leaves option', () => {
    it('should find tasks with no outgoing edges', () => {
      const output = execSync(
        `node "${cliPath}" find --leaves --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      // API task, DB task, and Orphan have no outgoing edges
      expect(tasks.length).toBe(3);
      expect(tasks.some((t: TaskNode) => t.title === 'Create API endpoints')).toBe(true);
      expect(tasks.some((t: TaskNode) => t.title === 'Setup database connection')).toBe(true);
      expect(tasks.some((t: TaskNode) => t.title === 'Write documentation')).toBe(true);
    });
  });

  describe('--status and --priority filters', () => {
    it('should filter by status', () => {
      // Task status after status refactor:
      // - Auth: in_progress (has completed items but not all)
      // - API: blocked (has blockers)
      // - DB: in_review (all items complete)
      // - Orphan: ready (nothing complete)
      const output = execSync(
        `node "${cliPath}" find --status ready --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      // Only Orphan task is ready
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Write documentation');
    });

    it('should filter by priority', () => {
      const output = execSync(
        `node "${cliPath}" find --priority top --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(2); // Auth and DB
      expect(tasks.every((t: TaskNode) => t.priority === 'top')).toBe(true);
    });
  });

  describe('combined filters', () => {
    it('should combine multiple filters', () => {
      const output = execSync(
        `node "${cliPath}" find --title "auth" --priority top --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Implement JWT authentication');
    });

    it('should combine --without-blockers with --priority', () => {
      const output = execSync(
        `node "${cliPath}" find --without-blockers --priority top --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      // Auth and DB are top priority and have no blockers
      expect(tasks.length).toBe(2);
      expect(tasks.every((t: TaskNode) => t.priority === 'top')).toBe(true);
    });

    it('should combine --orphans with --search', () => {
      const output = execSync(
        `node "${cliPath}" find --orphans --search "documentation" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Write documentation');
    });
  });

  describe('output formats', () => {
    it('should output as JSON with --format json', () => {
      const output = execSync(
        `node "${cliPath}" find --title "JWT" --project "${tempDir}" --format json`,
        { encoding: 'utf-8' }
      );

      const tasks = JSON.parse(output);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(1);
    });

    it('should output as Markdown with --format md', () => {
      const output = execSync(
        `node "${cliPath}" find --title "JWT" --project "${tempDir}" --format md`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('# Search Results');
      expect(output).toContain('Implement JWT authentication');
      expect(output).toContain('**ID**:');
      expect(output).toContain('**Status**:');
    });

    it('should output as table by default', () => {
      const output = execSync(
        `node "${cliPath}" find --title "JWT" --project "${tempDir}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Implement JWT authentication');
      expect(output).toContain('Found:');
    });

    it('should show "No tasks found" message when no matches', () => {
      const output = execSync(
        `node "${cliPath}" find --title "nonexistent" --project "${tempDir}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('No tasks found');
    });
  });
});
