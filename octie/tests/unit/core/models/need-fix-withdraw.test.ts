/**
 * Need-Fix Withdraw (three-state) Tests — spec_octie-收敛改进 item A1
 *
 * Covers:
 * - FixItem three-state: open / done / withdrawn
 * - Old-data migration on read: completed:true → done, completed:false → open
 * - Derivation: only OPEN need_fix items block the review gate; withdrawn never blocks
 * - Transition rules: withdraw is terminal, completing a withdrawn item is rejected,
 *   withdrawing a done item is rejected, re-withdrawing is idempotent
 * - Legacy mirror: `completed` stays in sync so pre-1.2.5 readers keep working
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { resolveFixItemState } from '../../../../src/types/index.js';

function makeTask(needFixTexts: string[] = []): TaskNode {
  const node = new TaskNode({
    id: uuidv4(),
    title: 'Implement need_fix withdraw state handling',
    description: 'Task with all items completable so need_fix state alone gates the review transition in these tests',
    success_criteria: [{ id: uuidv4(), text: 'Gate opens when zero open need_fix items', completed: false }],
    deliverables: [{ id: uuidv4(), text: 'tests/unit/core/models/need-fix-withdraw.test.ts', completed: false }],
    blockers: [],
  });
  for (const text of needFixTexts) {
    node.addNeedFix(text, { source: 'review' });
  }
  return node;
}

function finishWork(node: TaskNode): void {
  for (const c of node.success_criteria) node.completeCriterion(c.id);
  for (const d of node.deliverables) node.completeDeliverable(d.id);
}

describe('FixItem three-state (open/done/withdrawn)', () => {
  it('addNeedFix creates items in open state with completed=false mirror', () => {
    const t = makeTask(['Fix the edge case in parser']);
    const item = t.need_fix[0]!;
    expect(item.state).toBe('open');
    expect(item.completed).toBe(false);
  });

  it('completeNeedFix sets state=done and completed=true', () => {
    const t = makeTask(['Fix the edge case in parser']);
    t.completeNeedFix(t.need_fix[0]!.id);
    expect(t.need_fix[0]!.state).toBe('done');
    expect(t.need_fix[0]!.completed).toBe(true);
  });

  it('withdrawNeedFix sets state=withdrawn and keeps completed=false', () => {
    const t = makeTask(['Delete the three test accounts']);
    t.withdrawNeedFix(t.need_fix[0]!.id);
    expect(t.need_fix[0]!.state).toBe('withdrawn');
    expect(t.need_fix[0]!.completed).toBe(false);
  });

  it('withdrawn is terminal: completeNeedFix on a withdrawn item throws', () => {
    const t = makeTask(['Delete the three test accounts']);
    t.withdrawNeedFix(t.need_fix[0]!.id);
    expect(() => t.completeNeedFix(t.need_fix[0]!.id)).toThrow(/withdrawn.*terminal/i);
  });

  it('withdrawing a done item throws (completed items are immutable)', () => {
    const t = makeTask(['Fix the edge case in parser']);
    t.completeNeedFix(t.need_fix[0]!.id);
    expect(() => t.withdrawNeedFix(t.need_fix[0]!.id)).toThrow(/already completed.*cannot be withdrawn/i);
  });

  it('re-withdrawing an already withdrawn item is idempotent', () => {
    const t = makeTask(['Delete the three test accounts']);
    t.withdrawNeedFix(t.need_fix[0]!.id);
    expect(() => t.withdrawNeedFix(t.need_fix[0]!.id)).not.toThrow();
    expect(t.need_fix[0]!.state).toBe('withdrawn');
  });

  it('withdrawing an unknown id throws the same not-found error shape as complete', () => {
    const t = makeTask([]);
    expect(() => t.withdrawNeedFix('nonexistent')).toThrow(/not found/);
  });
});

describe('derivation: withdrawn never blocks the review gate', () => {
  it('withdrawing the only open need_fix item moves a finished task to in_review', () => {
    const t = makeTask(['Delete the three test accounts']);
    finishWork(t);
    // Open need_fix still blocks
    expect(t.calculateStatus()).not.toBe('in_review');
    t.withdrawNeedFix(t.need_fix[0]!.id);
    expect(t.calculateStatus()).toBe('in_review');
  });

  it('a withdrawn-only need_fix list does not count as work started', () => {
    const t = makeTask(['Delete the three test accounts']);
    t.withdrawNeedFix(t.need_fix[0]!.id);
    // No criteria/deliverables checked, no open need_fix → ready, not in_progress
    expect(t.calculateStatus()).toBe('ready');
  });

  it('mixed states: one open item still blocks even when others are done/withdrawn', () => {
    const t = makeTask(['Fix A', 'Fix B', 'Fix C']);
    t.completeNeedFix(t.need_fix[0]!.id);
    t.withdrawNeedFix(t.need_fix[1]!.id);
    finishWork(t);
    expect(t.calculateStatus()).not.toBe('in_review');
    t.withdrawNeedFix(t.need_fix[2]!.id);
    expect(t.calculateStatus()).toBe('in_review');
  });
});

describe('old-data migration on read (completed:boolean → state)', () => {
  const legacyTask = (needFix: Array<{ id: string; text: string; completed: boolean; added_at: string }>) => ({
    id: uuidv4(),
    title: 'Implement legacy fixture migration check',
    description: 'Legacy-shaped task JSON without the state field on need_fix items, as written before the withdrawn state existed',
    status: 'in_progress' as const,
    priority: 'second' as const,
    success_criteria: [{ id: uuidv4(), text: 'Legacy criterion already met', completed: true }],
    deliverables: [{ id: uuidv4(), text: 'legacy/file.ts', completed: true }],
    need_fix: needFix,
    assignee: null,
    blockers: [],
    notes: '',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    completed_at: null,
  });

  it('fromJSON migrates completed:true → done and completed:false → open', () => {
    const data = legacyTask([
      { id: 'a', text: 'Applied fix', completed: true, added_at: '2026-08-01T00:00:00.000Z' },
      { id: 'b', text: 'Pending fix', completed: false, added_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const node = TaskNode.fromJSON(data as never);
    expect(resolveFixItemState(node.need_fix[0]!)).toBe('done');
    expect(resolveFixItemState(node.need_fix[1]!)).toBe('open');
    // Mirror rewritten consistently
    expect(node.need_fix[0]!.completed).toBe(true);
    expect(node.need_fix[1]!.completed).toBe(false);
  });

  it('toJSON after migration writes both state and the legacy completed mirror', () => {
    const data = legacyTask([
      { id: 'a', text: 'Applied fix', completed: true, added_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const out = TaskNode.fromJSON(data as never).toJSON();
    expect(out.need_fix[0]!.state).toBe('done');
    expect(out.need_fix[0]!.completed).toBe(true);
  });

  it('legacy task with only completed:true need_fix derives in_review, not stuck', () => {
    const data = legacyTask([
      { id: 'a', text: 'Applied fix', completed: true, added_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const node = TaskNode.fromJSON(data as never);
    expect(node.calculateStatus()).toBe('in_review');
  });
});
