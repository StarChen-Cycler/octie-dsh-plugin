/**
 * Atomic Validation Violation Location Tests — spec_octie-收敛改进 item B1
 *
 * Every per-entry violation must name the field, the entry index, and an
 * excerpt of the offending content, so a rejected call is actionable
 * without guessing. CLI prints this list verbatim (non-regression: the
 * complete list is always shown); the DSH tool path embeds it in the
 * error message (covered in tests/unit/plugin/bundle.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { AtomicTaskViolationError } from '../../../../src/types/index.js';

function createWith(patch: {
  title?: string;
  success_criteria?: Array<{ id: string; text: string; completed: boolean }>;
  deliverables?: Array<{ id: string; text: string; completed: boolean }>;
}): AtomicTaskViolationError {
  try {
    new TaskNode({
      id: uuidv4(),
      title: patch.title ?? 'Implement atomic validation probe task',
      description: 'Probe task long enough to pass the description length check for the atomic validation location tests.',
      success_criteria: patch.success_criteria ?? [
        { id: uuidv4(), text: 'probe validation returns violations list', completed: false },
      ],
      deliverables: patch.deliverables ?? [
        { id: uuidv4(), text: 'tests/unit/core/models/atomic-violation-location.test.ts', completed: false },
      ],
      blockers: [],
    });
    throw new Error('expected AtomicTaskViolationError to be thrown');
  } catch (err) {
    if (err instanceof AtomicTaskViolationError) return err;
    throw err;
  }
}

describe('validateAtomicTask violation locations (B1)', () => {
  it('vague deliverables are reported per entry with index and excerpt', () => {
    const err = createWith({
      deliverables: [
        { id: uuidv4(), text: '实现一个功能', completed: false },
        { id: uuidv4(), text: 'src/real/file.ts', completed: false },
        { id: uuidv4(), text: 'stuff', completed: false },
      ],
    });
    const deliverableViolations = err.violations.filter(v => v.startsWith('Deliverable['));
    expect(deliverableViolations.length).toBe(2);
    expect(deliverableViolations[0]).toContain('Deliverable[0] "实现一个功能" is not specific');
    expect(deliverableViolations[1]).toContain('Deliverable[2] "stuff" is not specific');
    expect(deliverableViolations[0]).toContain('file path');
  });

  it('subjective criteria without anchors are reported per entry with index', () => {
    const err = createWith({
      success_criteria: [
        { id: uuidv4(), text: 'works properly', completed: false },
        { id: uuidv4(), text: 'probe returns exit code 0', completed: false },
      ],
    });
    const criterionViolations = err.violations.filter(v => v.startsWith('Success criterion['));
    expect(criterionViolations.length).toBeGreaterThanOrEqual(1);
    expect(criterionViolations[0]).toContain('Success criterion[0]');
    expect(criterionViolations[0]).toContain('works properly');
  });

  it('empty entries are reported with their index', () => {
    const err = createWith({
      deliverables: [{ id: uuidv4(), text: '   ', completed: false }],
    });
    expect(err.violations.some(v => v.startsWith('Deliverable[0] is empty'))).toBe(true);
  });

  it('single-field checks keep naming their field (title/description)', () => {
    const err = createWith({ title: 'stuff' });
    expect(err.violations.some(v => v.includes('Title'))).toBe(true);
  });
});
