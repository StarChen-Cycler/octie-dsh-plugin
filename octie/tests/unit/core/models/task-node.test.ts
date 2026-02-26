/**
 * TaskNode Model Tests
 *
 * Tests for TaskNode class including:
 * - Constructor validation
 * - Required field validation
 * - Atomic task validation
 * - Auto-timestamp management
 * - Status transition validation
 * - Success criteria and deliverable tracking
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode, validateAtomicTask } from '../../../../src/core/models/task-node.js';
import { ValidationError, AtomicTaskViolationError, ImmutabilityViolationError } from '../../../../src/types/index.js';
import {
  ValidationError,
  AtomicTaskViolationError,
} from '../../../../src/types/index.js';

describe('TaskNode', () => {
  describe('constructor validation', () => {
    it('should create a valid task with all required fields', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT on correct credentials', completed: false },
          { id: uuidv4(), text: 'Endpoint returns 401 on invalid credentials', completed: false },
          { id: uuidv4(), text: 'Password is hashed with bcrypt before comparison', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          { id: uuidv4(), text: 'tests/api/auth/login.test.ts', completed: false },
        ],
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Implement login endpoint');
      expect(task.status).toBe('ready');
      expect(task.priority).toBe('second');
      expect(task.success_criteria).toHaveLength(3);
      expect(task.deliverables).toHaveLength(2);
    });

    it('should throw ValidationError if title is missing', () => {
      expect(() => {
        new TaskNode({
          title: '',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if title is too long', () => {
      const longTitle = 'A'.repeat(201);
      expect(() => {
        new TaskNode({
          title: longTitle,
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if description is missing', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: '',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if description is too short', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Short',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if description is too long', () => {
      const longDescription = 'A'.repeat(10001);
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: longDescription,
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if success_criteria is empty', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if success_criteria is too many', () => {
      const criteria = Array.from({ length: 11 }, () => ({
        id: uuidv4(),
        text: 'Criterion',
        completed: false,
      }));

      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: criteria,
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if deliverables is empty', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [],
        });
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError if deliverables is too many', () => {
      const deliverables = Array.from({ length: 6 }, () => ({
        id: uuidv4(),
        text: 'Deliverable',
        completed: false,
      }));

      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables,
        });
      }).toThrow(ValidationError);
    });
  });

  describe('atomic task validation', () => {
    it('should throw AtomicTaskViolationError for vague title "stuff"', () => {
      expect(() => {
        new TaskNode({
          title: 'Fix stuff',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should throw AtomicTaskViolationError for vague title "things"', () => {
      expect(() => {
        new TaskNode({
          title: 'Update things',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should throw AtomicTaskViolationError for title without action verb', () => {
      expect(() => {
        new TaskNode({
          title: 'Authentication System Module', // No action verb (module is noun)
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should throw AtomicTaskViolationError for title too short "fix"', () => {
      expect(() => {
        new TaskNode({
          title: 'Fix',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should throw AtomicTaskViolationError for subjective success criteria', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Code is clean and good', completed: false },
            { id: uuidv4(), text: 'Performance is fast', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should throw AtomicTaskViolationError for vague success criteria', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'works properly', completed: false },
            { id: uuidv4(), text: 'is correct', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should throw AtomicTaskViolationError for vague deliverables', () => {
      expect(() => {
        new TaskNode({
          title: 'Implement login endpoint',
          description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
          success_criteria: [
            { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          ],
          deliverables: [
            { id: uuidv4(), text: 'code', completed: false },
            { id: uuidv4(), text: 'implementation', completed: false },
          ],
        });
      }).toThrow(AtomicTaskViolationError);
    });

    it('should accept valid atomic task', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200 with valid JWT on correct credentials', completed: false },
          { id: uuidv4(), text: 'Endpoint returns 401 on invalid credentials', completed: false },
          { id: uuidv4(), text: 'Password is hashed with bcrypt before comparison', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
          { id: uuidv4(), text: 'tests/api/auth/login.test.ts', completed: false },
        ],
      });

      expect(task.title).toBe('Implement login endpoint');
    });

    it('should accept task with file path deliverables', () => {
      const task = new TaskNode({
        title: 'Write user service tests',
        description: 'Create comprehensive unit tests for the user service module covering all methods including create, update, delete, and find operations. Tests should mock external dependencies and cover edge cases.',
        success_criteria: [
          { id: uuidv4(), text: 'All service methods have unit tests', completed: false },
          { id: uuidv4(), text: 'Test coverage is 100%', completed: false },
          { id: uuidv4(), text: 'All edge cases are covered', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/services/user/user.service.test.ts', completed: false },
        ],
      });

      expect(task.title).toBe('Write user service tests');
    });
  });

  describe('auto-timestamp management', () => {
    it('should set created_at and updated_at on construction', () => {
      const beforeCreate = new Date().toISOString();
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });
      const afterCreate = new Date().toISOString();

      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();
      expect(task.created_at).toBe(task.updated_at);
      expect(task.created_at >= beforeCreate).toBe(true);
      expect(task.created_at <= afterCreate).toBe(true);
    });

    it('should set completed_at to null initially', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(task.completed_at).toBeNull();
    });

    it('should auto-update updated_at on title change', async () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const oldUpdatedAt = task.updated_at;
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      task.setTitle('Implement login endpoint with JWT');

      expect(task.updated_at).not.toBe(oldUpdatedAt);
      expect(task.updated_at > oldUpdatedAt).toBe(true);
    });

    it('should auto-update updated_at on description change', async () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const oldUpdatedAt = task.updated_at;
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      task.setDescription('Updated description for the login endpoint. This endpoint will validate user credentials using bcrypt and return a JWT token upon successful authentication.');

      expect(task.updated_at).not.toBe(oldUpdatedAt);
    });

    it('should auto-set completed_at when all criteria and deliverables are complete', async () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(task.completed_at).toBeNull();

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      task.completeCriterion(task.success_criteria[0].id);

      expect(task.completed_at).toBeNull(); // Still not complete (deliverable not done)

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      task.completeDeliverable(task.deliverables[0].id);

      expect(task.completed_at).not.toBeNull();
      // Compare ISO 8601 strings lexicographically (works for same format)
      expect(task.completed_at > task.created_at).toBe(true);
    });

    it('should throw ImmutabilityViolationError when trying to uncomplete a criterion', async () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      // Complete everything
      task.completeCriterion(task.success_criteria[0].id);
      task.completeDeliverable(task.deliverables[0].id);
      expect(task.completed_at).not.toBeNull();

      // Attempting to uncomplete should throw ImmutabilityViolationError
      expect(() => {
        task.uncompleteCriterion(task.success_criteria[0].id);
      }).toThrow(ImmutabilityViolationError);

      // completed_at should remain set (item is still complete)
      expect(task.completed_at).not.toBeNull();
    });

    it('should throw ImmutabilityViolationError when trying to uncomplete a deliverable', async () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      // Complete everything
      task.completeCriterion(task.success_criteria[0].id);
      task.completeDeliverable(task.deliverables[0].id);
      expect(task.completed_at).not.toBeNull();

      // Attempting to uncomplete should throw ImmutabilityViolationError
      expect(() => {
        task.uncompleteDeliverable(task.deliverables[0].id);
      }).toThrow(ImmutabilityViolationError);

      // completed_at should remain set (item is still complete)
      expect(task.completed_at).not.toBeNull();
    });

    it('should clear completed_at when adding new incomplete criterion', async () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      // Complete everything
      task.completeCriterion(task.success_criteria[0].id);
      task.completeDeliverable(task.deliverables[0].id);
      expect(task.completed_at).not.toBeNull();

      // Add new criterion
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      task.addSuccessCriterion({
        id: uuidv4(),
        text: 'Password is hashed with bcrypt',
        completed: false,
      });

      expect(task.completed_at).toBeNull();
    });
  });

  describe('status transitions', () => {
    it('should allow valid status transitions', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      task.setStatus('in_progress');
      expect(task.status).toBe('in_progress');

      task.setStatus('in_progress');
      expect(task.status).toBe('in_progress');
    });

    it('should reject invalid status transitions', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(() => {
        task.setStatus('completed');
      }).toThrow(ValidationError);
    });

    it('should only allow completed status when all criteria and deliverables are complete', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      task.setStatus('in_progress');

      expect(() => {
        task.setStatus('completed');
      }).toThrow(ValidationError);

      // Complete everything - this should AUTO-TRANSITION to in_review (new spec)
      task.completeCriterion(task.success_criteria[0].id);
      task.completeDeliverable(task.deliverables[0].id);

      // Status should auto-transition to in_review when all items complete
      expect(task.status).toBe('in_review');
      expect(task.completed_at).not.toBeNull();

      // Now can use approve() to transition to completed
      task.approve();
      expect(task.status).toBe('completed');
    });
  });

  describe('success criteria and deliverable tracking', () => {
    it('should mark success criterion as complete', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const criterion = task.success_criteria[0];
      task.completeCriterion(criterion.id);

      expect(criterion.completed).toBe(true);
      expect(criterion.completed_at).toBeDefined();
    });

    it('should mark deliverable as complete', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const deliverable = task.deliverables[0];
      task.completeDeliverable(deliverable.id);

      expect(deliverable.completed).toBe(true);
    });

    it('should add success criterion', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const initialCount = task.success_criteria.length;
      task.addSuccessCriterion({
        id: uuidv4(),
        text: 'Password is hashed with bcrypt',
        completed: false,
      });

      expect(task.success_criteria).toHaveLength(initialCount + 1);
    });

    it('should reject adding more than 10 success criteria', () => {
      const criteria = Array.from({ length: 10 }, () => ({
        id: uuidv4(),
        text: 'Criterion',
        completed: false,
      }));

      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: criteria,
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(() => {
        task.addSuccessCriterion({
          id: uuidv4(),
          text: 'Too many criteria',
          completed: false,
        });
      }).toThrow(ValidationError);
    });

    it('should reject adding more than 10 deliverables', () => {
      const deliverables = Array.from({ length: 10 }, (_, i) => ({
        id: uuidv4(),
        text: `src/module/file${i}.ts`,
        completed: false,
      }));

      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables,
        _skipAtomicValidation: true,
      });

      expect(() => {
        task.addDeliverable({
          id: uuidv4(),
          text: 'Too many deliverables',
          completed: false,
        });
      }).toThrow(ValidationError);
    });
  });

  describe('edge management', () => {
    it('should add edge', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const targetId = uuidv4();
      task.addEdge(targetId);

      expect(task.edges).toContain(targetId);
    });

    it('should not add duplicate edge', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const targetId = uuidv4();
      task.addEdge(targetId);
      task.addEdge(targetId);

      expect(task.edges.filter(id => id === targetId)).toHaveLength(1);
    });

    it('should remove edge', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const targetId = uuidv4();
      task.addEdge(targetId);
      expect(task.edges).toContain(targetId);

      task.removeEdge(targetId);
      expect(task.edges).not.toContain(targetId);
    });
  });

  describe('blockers and dependencies', () => {
    it('should add blocker', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const blockerId = uuidv4();
      task.addBlocker(blockerId);

      expect(task.blockers).toContain(blockerId);
    });

    it('should remove blocker', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const blockerId = uuidv4();
      task.addBlocker(blockerId);
      expect(task.blockers).toContain(blockerId);

      task.removeBlocker(blockerId);
      expect(task.blockers).not.toContain(blockerId);
    });

    it('should set dependencies explanation', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const explanation = 'Needs API spec from auth-design task';
      task.setDependencies(explanation);

      expect(task.dependencies).toBe(explanation);
    });

    it('should clear dependencies explanation', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const explanation = 'Needs API spec from auth-design task';
      task.setDependencies(explanation);
      expect(task.dependencies).toBe(explanation);

      task.clearDependencies();
      expect(task.dependencies).toBe('');
    });
  });

  describe('remove operations', () => {
    it('should remove success criterion', () => {
      const criterionId1 = uuidv4();
      const criterionId2 = uuidv4();
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: criterionId1, text: 'Endpoint returns 200', completed: false },
          { id: criterionId2, text: 'Unit tests pass', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(task.success_criteria).toHaveLength(2);

      task.removeSuccessCriterion(criterionId1);

      expect(task.success_criteria).toHaveLength(1);
      expect(task.success_criteria.find(c => c.id === criterionId1)).toBeUndefined();
    });

    it('should throw when removing last success criterion', () => {
      const criterionId = uuidv4();
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: criterionId, text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(() => task.removeSuccessCriterion(criterionId)).toThrow(ValidationError);
    });

    it('should throw when removing non-existent criterion', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(() => task.removeSuccessCriterion(uuidv4())).toThrow(ValidationError);
    });

    it('should remove deliverable', () => {
      const deliverableId1 = uuidv4();
      const deliverableId2 = uuidv4();
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: deliverableId1, text: 'src/api/auth/login.ts', completed: false },
          { id: deliverableId2, text: 'tests/api/auth/login.test.ts', completed: false },
        ],
      });

      expect(task.deliverables).toHaveLength(2);

      task.removeDeliverable(deliverableId1);

      expect(task.deliverables).toHaveLength(1);
      expect(task.deliverables.find(d => d.id === deliverableId1)).toBeUndefined();
    });

    it('should throw when removing last deliverable', () => {
      const deliverableId = uuidv4();
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: deliverableId, text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(() => task.removeDeliverable(deliverableId)).toThrow(ValidationError);
    });

    it('should throw when removing non-existent deliverable', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      expect(() => task.removeDeliverable(uuidv4())).toThrow(ValidationError);
    });

    it('should add and remove related file', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      task.addRelatedFile('src/auth/login.ts');
      expect(task.related_files).toContain('src/auth/login.ts');

      task.removeRelatedFile('src/auth/login.ts');
      expect(task.related_files).not.toContain('src/auth/login.ts');
    });

    it('should add and remove C7 verification', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const verification = {
        library_id: '/expressjs/express',
        verified_at: new Date().toISOString(),
        notes: 'Routing patterns'
      };

      task.addC7Verification(verification);
      expect(task.c7_verified).toHaveLength(1);
      expect(task.c7_verified[0].library_id).toBe('/expressjs/express');

      task.removeC7Verification('/expressjs/express');
      expect(task.c7_verified).toHaveLength(0);
    });

    it('should update updated_at timestamp on remove operations', async () => {
      const criterionId1 = uuidv4();
      const criterionId2 = uuidv4();
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: criterionId1, text: 'Endpoint returns 200', completed: false },
          { id: criterionId2, text: 'Unit tests pass', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const originalUpdatedAt = task.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      task.removeSuccessCriterion(criterionId1);

      expect(task.updated_at).not.toBe(originalUpdatedAt);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const json = task.toJSON();

      expect(json.id).toBe(task.id);
      expect(json.title).toBe(task.title);
      expect(json.description).toBe(task.description);
      expect(json.status).toBe(task.status);
      expect(json.priority).toBe(task.priority);
      expect(json.success_criteria).toEqual(task.success_criteria);
      expect(json.deliverables).toEqual(task.deliverables);
      expect(json.created_at).toBe(task.created_at);
      expect(json.updated_at).toBe(task.updated_at);
      expect(json.completed_at).toBe(task.completed_at);
    });

    it('should deserialize from JSON', () => {
      const original = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      const json = original.toJSON();
      const restored = TaskNode.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.title).toBe(original.title);
      expect(restored.description).toBe(original.description);
      expect(restored.status).toBe(original.status);
      expect(restored.priority).toBe(original.priority);
      expect(restored.created_at).toBe(original.created_at);
      expect(restored.updated_at).toBe(original.updated_at);
      expect(restored.completed_at).toBe(original.completed_at);
    });
  });

  describe('auto-status-reset on criterion/deliverable addition', () => {
    it('should reset status from completed to in_progress when adding new criterion', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      // Complete everything and set status to completed
      task.completeCriterion(task.success_criteria[0].id);
      task.completeDeliverable(task.deliverables[0].id);
      task.setStatus('in_progress');
      task.setStatus('completed');

      expect(task.status).toBe('completed');
      expect(task.completed_at).not.toBeNull();

      // Add new criterion - should reset status
      task.addSuccessCriterion({
        id: uuidv4(),
        text: 'Password is hashed with bcrypt',
        completed: false,
      });

      expect(task.status).toBe('in_progress');
      expect(task.completed_at).toBeNull();
    });

    it('should reset status from completed to in_progress when adding new deliverable', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
      });

      // Complete everything and set status to completed
      task.completeCriterion(task.success_criteria[0].id);
      task.completeDeliverable(task.deliverables[0].id);
      task.setStatus('in_progress');
      task.setStatus('completed');

      expect(task.status).toBe('completed');

      // Add new deliverable - should reset status
      task.addDeliverable({
        id: uuidv4(),
        text: 'tests/api/auth/login.test.ts',
        completed: false,
      });

      expect(task.status).toBe('in_progress');
      expect(task.completed_at).toBeNull();
    });

    it('should not change status when adding criterion to non-completed task', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
        ],
        status: 'in_progress',
      });

      // Add new criterion to in_progress task
      task.addSuccessCriterion({
        id: uuidv4(),
        text: 'Password is hashed with bcrypt',
        completed: false,
      });

      // Status should remain in_progress (not changed)
      expect(task.status).toBe('in_progress');
    });

    it('should throw ImmutabilityViolationError when trying to remove completed criterion', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: true },
          { id: uuidv4(), text: 'Unit tests pass', completed: true },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: true },
        ],
        status: 'ready',
      });

      // Attempting to remove completed criterion should throw
      expect(() => {
        task.removeSuccessCriterion(task.success_criteria[0].id);
      }).toThrow(ImmutabilityViolationError);
    });

    it('should throw ImmutabilityViolationError when trying to remove completed deliverable', () => {
      const task = new TaskNode({
        title: 'Implement login endpoint',
        description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token. The endpoint should use bcrypt for password hashing and return a 200 status with valid JWT on correct credentials.',
        success_criteria: [
          { id: uuidv4(), text: 'Endpoint returns 200', completed: false },
          { id: uuidv4(), text: 'Unit tests pass', completed: false },
        ],
        deliverables: [
          { id: uuidv4(), text: 'src/api/auth/login.ts', completed: true },
          { id: uuidv4(), text: 'src/api/auth/test.ts', completed: false },
        ],
      });

      // Attempting to remove completed deliverable should throw
      expect(() => {
        task.removeDeliverable(task.deliverables[0].id);
      }).toThrow(ImmutabilityViolationError);
    });
  });
});
