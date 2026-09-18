/**
 * Old-Format Fixture Compatibility Tests (convergence round guardrail)
 *
 * Backward-compatibility guardrail for spec_octie-收敛改进 item A1:
 * need_fix items in old project.json / snapshot files use `completed: boolean`.
 * These fixtures must keep loading through the real TaskNode.fromJSON path
 * after the withdrawn third state is introduced — no manual data edits allowed.
 *
 * Fixtures:
 * - tests/fixtures/convergence/old-format-project.json (project.json shape)
 * - tests/fixtures/convergence/old-snapshot.json (history snapshot shape)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TaskNode } from '../../../../src/core/models/task-node.js';
import type { TaskNodeType } from '../../../../src/types/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../../../fixtures/convergence');

interface ProjectFile {
  format: string;
  tasks: Record<string, TaskNodeType>;
}

function loadFixture(name: string): ProjectFile {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8')) as ProjectFile;
}

describe('old-format fixtures (pre-withdrawn need_fix era)', () => {
  it('fixture files exist and carry the octie-project format marker', () => {
    for (const name of ['old-format-project.json', 'old-snapshot.json']) {
      const fixture = loadFixture(name);
      expect(fixture.format).toBe('octie-project');
      expect(Object.keys(fixture.tasks).length).toBeGreaterThan(0);
    }
  });

  it('fixtures really use the old completed:boolean need_fix shape', () => {
    // Guard the guardrail: if someone regenerates fixtures in the new format,
    // this test fails so the migration coverage cannot silently vanish.
    const fixture = loadFixture('old-format-project.json');
    const allFixItems = Object.values(fixture.tasks).flatMap((t) => t.need_fix ?? []);
    expect(allFixItems.length).toBeGreaterThanOrEqual(3);
    for (const item of allFixItems) {
      expect(typeof (item as { completed: unknown }).completed).toBe('boolean');
      expect(item).not.toHaveProperty('state');
    }
    // Both boolean values must be represented to cover both migration branches
    const values = allFixItems.map((i) => (i as { completed: boolean }).completed);
    expect(values).toContain(true);
    expect(values).toContain(false);
  });

  it('every task in old-format-project.json loads via TaskNode.fromJSON without error', () => {
    const fixture = loadFixture('old-format-project.json');
    for (const [id, data] of Object.entries(fixture.tasks)) {
      const node = TaskNode.fromJSON(data);
      expect(node.id).toBe(id);
      expect(node.need_fix.length).toBe((data.need_fix ?? []).length);
    }
  });

  it('every task in old-snapshot.json loads via TaskNode.fromJSON without error', () => {
    const fixture = loadFixture('old-snapshot.json');
    for (const [id, data] of Object.entries(fixture.tasks)) {
      const node = TaskNode.fromJSON(data);
      expect(node.id).toBe(id);
    }
  });

  it('toJSON round-trip preserves need_fix content of old-format data', () => {
    const fixture = loadFixture('old-format-project.json');
    for (const data of Object.values(fixture.tasks)) {
      const node = TaskNode.fromJSON(data);
      const out = node.toJSON();
      const before = (data.need_fix ?? []).map((i) => ({ id: i.id, text: i.text }));
      const after = out.need_fix.map((i) => ({ id: i.id, text: i.text }));
      expect(after).toEqual(before);
    }
  });
});
