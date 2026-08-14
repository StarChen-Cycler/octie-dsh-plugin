/**
 * Shared helpers for command preflight and execution.
 *
 * The engine logic (preflight/execute for init & create, notes handling,
 * registry checks, blocker resolution, cache invalidation) now lives in
 * `src/service/engine.ts` — the DSH-agnostic service layer — and is
 * re-exported here so existing CLI commands keep their import surface.
 * Only CLI display/option concerns (addTaskCreationOptions, the atomic-task
 * policy text) remain in this module.
 */

import { Command, Option } from 'commander';
import { ACTION_VERBS } from '../../core/models/task-node.js';

export {
  CliPreparationError,
  preflightProjectInit,
  executeProjectInit,
  preflightTaskCreation,
  executeTaskCreation,
  invalidateProjectCache,
  normalizeGitBashPath,
} from '../../service/engine.js';

export type {
  CreateCommandOptions,
  InitCommandOptions,
  ValidatedInitRequest,
  PreparedTaskCreation,
} from '../../service/engine.js';

export function addTaskCreationOptions<T extends Command>(command: T): T {
  return command
    .addOption(
      new Option('--title <string>', 'Task title (max 200 chars). Must contain action verb')
        .env('OCTIE_TASK_TITLE')
        .makeOptionMandatory(true),
    )
    .addOption(
      new Option(
        '--description <string>',
        'Detailed task description (min 50 chars, max 10000)',
      )
        .env('OCTIE_TASK_DESCRIPTION')
        .makeOptionMandatory(true),
    )
    .addOption(
      new Option(
        '--success-criterion <text>',
        'Quantitative success criterion (can be specified multiple times)',
      )
        .argParser((value: string, previous: string[]) => [...(previous || []), value])
        .env('OCTIE_SUCCESS_CRITERION')
        .makeOptionMandatory(true),
    )
    .addOption(
      new Option(
        '--deliverable <text>',
        'Specific output expected (can be specified multiple times)',
      )
        .argParser((value: string, previous: string[]) => [...(previous || []), value])
        .env('OCTIE_DELIVERABLE')
        .makeOptionMandatory(true),
    )
    .option('-p, --priority <level>', 'Task priority: top | second | later', 'second')
    .option(
      '-b, --blockers <ids>',
      'Comma-separated task IDs that block this task (creates graph edges for execution order)',
    )
    .option(
      '-d, --dependency-explanation <text>',
      'Explanatory text: WHY this task depends on its blockers (required if --blockers is set)',
    )
    .addOption(
      new Option('--dependencies <text>')
        .hideHelp(),
    )
    .addOption(
      new Option(
        '-f, --related-files <paths>',
        'File paths relevant to task (can be specified multiple times or comma-separated)',
      ).argParser((value: string, previous: string[]) => {
        const items = value.includes(',') ? value.split(',').map(item => item.trim()) : [value.trim()];
        return [...(previous || []), ...items.filter(Boolean)];
      }),
    )
    .addOption(
      new Option(
        '-c, --c7-verified <library:notes>',
        'C7 library verification (format: library-id or library-id:notes, can be specified multiple times)',
      ).argParser((value: string, previous: string[]) => [...(previous || []), value]),
    )
    .addOption(
      new Option(
        '-n, --notes <text>',
        'Additional context or comments (can be specified multiple times)',
      ).argParser((value: string, previous: string[]) => [...(previous || []), value]),
    )
    .option('--notes-file <path>', 'Read notes from file (multi-line notes support)')
    .option('-i, --interactive', 'Interactive mode with prompts')
    .option('--project <path>', 'Path to Octie project directory');
}

export function displayAtomicTaskPolicy(): void {
  console.log('');
  console.log('\x1b[31m\x1b[1m⚠️  ATOMIC TASK POLICY ⚠️\x1b[0m');
  console.log('');
  console.log('\x1b[33mTasks MUST be atomic - small, specific, executable, and verifiable.\x1b[0m');
  console.log('');
  console.log('\x1b[1mWhat is an Atomic Task?\x1b[0m');
  console.log('  • Single purpose: Does ONE thing well');
  console.log('  • Executable: Can be completed in 2-8 hours (typical) or 1-2 days (max)');
  console.log('  • Verifiable: Has quantitative success criteria');
  console.log('  • Independent: Minimizes dependencies on other tasks');
  console.log('');
  console.log('\x1b[31m\x1b[1m❌ BAD Examples (too vague or too large):\x1b[0m');
  console.log('\x1b[90m  • "Fix authentication" (too vague - what specifically?)\x1b[0m');
  console.log('\x1b[90m  • "Build auth system" (too large - split into: login, signup, password reset, etc.)\x1b[0m');
  console.log('\x1b[90m  • "Improve performance" (not measurable - what metric?)\x1b[0m');
  console.log('\x1b[90m  • "Code review" (not atomic - which files? what criteria?)\x1b[0m');
  console.log('');
  console.log('\x1b[32m\x1b[1m✅ GOOD Examples (atomic):\x1b[0m');
  console.log('\x1b[90m  • "Implement login endpoint with JWT" (specific, testable)\x1b[0m');
  console.log('\x1b[90m  • "Add bcrypt password hashing with 10 rounds" (clear, verifiable)\x1b[0m');
  console.log('\x1b[90m  • "Write unit tests for User model" (specific scope)\x1b[0m');
  console.log('\x1b[90m  • "Fix NPE in AuthService.login method" (atomic bug fix)\x1b[0m');
  console.log('');
  console.log('\x1b[1mValidation Rules:\x1b[0m');
  console.log('  • Title: 1-200 chars, must contain action verb (full list below)');
  console.log('  • Description: 50-10000 chars, must be specific');
  console.log('  • Success Criteria: 1-10 items, must be quantitative (subjective words require a measurable anchor: number, unit, status code, file path, or verifiable verb)');
  console.log('  • Deliverables: 1-10 items, must be specific outputs');
  console.log('');
  console.log(`\x1b[1mAccepted Action Verbs (${ACTION_VERBS.length}):\x1b[0m`);
  console.log('  ' + ACTION_VERBS.join(', '));
  console.log('');
  console.log('\x1b[33mIf your task is rejected as non-atomic:\x1b[0m');
  console.log('  → Split it into smaller, focused tasks');
  console.log('  → Be more specific about what will be done');
  console.log('  → Define measurable success criteria');
  console.log('  → Limit scope to 2-8 hours of work');
  console.log('');
}
