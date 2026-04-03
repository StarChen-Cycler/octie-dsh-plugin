import { describe, expect, it } from 'vitest';
import { extractProjectPathFromArgs } from '../../../../src/core/registry/root-guard.js';

describe('root guard project path extraction', () => {
  it('extracts explicit long-form --project path', () => {
    const result = extractProjectPathFromArgs(
      ['--project', 'config-driven-modification', 'list', '--format', 'md'],
      'I:\\ai-automation-projects\\task-driver'
    );

    expect(result).toBe('I:\\ai-automation-projects\\task-driver\\config-driven-modification');
  });

  it('extracts equals-form project path before command parsing', () => {
    const result = extractProjectPathFromArgs(
      ['--project=config-driven-modification', 'graph', 'validate'],
      'I:\\ai-automation-projects\\task-driver'
    );

    expect(result).toBe('I:\\ai-automation-projects\\task-driver\\config-driven-modification');
  });

  it('ignores short-form -p so subcommands can reuse it safely', () => {
    const result = extractProjectPathFromArgs(
      ['handoff', 'create', '-p', 'second'],
      'I:\\ai-automation-projects\\task-driver'
    );

    expect(result).toBeUndefined();
  });

  it('returns undefined when no explicit project is provided', () => {
    const result = extractProjectPathFromArgs(
      ['list', '--graph', '--format', 'md'],
      'I:\\ai-automation-projects\\task-driver'
    );

    expect(result).toBeUndefined();
  });
});
