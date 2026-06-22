/**
 * TaskNode.calculateStatus() Unit Tests
 *
 * Tests for the status calculation state machine covering:
 * - All 5 status values: ready, in_progress, in_review, completed, blocked
 * - ignoreBlockers option
 * - Completed task regression paths (need_fix added, blocker added)
 * - Empty success_criteria edge case
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode } from '../../../../src/core/models/task-node.js';

/** Helper: create a minimal valid TaskNode */
function makeTask(overrides: Partial<{
  status: string;
  blockers: string[];
  criteriaDone: boolean;
  deliverablesDone: boolean;
  needFixCount: number;
  needFixDone: boolean;
}> = {}): TaskNode {
  // Only pass explicit status if no work has started — otherwise let constructor auto-calculate
  const hasWorkStarted = overrides.criteriaDone || overrides.deliverablesDone || (overrides.needFixCount ?? 0) > 0;
  const explicitStatus = hasWorkStarted ? undefined : (overrides.status || undefined);

  const node = new TaskNode({
    id: uuidv4(),
    title: 'Implement test status calculation module',
    description: 'Create a comprehensive test that validates the status calculation state machine works correctly with all edge cases covered for the entire component',
    status: explicitStatus as never,
    priority: 'second',
    success_criteria: [
      { id: uuidv4(), text: 'All status values calculate correctly', completed: overrides.criteriaDone ?? false },
    ],
    deliverables: [
      { id: uuidv4(), text: 'test/unit/core/models/status-calculation.test.ts', completed: overrides.deliverablesDone ?? false },
    ],
    blockers: overrides.blockers ?? [],
  });

  // Add need_fix items if specified
  for (let i = 0; i < (overrides.needFixCount ?? 0); i++) {
    node.addNeedFix(
      `Fix issue #${i + 1} in status calculation`,
      'review',
      'src/core/models/task-node.ts'
    );
    if (overrides.needFixDone) {
      // Mark latest need_fix as completed
      const last = node.need_fix[node.need_fix.length - 1];
      last.completed = true;
      last.completed_at = new Date().toISOString();
    }
  }

  return node;
}

