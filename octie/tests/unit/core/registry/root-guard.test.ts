import { describe, expect, it } from 'vitest';
import { extractProjectPathFromArgs } from '../../../../src/core/registry/root-guard.js';

// The original fixtures use Windows-style roots; express the same intent with
// platform-native separators so the suite runs on Linux CI as well.
const isWindows = process.platform === 'win32';
const ROOT = isWindows
  ? 'I:\\ai-automation-projects\\task-driver'
  : '/srv/ai-automation-projects/task-driver';
const RELATIVE_PROJECT = 'config-driven-modification';
const EXPECTED_JOINED = isWindows
  ? `${ROOT}\\${RELATIVE_PROJECT}`
  : `${ROOT}/${RELATIVE_PROJECT}`;

describe('root guard project path extraction', () => {
  it('extracts explicit long-form --project path', () => {
    const result = extractProjectPathFromArgs(
      ['--project', 'config-driven-modification', 'list', '--format', 'md'],
      ROOT
    );

    expect(result).toBe(EXPECTED_JOINED);
  });

  it('extracts equals-form project path before command parsing', () => {
    const result = extractProjectPathFromArgs(
      ['--project=config-driven-modification', 'graph', 'validate'],
      ROOT
    );

    expect(result).toBe(EXPECTED_JOINED);
  });

  it('ignores short-form -p so subcommands can reuse it safely', () => {
    const result = extractProjectPathFromArgs(
      ['handoff', 'create', '-p', 'second'],
      ROOT
    );

    expect(result).toBeUndefined();
  });

  it('returns undefined when no explicit project is provided', () => {
    const result = extractProjectPathFromArgs(
      ['list', '--graph', '--format', 'md'],
      ROOT
    );

    expect(result).toBeUndefined();
  });
});
