/**
 * Shared Field Filtering Tests — spec_octie-收敛改进 item C1
 *
 * The single parseFieldList/filterTaskFields implementation in
 * src/service/fields.ts backs both the CLI --fields flag (thin wrapper in
 * cli/output/json.ts) and the DSH octie_get fields parameter.
 */

import { describe, it, expect } from 'vitest';
import { TASK_FIELDS, parseFieldList, filterTaskFields } from '../../../src/service/fields.js';
import type { TaskProjection } from '../../../src/service/types.js';

const probeTask = {
  id: 'p1',
  title: 'Probe',
  status: 'ready',
  priority: 'second',
  success_criteria: [{ id: 'c1', text: 'x', completed: false }],
  deliverables: [{ id: 'd1', text: 'y', completed: false }],
  need_fix: [],
  notes: 'long notes',
} as unknown as TaskProjection;

describe('parseFieldList', () => {
  it('undefined/null/empty select everything (fields: null)', () => {
    expect(parseFieldList(undefined).fields).toBeNull();
    expect(parseFieldList(null).fields).toBeNull();
    expect(parseFieldList('').fields).toBeNull();
    expect(parseFieldList([]).fields).toBeNull();
  });

  it("literal 'all' selects everything", () => {
    expect(parseFieldList(['all']).fields).toBeNull();
    expect(parseFieldList('all').fields).toBeNull();
  });

  it('parses comma-separated strings and arrays identically', () => {
    expect(parseFieldList('status,title').fields).toEqual(['status', 'title']);
    expect(parseFieldList(['status', 'title']).fields).toEqual(['status', 'title']);
    expect(parseFieldList(' status , title ').fields).toEqual(['status', 'title']);
  });

  it('unknown fields are separated into invalid, valid ones kept', () => {
    const { fields, invalid } = parseFieldList(['status', 'bogus']);
    expect(fields).toEqual(['status']);
    expect(invalid).toEqual(['bogus']);
  });
});

describe('filterTaskFields', () => {
  it('null fields returns the full projection (all keys present)', () => {
    const out = filterTaskFields(probeTask, null);
    expect(out).toMatchObject({ id: 'p1', title: 'Probe', notes: 'long notes' });
    expect(out).toHaveProperty('success_criteria');
    expect(out).toHaveProperty('deliverables');
    expect(out).toHaveProperty('need_fix');
  });

  it('[status,title] returns exactly those two keys', () => {
    const out = filterTaskFields(probeTask, ['status', 'title']);
    expect(Object.keys(out).sort()).toEqual(['status', 'title']);
    expect(out).toMatchObject({ status: 'ready', title: 'Probe' });
  });

  it('TASK_FIELDS covers the documented field set', () => {
    for (const f of ['status', 'title', 'success_criteria', 'deliverables', 'need_fix', 'notes', 'completed_at']) {
      expect(TASK_FIELDS.has(f)).toBe(true);
    }
  });
});