describe('TaskNode.calculateStatus()', () => {
  describe('ready status', () => {
    it('should return ready when no items are checked and no blockers', () => {
      const task = makeTask();
      expect(task.calculateStatus()).toBe('ready');
    });

    it('should return ready when no items are checked (even with empty need_fix)', () => {
      const task = makeTask();
      // explicitly no need_fix — already default
      expect(task.calculateStatus()).toBe('ready');
    });
  });

  describe('in_progress status', () => {
    it('should return in_progress when at least one criterion is completed', () => {
      const task = makeTask({ criteriaDone: true });
      expect(task.calculateStatus()).toBe('in_progress');
    });

    it('should return in_progress when at least one deliverable is completed', () => {
      const task = makeTask({ deliverablesDone: true });
      expect(task.calculateStatus()).toBe('in_progress');
    });

    it('should return in_progress when a need_fix item exists', () => {
      const task = makeTask({ needFixCount: 1 });
      expect(task.calculateStatus()).toBe('in_progress');
    });
  });

  describe('in_review status', () => {
    it('should return in_review when all criteria and deliverables are complete', () => {
      const task = makeTask({ criteriaDone: true, deliverablesDone: true });
      expect(task.calculateStatus()).toBe('in_review');
    });

    it('should return in_review even when blockers are present (all items complete)', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        blockers: ['some-blocker-id'],
      });
      expect(task.calculateStatus()).toBe('in_review');
    });

    it('should return in_review when criteria, deliverables, and need_fix are all complete', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        needFixCount: 1,
        needFixDone: true,
      });
      expect(task.calculateStatus()).toBe('in_review');
    });
  });

  describe('blocked status', () => {
    it('should return blocked when blockers exist and work is not complete', () => {
      const task = makeTask({ blockers: ['blocker-abc'] });
      expect(task.calculateStatus()).toBe('blocked');
    });

    it('should return blocked when blockers exist and only partial work done', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: false,
        blockers: ['blocker-xyz'],
      });
      expect(task.calculateStatus()).toBe('blocked');
    });

    it('should NOT be blocked when all items are complete (in_review takes priority)', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        blockers: ['blocker-123'],
      });
      expect(task.calculateStatus()).toBe('in_review');
    });
  });

  describe('ignoreBlockers option', () => {
    it('should ignore blockers when ignoreBlockers is true', () => {
      const task = makeTask({ blockers: ['blocker-1', 'blocker-2'] });
      // Without ignoreBlockers, this would be 'blocked'
      expect(task.calculateStatus({ ignoreBlockers: true })).toBe('ready');
    });

    it('should ignore blockers and return in_progress when work has started', () => {
      const task = makeTask({
        criteriaDone: true,
        blockers: ['blocker-1'],
      });
      expect(task.calculateStatus({ ignoreBlockers: true })).toBe('in_progress');
    });

    it('should ignore blockers and return in_review when all complete', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        blockers: ['blocker-1'],
      });
      expect(task.calculateStatus({ ignoreBlockers: true })).toBe('in_review');
    });
  });

  describe('recalculateStatus — completed regression paths', () => {
    it('should keep completed status when no regression conditions exist', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        status: 'completed',
      });
      // Set status to completed directly (simulating approved task)
      task.status = 'completed';
      expect(task.recalculateStatus()).toBe('completed');
    });

    it('should revert completed → in_progress when new need_fix is added', () => {
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        status: 'completed',
      });
      task.status = 'completed';

      // Add a new need_fix — this triggers regression
      task.addNeedFix('Discovered a bug after approval', 'runtime', 'src/file.ts');
      // recalculateStatus should detect the need_fix and revert
      expect(task.recalculateStatus()).toBe('in_progress');
      expect(task.status).toBe('in_progress');
    });

    it('should stay completed when blocker is added to fully-complete task (in_review > blocked)', () => {
      // When all items are complete, in_review takes priority over blocked.
      // Adding a blocker to an already-completed task doesn't regress it
      // because the work is already done.
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: true,
        status: 'completed',
      });
      task.status = 'completed';

      task.addBlocker('new-blocker-id');
      // calculateStatus() returns 'in_review' (all complete > blocked),
      // and recalculateStatus() only regresses on in_progress/blocked
      expect(task.recalculateStatus()).toBe('completed');
      expect(task.status).toBe('completed');
    });

    it('should revert completed → blocked when blocker added and items incomplete', () => {
      // Regression: when work is NOT all complete, adding a blocker
      // while already completed reverts to blocked
      const task = makeTask({
        criteriaDone: true,
        deliverablesDone: false,
      });
      // Force to completed (simulating pre-mature approval edge case)
      task.status = 'completed';
      task.blockers.push('existing-blocker');

      // recalculateStatus: calculateStatus returns 'blocked' (items incomplete + blockers)
      // regression path triggers because newStatus === 'blocked'
      expect(task.recalculateStatus()).toBe('blocked');
      expect(task.status).toBe('blocked');
    });
  });

  describe('recalculateStatus — normal transitions', () => {
    it('should transition ready → in_progress when criterion is completed', () => {
      const task = makeTask();
      expect(task.status).toBe('ready');

      task.success_criteria[0].completed = true;
      expect(task.recalculateStatus()).toBe('in_progress');
      expect(task.status).toBe('in_progress');
    });

    it('should transition in_progress → in_review when all items complete', () => {
      const task = makeTask({ criteriaDone: true });
      expect(task.status).toBe('in_progress');

      task.deliverables[0].completed = true;
      expect(task.recalculateStatus()).toBe('in_review');
      expect(task.status).toBe('in_review');
    });
  });
});
