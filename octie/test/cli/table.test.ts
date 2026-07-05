/**
 * Tests for table formatter — formatTaskDetailTable with --fields filtering
 */

import { describe, it, expect } from 'vitest';
import { formatTaskDetailTable } from '../../src/cli/output/table.js';
import { TaskNode } from '../../src/core/models/task-node.js';

function makeTask(overrides: Partial<{
  title: string; description: string; status: string; priority: string;
  success_criteria: { id: string; text: string; completed: boolean }[];
  deliverables: { id: string; text: string; completed: boolean }[];
  blockers: string[];
  notes: string;
}> = {}): TaskNode {
  return new TaskNode({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: overrides.title || 'Add JWT authentication to login endpoint',
    description: overrides.description || 'This task implements JWT-based authentication for the login endpoint with token refresh, session invalidation, and comprehensive error handling for expired tokens.',
    status: (overrides.status as any) || 'in_progress',
    priority: (overrides.priority as any) || 'second',
    success_criteria: overrides.success_criteria || [
      { id: 'sc-1', text: 'Endpoint returns 200 with valid JWT token', completed: false },
    ],
    deliverables: overrides.deliverables || [
      { id: 'd-1', text: 'src/auth/login.ts', completed: false },
    ],
    blockers: overrides.blockers || [],
    notes: overrides.notes || '',
  });
}

describe('formatTaskDetailTable', () => {
  const task = makeTask({
    blockers: ['bbbbbbbb-1111-2222-3333-444444444444'],
    notes: 'Some important note about implementation details',
  });

  it('renders all sections by default (no fields filter)', () => {
    const output = formatTaskDetailTable(task, null);
    expect(output).toContain('JWT authentication');
    expect(output).toContain('Status:');
    expect(output).toContain('Description:');
    expect(output).toContain('Success Criteria:');
    expect(output).toContain('Deliverables:');
    expect(output).toContain('Blocked by:');
    expect(output).toContain('Notes:');
  });

  it('only shows requested fields with --fields', () => {
    const output = formatTaskDetailTable(task, ['status', 'blockers']);
    expect(output).toContain('Status:');
    expect(output).toContain('Blocked by:');
    expect(output).not.toContain('Description:');
    expect(output).not.toContain('Success Criteria:');
    expect(output).not.toContain('Deliverables:');
    expect(output).not.toContain('Notes:');
  });

  it('can show just success_criteria and deliverables', () => {
    const output = formatTaskDetailTable(task, ['success_criteria', 'deliverables']);
    expect(output).toContain('Success Criteria:');
    expect(output).toContain('Deliverables:');
    expect(output).not.toContain('Description:');
    expect(output).not.toContain('Notes:');
  });

  it('always shows header (title + ID)', () => {
    const output = formatTaskDetailTable(task, ['status']);
    expect(output).toContain('JWT authentication');
    expect(output).toContain('aaaaaaaa-bbbb');
  });

  it('hides description when not in fields', () => {
    const output = formatTaskDetailTable(task, ['status', 'priority', 'created_at']);
    expect(output).not.toContain('Description:');
  });

  it('empty fields array shows only header (all fields invalid edge case)', () => {
    const output = formatTaskDetailTable(task, []);
    expect(output).toContain('JWT authentication');
    expect(output).toContain('aaaaaaaa-bbbb');
    // No fields selected → no sections shown
    expect(output).not.toContain('Status:');
    expect(output).not.toContain('Description:');
    expect(output).not.toContain('Success Criteria:');
  });
});
