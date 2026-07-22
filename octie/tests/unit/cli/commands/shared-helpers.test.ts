/**
 * Shared Helpers Unit Tests
 *
 * Tests for shared command helpers including:
 * - displayAtomicTaskPolicy prints the full accepted action verb list
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { displayAtomicTaskPolicy } from '../../../../src/cli/commands/shared-helpers.js';
import { ACTION_VERBS } from '../../../../src/core/models/task-node.js';

describe('shared-helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('displayAtomicTaskPolicy', () => {
    it('should print every ACTION_VERBS entry in the policy output', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displayAtomicTaskPolicy();

      const output = logSpy.mock.calls.map(call => String(call[0] ?? '')).join('\n');
      expect(output).toContain(`Accepted Action Verbs (${ACTION_VERBS.length})`);
      for (const verb of ACTION_VERBS) {
        expect(output).toContain(verb);
      }
    });
  });
});
