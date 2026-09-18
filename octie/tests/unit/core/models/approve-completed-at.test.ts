/**
 * approve() completed_at Refresh Tests — spec_octie-收敛改进 item A2
 *
 * completed_at is a single field with single semantics ("when this round
 * finished / was last touched"): written when all items are checked
 * (_checkCompletion) and refreshed on every successful approve(). A task
 * that completes, gets modified, and is re-approved must show the LAST
 * approval time. The "in_review with a completed_at already set"
 * combination remains accepted behavior (not a defect).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode } from '../../../../src/core/models/task-node.js';

function makeTask(): TaskNode {
  return new TaskNode({
    id: uuidv4(),
    title: 'Implement approve timestamp refresh probe',
    description: 'Probe task for the A2 completed_at refresh on approve behavior with deterministic fake timers.',
    success_criteria: [{ id: uuidv4(), text: 'approve() refreshes completed_at to approval time', completed: false }],
    deliverables: [{ id: uuidv4(), text: 'tests/unit/core/models/approve-completed-at.test.ts', completed: false }],
    blockers: [],
  });
}

describe('approve() refreshes completed_at (A2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('first approve sets completed_at to the approval time', () => {
    const t = makeTask();
    t.completeCriterion(t.success_criteria[0]!.id);
    vi.setSystemTime(new Date('2026-09-18T12:01:00.000Z'));
    t.completeDeliverable(t.deliverables[0]!.id); // _checkCompletion writes 12:01
    vi.setSystemTime(new Date('2026-09-18T12:02:00.000Z'));
    t.approve();
    expect(t.status).toBe('completed');
    expect(t.completed_at).toBe('2026-09-18T12:02:00.000Z'); // approval time, not 12:01
  });

  it('complete → modify → re-approve: completed_at reflects the LAST approve', () => {
    const t = makeTask();
    t.completeCriterion(t.success_criteria[0]!.id);
    t.completeDeliverable(t.deliverables[0]!.id);
    vi.setSystemTime(new Date('2026-09-18T12:10:00.000Z'));
    t.approve();
    expect(t.completed_at).toBe('2026-09-18T12:10:00.000Z');

    // Modify: new criterion added → completed_at cleared, status back to in_progress
    vi.setSystemTime(new Date('2026-09-18T12:20:00.000Z'));
    t.addSuccessCriterion({ id: uuidv4(), text: 'second round criterion passes', completed: false });
    expect(t.completed_at).toBeNull();
    expect(t.status).toBe('in_progress');

    // Finish the second round, then re-approve an hour later
    vi.setSystemTime(new Date('2026-09-18T12:30:00.000Z'));
    t.completeCriterion(t.success_criteria[1]!.id); // _checkCompletion writes 12:30
    expect(t.status).toBe('in_review');
    vi.setSystemTime(new Date('2026-09-18T13:00:00.000Z'));
    t.approve();
    expect(t.completed_at).toBe('2026-09-18T13:00:00.000Z'); // last approve, not 12:30 or 12:10
  });

  it('failed approve (not in_review) does not touch completed_at', () => {
    const t = makeTask();
    expect(() => t.approve()).toThrow(/in_review/);
    expect(t.completed_at).toBeNull();
  });
});
