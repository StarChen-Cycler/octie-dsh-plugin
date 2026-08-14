/**
 * Merge command - Merge two tasks into one
 *
 * The engine lives in the service layer (`mergePreview` + `mergeTask`);
 * this command keeps only UX: preview, confirmation, output, exit codes.
 */

import { Command } from 'commander';
import { getProjectPath, success, error, info, confirmPrompt } from '../utils/helpers.js';
import { mergePreview, mergeTask } from '../../service/index.js';
import chalk from 'chalk';

/**
 * Create the merge command
 */
export const mergeCommand = new Command('merge')
  .description('Merge two tasks into one')
  .argument('<sourceId>', 'Source task ID (will be deleted after merge)')
  .argument('<targetId>', 'Target task ID (will receive merged content)')
  .option('--force', 'Skip confirmation prompt')
  .addHelpText('after', `
Merge Behavior:
  • Source task is DELETED after merge
  • Target task receives:
    - All success criteria from source (appended)
    - All deliverables from source (appended)
    - Notes from source (appended)
    - Related files from source (appended)
  • Blockers are transferred from source to target

Task ID Format:
  Supports full UUID or first 7-8 characters (short UUID).

Confirmation:
  Prompts for confirmation unless --force is used.
  Shows preview of combined criteria/deliverables counts.

Examples:
  $ octie merge abc12345 def67890
  $ octie merge abc12345 def67890 --force

Use Case:
  Merge duplicate tasks or combine related tasks that should be one.

Warning:
  Cannot undo! A backup is created automatically before merge.
`)
  .action(async (sourceId, targetId, options, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);

      const preview = await mergePreview(projectPath, sourceId, targetId);
      const fullSourceId = preview.source.id;
      const fullTargetId = preview.target.id;

      // Show preview
      console.log('');
      console.log(chalk.bold('Merge Preview:'));
      console.log('');

      console.log(chalk.gray('Source task (will be deleted):'));
      console.log(`  ${chalk.cyan(fullSourceId.substring(0, 8))} - ${preview.source.title}`);
      console.log(`  Criteria: ${preview.source.criteriaCount}`);
      console.log(`  Deliverables: ${preview.source.deliverablesCount}`);
      console.log('');

      console.log(chalk.gray('Target task (will receive merged content):'));
      console.log(`  ${chalk.cyan(fullTargetId.substring(0, 8))} - ${preview.target.title}`);
      console.log(`  Criteria: ${preview.target.criteriaCount}`);
      console.log(`  Deliverables: ${preview.target.deliverablesCount}`);
      console.log('');

      console.log(chalk.yellow('After merge:'));
      console.log(`  Combined criteria: ${preview.source.criteriaCount + preview.target.criteriaCount}`);
      console.log(`  Combined deliverables: ${preview.source.deliverablesCount + preview.target.deliverablesCount}`);
      console.log('');

      // Confirm
      if (!options.force) {
        console.log(chalk.gray('(Use --force to skip confirmation)'));
        const confirmed = await confirmPrompt(chalk.yellow('Merge these tasks? (y/N)'));
        if (!confirmed) {
          info('Merge cancelled');
          process.exit(0);
        }
      }

      // Perform merge and capture affected tasks for user feedback
      const mergeResult = await mergeTask(projectPath, sourceId, targetId);

      success(`Tasks merged`);
      info(`Source deleted: ${chalk.cyan(mergeResult.sourceId.substring(0, 8))}`);
      info(`Target updated: ${chalk.cyan(mergeResult.targetId.substring(0, 8))}`);
      if (mergeResult.affectedCount > 1) {
        info(`Statuses recalculated: ${mergeResult.affectedCount - 1} affected task(s)`);
      }

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to merge tasks');
      }
      process.exit(1);
    }
  });
