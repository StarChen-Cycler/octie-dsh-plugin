/**
 * Markdown Output Round-Trip Tests
 *
 * Tests that formatTaskMarkdown output parses back through the importer:
 * - Criterion evidence survives format -> parse (byte-identical)
 * - Pre-evidence markdown (no Evidence lines) parses without evidence keys
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import { formatTaskMarkdown } from '../../../../src/cli/output/markdown.js';
import { parseMarkdownTasks } from '../../../../src/cli/commands/import.js';

function buildTask(criterion: {
  id: string;
  text: string;
  completed: boolean;
  evidence?: string;
}): TaskNode {
  return new TaskNode({
    id: uuidv4(),
    title: 'Implement login endpoint',
    description: 'Create POST /auth/login endpoint that validates credentials and returns JWT token',
    status: 'ready',
    priority: 'second',
    success_criteria: [criterion],
    deliverables: [
      { id: uuidv4(), text: 'src/api/auth/login.ts', completed: false },
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

describe('markdown evidence round-trip', () => {
  it('should preserve criterion evidence byte-identical through format and parse', () => {
    const criterionId = uuidv4();
    const evidenceText = '0.86 ms median, n=810';
    const task = buildTask({
      id: criterionId,
      text: 'Endpoint responds in under 100ms',
      completed: true,
      evidence: evidenceText,
    });

    const md = formatTaskMarkdown(task);
    expect(md).toContain(`- Evidence: ${evidenceText}`);

    const parsed = parseMarkdownTasks(md);
    expect(parsed.length).toBe(1);
    const criterion = parsed[0]!.success_criteria.find(c => c.id === criterionId);
    expect(criterion).toBeDefined();
    expect(criterion?.completed).toBe(true);
    expect(criterion?.evidence).toBe(evidenceText);
  });

  it('should parse pre-evidence markdown without evidence keys', () => {
    const criterionId = uuidv4();
    const task = buildTask({
      id: criterionId,
      text: 'Endpoint returns 200',
      completed: false,
    });

    const md = formatTaskMarkdown(task);
    expect(md).not.toContain('- Evidence:');

    const parsed = parseMarkdownTasks(md);
    expect(parsed.length).toBe(1);
    const criterion = parsed[0]!.success_criteria.find(c => c.id === criterionId);
    expect(criterion).toBeDefined();
    expect(criterion?.evidence).toBeUndefined();
  });
});
