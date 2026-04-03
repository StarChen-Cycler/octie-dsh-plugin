/**
 * Web API Integration Tests
 *
 * Tests for the Express.js REST API endpoints including:
 * - Task CRUD operations (GET, POST, PUT, DELETE)
 * - Graph endpoints (topology, cycles, validate, critical-path, stats)
 * - Validation error handling
 * - CORS headers
 * - 404 handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { WebServer } from '../../src/web/server.js';
import { TaskStorage } from '../../src/core/storage/file-store.js';
import { TaskNode } from '../../src/core/models/task-node.js';
import { TaskGraphStore } from '../../src/core/graph/index.js';

describe('Web API Integration Tests', () => {
  let tempDir: string;
  let storage: TaskStorage;
  let server: WebServer;
  let app: express.Express;
  let graph: TaskGraphStore;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-api-test-${uuidv4()}`);
    storage = new TaskStorage({ projectDir: tempDir });

    // Create project and load the graph
    await storage.createProject('test-api-project');
    graph = await storage.load();

    // Create WebServer instance (get app without starting server)
    server = new WebServer(tempDir, { logging: false, cors: true });
    app = server.app;

    // Inject the graph into the server's internal state
    // The WebServer's routes use getGraph() which returns this._graph
    // We need to set it manually since we're not calling start()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any)._graph = graph;
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper function to create a valid atomic task with action verb
   */
  function createTestTask(overrides: Partial<{
    id: string;
    title: string;
    description: string;
    priority: 'top' | 'second' | 'later';
    status: 'ready' | 'in_review' | 'in_progress' | 'completed' | 'blocked';
  }> = {}): TaskNode {
    const id = overrides.id || uuidv4();
    return new TaskNode({
      id,
      title: overrides.title || 'Implement test feature validation module',
      description: overrides.description || 'Create a comprehensive test feature that validates the system works correctly with all edge cases covered for the entire module',
      status: overrides.status || 'not_started',
      priority: overrides.priority || 'second',
      success_criteria: [
        { id: uuidv4(), text: 'Feature works correctly with all test inputs', completed: false },
      ],
      deliverables: [
        { id: uuidv4(), text: 'src/test-feature.ts', completed: false },
      ],
      blockers: [],
      dependencies: '',
      related_files: [],
      notes: '',
      c7_verified: [],
      sub_items: [],
      edges: [],
    });
  }

  // ==========================================
  // Health and Info Endpoints
  // ==========================================

  describe('Health and Info Endpoints', () => {
    it('GET / should serve web UI or redirect to API', async () => {
      const response = await request(app).get('/');

      // Should either return HTML (web UI) or redirect to API
      expect([200, 302]).toContain(response.status);

      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/html/);
      }
    });

    it('GET / should not serve the Vitest html fallback as the main app', async () => {
      const response = await request(app).get('/');

      if (response.status === 200) {
        expect(response.text).not.toContain('<title>Vitest</title>');
      } else {
        expect(response.status).toBe(302);
      }
    });

    it('GET /test should keep serving the Vitest html report when available', async () => {
      const response = await request(app)
        .get('/test/')
        .expect('Content-Type', /html/);

      expect(response.status).toBe(200);
      expect(response.text).toContain('<title>Vitest</title>');
    });

    it('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('GET /api should return API info', async () => {
      const response = await request(app)
        .get('/api')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Octie API');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.endpoints).toBeDefined();
    });
  });

  // ==========================================
  // Task CRUD Endpoints
  // ==========================================

  describe('Task CRUD Endpoints', () => {
    describe('GET /api/tasks', () => {
      it('should return empty array when no tasks exist', async () => {
        const response = await request(app)
          .get('/api/tasks')
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toEqual([]);
        expect(response.body.data.total).toBe(0);
      });

      it('should return all tasks', async () => {
        // Add tasks to graph
        const task1 = createTestTask({ title: 'Implement task one feature' });
        const task2 = createTestTask({ title: 'Create task two feature' });
        graph.addNode(task1);
        graph.addNode(task2);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/tasks')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(2);
        expect(response.body.data.total).toBe(2);
      });

      it('should filter tasks by status', async () => {
        const task1 = createTestTask({ title: 'Implement completed feature', status: 'completed' });
        const task2 = createTestTask({ title: 'Create in-progress feature', status: 'in_progress' });
        graph.addNode(task1);
        graph.addNode(task2);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/tasks?status=completed')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(1);
        expect(response.body.data.tasks[0].status).toBe('completed');
      });

      it('should filter tasks by priority', async () => {
        const task1 = createTestTask({ title: 'Implement top priority feature', priority: 'top' });
        const task2 = createTestTask({ title: 'Create later priority feature', priority: 'later' });
        graph.addNode(task1);
        graph.addNode(task2);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/tasks?priority=top')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(1);
        expect(response.body.data.tasks[0].priority).toBe('top');
      });

      it('should search tasks by title', async () => {
        const task1 = createTestTask({ title: 'Implement authentication system' });
        const task2 = createTestTask({ title: 'Write unit tests' });
        graph.addNode(task1);
        graph.addNode(task2);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/tasks?search=authentication')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(1);
        expect(response.body.data.tasks[0].title).toContain('authentication');
      });

      it('should paginate results with limit and offset', async () => {
        // Add 5 tasks
        for (let i = 0; i < 5; i++) {
          const task = createTestTask({ title: `Implement feature number ${i}` });
          graph.addNode(task);
        }
        await storage.save(graph);

        const response = await request(app)
          .get('/api/tasks?limit=2&offset=1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(2);
        expect(response.body.data.total).toBe(5);
        expect(response.body.data.limit).toBe(2);
        expect(response.body.data.offset).toBe(1);
      });
    });

    describe('GET /api/tasks/:id', () => {
      it('should return a specific task by ID', async () => {
        const task = createTestTask({ title: 'Implement test feature' });
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .get(`/api/tasks/${task.id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(task.id);
        expect(response.body.data.title).toBe('Implement test feature');
      });

      it('should return 404 for non-existent task', async () => {
        const fakeId = uuidv4();

        const response = await request(app)
          .get(`/api/tasks/${fakeId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TASK_NOT_FOUND');
      });
    });

    describe('POST /api/tasks', () => {
      it('should create a new task with valid data', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement user registration',
            description: 'Create a comprehensive user registration system with email validation, password hashing, and account activation workflow that ensures security best practices',
            successCriteria: [
              { text: 'User can register with email' },
              { text: 'Password is hashed with bcrypt' },
            ],
            deliverables: [
              { text: 'src/auth/register.ts' },
            ],
            priority: 'top',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Implement user registration');
        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.success_criteria).toHaveLength(2);
      });

      it('should reject task without title', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables: [{ text: 'test.ts' }],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject task without description', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables: [{ text: 'test.ts' }],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject task with description too short', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'Too short',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables: [{ text: 'test.ts' }],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject task without success criteria', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: [],
            deliverables: [{ text: 'test.ts' }],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject task without deliverables', async () => {
        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables: [],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject task with too many success criteria (>10)', async () => {
        const criteria = Array(11).fill(null).map((_, i) => ({ text: `Implement criterion number ${i}` }));

        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: criteria,
            deliverables: [{ text: 'test.ts' }],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject task with too many deliverables (>5)', async () => {
        const deliverables = Array(6).fill(null).map((_, i) => ({ text: `file${i}.ts` }));

        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables,
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('ATOMIC_TASK_VIOLATION');
      });

      it('should validate blocker exists when creating task', async () => {
        const fakeBlockerId = uuidv4();

        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables: [{ text: 'test.ts' }],
            blockers: [fakeBlockerId],
            dependencies: 'Needs output from this task',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BLOCKER_NOT_FOUND');
      });

      it('should validate dependency exists when creating task', async () => {
        const fakeDepId = uuidv4();

        const response = await request(app)
          .post('/api/tasks')
          .send({
            title: 'Implement test feature',
            description: 'A valid description that is at least fifty characters long for testing purposes',
            successCriteria: [{ text: 'Test criterion for validation' }],
            deliverables: [{ text: 'test.ts' }],
            blockers: [fakeDepId],
            dependencies: 'Needs output from this task',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BLOCKER_NOT_FOUND');
      });
    });

    describe('PUT /api/tasks/:id', () => {
      it('should update task title', async () => {
        const task = createTestTask({ title: 'Implement original feature' });
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ title: 'Implement updated feature' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Implement updated feature');
      });

      it('should update task status', async () => {
        const task = createTestTask({ status: 'ready' });
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ status: 'in_progress' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('in_progress');
      });

      it('should update task priority', async () => {
        const task = createTestTask({ priority: 'second' });
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ priority: 'top' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.priority).toBe('top');
      });

      it('should add success criterion', async () => {
        const task = createTestTask();
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ addSuccessCriterion: 'Implement new criterion for verification' })
          .expect(200);

        expect(response.body.success).toBe(true);
        const criteria = response.body.data.success_criteria;
        const newCriterion = criteria.find((c: { text: string }) => c.text === 'Implement new criterion for verification');
        expect(newCriterion).toBeDefined();
      });

      it('should complete a criterion', async () => {
        const criterionId = uuidv4();
        const task = new TaskNode({
          id: uuidv4(),
          title: 'Implement test feature for criterion',
          description: 'A valid description that is at least fifty characters long for testing purposes in this test case',
          success_criteria: [
            { id: criterionId, text: 'Implement test criterion', completed: false },
          ],
          deliverables: [{ id: uuidv4(), text: 'test.ts', completed: false }],
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

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ completeCriterion: criterionId })
          .expect(200);

        expect(response.body.success).toBe(true);
        const criterion = response.body.data.success_criteria.find(
          (c: { id: string }) => c.id === criterionId
        );
        expect(criterion.completed).toBe(true);
      });

      it('should add deliverable', async () => {
        const task = createTestTask();
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ addDeliverable: 'src/new-feature.ts' })
          .expect(200);

        expect(response.body.success).toBe(true);
        const deliverable = response.body.data.deliverables.find(
          (d: { text: string }) => d.text === 'src/new-feature.ts'
        );
        expect(deliverable).toBeDefined();
      });

      it('should append notes', async () => {
        const task = createTestTask();
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ notes: 'Additional notes added' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.notes).toContain('Additional notes added');
      });

      it('should return 404 for non-existent task', async () => {
        const fakeId = uuidv4();

        const response = await request(app)
          .put(`/api/tasks/${fakeId}`)
          .send({ title: 'Implement updated feature' })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TASK_NOT_FOUND');
      });
    });

    describe('DELETE /api/tasks/:id', () => {
      it('should delete an existing task', async () => {
        const task = createTestTask();
        graph.addNode(task);
        await storage.save(graph);

        const response = await request(app)
          .delete(`/api/tasks/${task.id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deletedTask.id).toBe(task.id);

        // Verify task is gone
        const getResponse = await request(app)
          .get(`/api/tasks/${task.id}`)
          .expect(404);
      });

      it('should reconnect edges when reconnect=true', async () => {
        const taskA = new TaskNode({
          id: uuidv4(),
          title: 'Implement reconnect parent feature',
          description: 'Create a completed parent task so web delete reconnect can immediately unblock the downstream task after the intermediate blocker is removed.',
          status: 'completed',
          priority: 'top',
          success_criteria: [
            { id: uuidv4(), text: 'Parent work is complete', completed: true },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/reconnect-parent.ts', completed: true },
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
          title: 'Implement reconnect blocker feature',
          description: 'Create an in-review blocker task so the child starts blocked until web delete reconnect removes this parent from the graph chain.',
          status: 'in_review',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: 'Blocker work is complete but unapproved', completed: true },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/reconnect-blocker.ts', completed: true },
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
          title: 'Implement reconnect child feature',
          description: 'Create a blocked child task that should become ready after web delete reconnect rewires its parent to the completed upstream task.',
          status: 'blocked',
          priority: 'later',
          success_criteria: [
            { id: uuidv4(), text: 'Child becomes ready after reconnect delete', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/reconnect-child.ts', completed: false },
          ],
          blockers: [],
          dependencies: 'Waiting on blocker completion',
          related_files: [],
          notes: '',
          c7_verified: [],
          sub_items: [],
          edges: [],
        });

        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addNode(taskC);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskC.id);
        taskC.addBlocker(taskB.id);
        await storage.save(graph);

        const response = await request(app)
          .delete(`/api/tasks/${taskB.id}?reconnect=true`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.reconnected).toBe(true);

        // Verify A -> C edge exists now
        const graphResponse = await request(app)
          .get('/api/graph')
          .expect(200);

        const edges = graphResponse.body.data.outgoingEdges[taskA.id];
        expect(edges).toContain(taskC.id);

        const childResponse = await request(app)
          .get(`/api/tasks/${taskC.id}`)
          .expect(200);
        expect(childResponse.body.data.status).toBe('ready');
      });

      it('should return 404 for non-existent task', async () => {
        const fakeId = uuidv4();

        const response = await request(app)
          .delete(`/api/tasks/${fakeId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TASK_NOT_FOUND');
      });
    });

    describe('POST /api/tasks/:id/merge', () => {
      it('should merge two tasks', async () => {
        const sourceTask = new TaskNode({
          id: uuidv4(),
          title: 'Implement source feature',
          description: 'Create a source task that is complete but not approved so its child remains blocked until the merge rewires the blocker chain to a completed target.',
          status: 'in_review',
          priority: 'second',
          success_criteria: [
            { id: uuidv4(), text: 'Source work is complete', completed: true },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/source-feature.ts', completed: true },
          ],
          blockers: [],
          dependencies: '',
          related_files: [],
          notes: '',
          c7_verified: [],
          sub_items: [],
          edges: [],
        });
        const targetTask = new TaskNode({
          id: uuidv4(),
          title: 'Create target feature',
          description: 'Create a completed target task so merging the source into it should immediately unblock the downstream child task in the web API graph.',
          status: 'completed',
          priority: 'top',
          success_criteria: [
            { id: uuidv4(), text: 'Target work is complete', completed: true },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/target-feature.ts', completed: true },
          ],
          blockers: [],
          dependencies: '',
          related_files: [],
          notes: '',
          c7_verified: [],
          sub_items: [],
          edges: [],
        });
        const childTask = new TaskNode({
          id: uuidv4(),
          title: 'Write merged child feature',
          description: 'Create a blocked child task that should become ready immediately after merge rewires its only parent to the completed target task.',
          status: 'blocked',
          priority: 'later',
          success_criteria: [
            { id: uuidv4(), text: 'Child becomes ready after merge', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/merged-child.ts', completed: false },
          ],
          blockers: [],
          dependencies: 'Waiting on source completion',
          related_files: [],
          notes: '',
          c7_verified: [],
          sub_items: [],
          edges: [],
        });

        graph.addNode(sourceTask);
        graph.addNode(targetTask);
        graph.addNode(childTask);
        graph.addEdge(sourceTask.id, childTask.id);
        childTask.addBlocker(sourceTask.id);
        await storage.save(graph);

        const response = await request(app)
          .post(`/api/tasks/${sourceTask.id}/merge`)
          .send({ targetId: targetTask.id })
          .expect(200);

        expect(response.body.success).toBe(true);
        // mergeTasks returns MergeResult with task property
        expect(response.body.data.task.title).toBe('Create target feature');
        expect(response.body.data.task.description).toContain('Merged from');
        expect(response.body.data.removedTasks).toContain(sourceTask.id);
        expect(response.body.data.updatedTasks).toContain(childTask.id);

        // Verify source task is gone
        const getResponse = await request(app)
          .get(`/api/tasks/${sourceTask.id}`)
          .expect(404);

        const childResponse = await request(app)
          .get(`/api/tasks/${childTask.id}`)
          .expect(200);
        expect(childResponse.body.data.status).toBe('ready');
      });

      it('should return 404 if source task does not exist', async () => {
        const fakeSourceId = uuidv4();
        const targetTask = createTestTask();
        graph.addNode(targetTask);
        await storage.save(graph);

        const response = await request(app)
          .post(`/api/tasks/${fakeSourceId}/merge`)
          .send({ targetId: targetTask.id })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TASK_NOT_FOUND');
      });

      it('should return 404 if target task does not exist', async () => {
        const sourceTask = createTestTask();
        const fakeTargetId = uuidv4();
        graph.addNode(sourceTask);
        await storage.save(graph);

        const response = await request(app)
          .post(`/api/tasks/${sourceTask.id}/merge`)
          .send({ targetId: fakeTargetId })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TASK_NOT_FOUND');
      });
    });
  });

  // ==========================================
  // Graph Endpoints
  // ==========================================

  describe('Graph Endpoints', () => {
    describe('GET /api/graph', () => {
      it('should return graph structure', async () => {
        const task1 = createTestTask({ title: 'Implement first feature' });
        const task2 = createTestTask({ title: 'Create second feature' });
        graph.addNode(task1);
        graph.addNode(task2);
        graph.addEdge(task1.id, task2.id);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.nodes).toBeDefined();
        expect(response.body.data.nodes.length).toBe(2);
        expect(response.body.data.outgoingEdges).toBeDefined();
        expect(response.body.data.incomingEdges).toBeDefined();
        expect(response.body.data.metadata).toBeDefined();
      });
    });

    describe('GET /api/graph/topology', () => {
      it('should return topological order for valid DAG', async () => {
        const taskA = createTestTask({ title: 'Implement feature A' });
        const taskB = createTestTask({ title: 'Create feature B' });
        const taskC = createTestTask({ title: 'Write feature C' });

        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addNode(taskC);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskC.id);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph/topology')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.hasCycle).toBe(false);
        expect(response.body.data.sorted).toHaveLength(3);
        expect(response.body.data.sorted[0]).toBe(taskA.id);
        expect(response.body.data.sorted[2]).toBe(taskC.id);
      });

      it('should detect cycles in topology response', async () => {
        const taskA = createTestTask({ title: 'Implement cycle task A' });
        const taskB = createTestTask({ title: 'Create cycle task B' });

        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskA.id); // Creates cycle
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph/topology')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.hasCycle).toBe(true);
        expect(response.body.data.cycleNodes).toBeDefined();
      });
    });

    describe('POST /api/graph/validate', () => {
      it('should return valid for acyclic graph', async () => {
        const taskA = createTestTask();
        const taskB = createTestTask();
        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addEdge(taskA.id, taskB.id);
        await storage.save(graph);

        const response = await request(app)
          .post('/api/graph/validate')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(true);
        expect(response.body.data.hasCycle).toBe(false);
      });

      it('should return invalid for cyclic graph', async () => {
        const taskA = createTestTask();
        const taskB = createTestTask();
        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskA.id); // Cycle
        await storage.save(graph);

        const response = await request(app)
          .post('/api/graph/validate')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(false);
        expect(response.body.data.hasCycle).toBe(true);
        expect(response.body.data.cycleStats).toBeDefined();
      });
    });

    describe('GET /api/graph/cycles', () => {
      it('should return no cycles for acyclic graph', async () => {
        const taskA = createTestTask();
        const taskB = createTestTask();
        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addEdge(taskA.id, taskB.id);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph/cycles')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.hasCycle).toBe(false);
        expect(response.body.data.cycles).toEqual([]);
      });

      it('should return cycles for cyclic graph', async () => {
        const taskA = createTestTask();
        const taskB = createTestTask();
        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskA.id); // Cycle
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph/cycles')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.hasCycle).toBe(true);
        expect(response.body.data.cycles.length).toBeGreaterThan(0);
        expect(response.body.data.cycleCount).toBeGreaterThan(0);
      });
    });

    describe('GET /api/graph/critical-path', () => {
      it('should return critical path for acyclic graph', async () => {
        const taskA = createTestTask({ title: 'Implement feature A' });
        const taskB = createTestTask({ title: 'Create feature B' });
        const taskC = createTestTask({ title: 'Write feature C' });

        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addNode(taskC);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskC.id);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph/critical-path')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.path).toHaveLength(3);
        expect(response.body.data.duration).toBeGreaterThan(0);
      });

      it('should return error for cyclic graph', async () => {
        const taskA = createTestTask();
        const taskB = createTestTask();
        graph.addNode(taskA);
        graph.addNode(taskB);
        graph.addEdge(taskA.id, taskB.id);
        graph.addEdge(taskB.id, taskA.id); // Cycle
        await storage.save(graph);

        const response = await request(app)
          .get('/api/graph/critical-path')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('GRAPH_HAS_CYCLE');
      });
    });

    describe('GET /api/stats', () => {
      it('should return project statistics', async () => {
        const task1 = createTestTask({ status: 'completed', priority: 'top' });
        const task2 = createTestTask({ status: 'in_progress', priority: 'second' });
        const task3 = createTestTask({ status: 'ready', priority: 'later' });

        graph.addNode(task1);
        graph.addNode(task2);
        graph.addNode(task3);
        await storage.save(graph);

        const response = await request(app)
          .get('/api/stats')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks.total).toBe(3);
        expect(response.body.data.tasks.statusCounts.completed).toBe(1);
        expect(response.body.data.tasks.statusCounts.in_progress).toBe(1);
        expect(response.body.data.tasks.statusCounts.ready).toBe(1);
        expect(response.body.data.tasks.priorityCounts.top).toBe(1);
        expect(response.body.data.project.name).toBe('test-api-project');
      });
    });
  });

  // ==========================================
  // CORS Headers
  // ==========================================

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/tasks')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  // ==========================================
  // 404 and Error Handling
  // ==========================================

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should include timestamp in all responses', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      // Validate ISO 8601 format
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });
  });
});
