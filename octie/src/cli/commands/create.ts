/**
 * Create command - Create a new task with atomic task validation
 */

import { Command, Option } from 'commander';
import chalk from 'chalk';
import { AtomicTaskViolationError } from '../../types/index.js';
import { getProjectPath, loadGraph, success, error, info } from '../utils/helpers.js';
import {
  CliPreparationError,
  type CreateCommandOptions,
  displayAtomicTaskPolicy,
  executeTaskCreation,
  preflightTaskCreation,
} from './shared-helpers.js';

/**
 * Create the create command
 */
export const createCommand = new Command('create')
  .description('Create a new atomic task in the project')
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
    '-d, --dependencies <text>',
    'Explanatory text: WHY this task depends on its blockers (required if --blockers is set)',
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
  .option('--project <path>', 'Path to Octie project directory')
  .action(async (options, command) => {
    try {
      if (process.argv.includes('--help') || process.argv.includes('-h')) {
        displayAtomicTaskPolicy();
        return;
      }

      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(options.project || globalOpts.project);
      const graph = await loadGraph(projectPath);
      const prepared = preflightTaskCreation(graph, options as CreateCommandOptions);
      const task = await executeTaskCreation(projectPath, graph, prepared);

      success(`Task created: ${chalk.cyan(task.id)}`);
      info(`Title: ${task.title}`);
      info(`Priority: ${chalk.yellow(task.priority)}`);

      if (task.blockers.length > 0) {
        info(`Blocked by: ${task.blockers.map(id => chalk.cyan(id)).join(', ')}`);
        if (task.dependencies) {
          info(`Dependencies: ${task.dependencies}`);
        }
      }

      console.log('');
      console.log(chalk.gray('View task:'), chalk.gray(`octie get ${task.id}`));

      process.exit(0);
    } catch (err) {
      if (err instanceof CliPreparationError) {
        error(err.message);
        for (const message of err.infoMessages) {
          info(message);
        }
        process.exit(1);
      }

      if (err instanceof AtomicTaskViolationError) {
        error(err.message);
        if (err.violations.length > 0) {
          console.log('');
          console.log(chalk.yellow.bold('Specific issues found:'));
          for (const violation of err.violations) {
            console.log(chalk.red('  ✗') + violation);
          }
          console.log('');
          info('See atomic task policy below for guidance');
          displayAtomicTaskPolicy();
        }
        process.exit(1);
      }

      if (err instanceof Error) {
        error(err.message);
        if (err.message.includes('atomic') || err.message.includes('vague')) {
          console.log('');
          info('See atomic task policy above for guidance');
          displayAtomicTaskPolicy();
        }
      } else {
        error('Failed to create task');
      }

      process.exit(1);
    }
  });

createCommand.on('--help', () => {
  displayAtomicTaskPolicy();
  console.log('');
  console.log(chalk.bold('Blockers & Dependencies (Twin Feature):'));
  console.log(chalk.cyan('  --blockers (-b)') + ': Comma-separated task IDs that block this task.');
  console.log('                Creates GRAPH EDGES affecting execution order.');
  console.log('                Task A blocks Task B → A must complete before B starts.');
  console.log('');
  console.log(chalk.cyan('  --dependencies (-d)') + ': Explanatory text WHY this task depends on its blockers.');
  console.log('                  REQUIRED when --blockers is set (twin validation).');
  console.log('                  Does NOT affect execution order - pure metadata.');
  console.log('');
  console.log(chalk.yellow('  Example (both required together):'));
  console.log('    octie create --title "Build Frontend" \\');
  console.log('      --blockers abc123,def456 \\');
  console.log('      --dependencies "Needs API spec from abc123 and auth from def456"');
  console.log('');
  console.log(chalk.red('  Error if only one provided:'));
  console.log('    --blockers without --dependencies → Error: twin required');
  console.log('    --dependencies without --blockers → Error: twin required');
});
