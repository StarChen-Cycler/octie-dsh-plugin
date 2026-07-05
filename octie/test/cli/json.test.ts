/**
 * Tests for JSON output helpers — parseFields, formatTaskJSON
 */

import { describe, it, expect, vi } from 'vitest';
import { parseFields, formatTaskJSON } from '../../src/cli/output/json.js';
import { TaskNode } from '../../src/core/models/task-node.js';

function makeTask(overrides: Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
}> = {}): TaskNode {
  return new TaskNode({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: overrides.title || 'Test Task Implementation with full validation',
    description: overrides.description || 'A well-described task that meets the minimum character count for atomic task validation in the Octie system.',
    status: (overrides.status as any) || 'ready',
    priority: (overrides.priority as any) || 'second',
    success_criteria: [
      { id: 'sc-1', text: 'Criterion one passes', completed: false },
      { id: 'sc-2', text: 'Criterion two done', completed: true },
    ],
    deliverables: [
      { id: 'd-1', text: 'src/cli/output/json.ts', completed: false },
    ],
  });
}

describe('parseFields', () => {
  it('returns null for undefined', () => {
    expect(parseFields(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseFields('')).toBeNull();
  });

  it('parses single field', () => {
    expect(parseFields('status')).toEqual(['status']);
  });

  it('parses comma-separated fields, trimming whitespace', () => {
    expect(parseFields('status, priority , title')).toEqual(['status', 'priority', 'title']);
  });

  it('warns on unknown fields but still returns valid ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseFields('status,bogus,title,phantom');
    expect(result).toEqual(['status', 'title']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown field(s): bogus, phantom'));
    warn.mockRestore();
  });

  it('returns empty array when all fields are invalid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseFields('bogus,phantom')).toEqual([]);
    warn.mockRestore();
  });
});

describe('formatTaskJSON', () => {
  const task = makeTask();

  it('returns full JSON object when no fields filter', () => {
    const output = formatTaskJSON(task, null);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('title');
    expect(parsed).toHaveProperty('description');
    expect(parsed).toHaveProperty('status');
    expect(parsed).toHaveProperty('success_criteria');
  });

  it('returns full JSON with empty fields array', () => {
    const output = formatTaskJSON(task, []);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('title');
  });

  it('filters to only requested fields', () => {
    const output = formatTaskJSON(task, ['status', 'priority']);
    const parsed = JSON.parse(output);
    expect(Object.keys(parsed)).toEqual(['status', 'priority']);
    expect(parsed.status).toBe('ready');
    expect(parsed.priority).toBe('second');
    expect(parsed).not.toHaveProperty('title');
    expect(parsed).not.toHaveProperty('description');
  });

  it('includes success_criteria when requested', () => {
    const output = formatTaskJSON(task, ['title', 'success_criteria']);
    const parsed = JSON.parse(output);
    expect(parsed.title).toContain('Test Task');
    expect(parsed.success_criteria).toHaveLength(2);
  });
});
