/**
 * Merge command - Merge two tasks into one
 */

import { Command } from 'commander';
import { getProjectPath, loadGraph, saveGraph, success, error, info, confirmPrompt } from '../utils/helpers.js';
import { invalidateProjectCache } from './shared-helpers.js';
import chalk from 'chalk';
import { mergeTasks } from '../../core/graph/operations.js';

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
      const graph = await loadGraph(projectPath);

      // Support short UUID prefix lookup
      const sourceTask = graph.getNodeByIdOrPrefix(sourceId);
      const targetTask = graph.getNodeByIdOrPrefix(targetId);

      if (!sourceTask) {
        error(`Source task not found: ${sourceId}`);
        process.exit(1);
      }

      if (!targetTask) {
        error(`Target task not found: ${targetId}`);
        process.exit(1);
      }

      // Use full IDs for all subsequent operations
      const fullSourceId = sourceTask.id;
      const fullTargetId = targetTask.id;

      if (fullSourceId === fullTargetId) {
        error('Cannot merge a task with itself');
        process.exit(1);
      }

      // Show preview
      console.log('');
      console.log(chalk.bold('Merge Preview:'));
      console.log('');

      console.log(chalk.gray('Source task (will be deleted):'));
      console.log(`  ${chalk.cyan(fullSourceId.substring(0, 8))} - ${sourceTask.title}`);
      console.log(`  Criteria: ${sourceTask.success_criteria.length}`);
      console.log(`  Deliverables: ${sourceTask.deliverables.length}`);
      console.log('');

      console.log(chalk.gray('Target task (will receive merged content):'));
      console.log(`  ${chalk.cyan(fullTargetId.substring(0, 8))} - ${targetTask.title}`);
      console.log(`  Criteria: ${targetTask.success_criteria.length}`);
      console.log(`  Deliverables: ${targetTask.deliverables.length}`);
      console.log('');

      console.log(chalk.yellow('After merge:'));
      console.log(`  Combined criteria: ${sourceTask.success_criteria.length + targetTask.success_criteria.length}`);
      console.log(`  Combined deliverables: ${sourceTask.deliverables.length + targetTask.deliverables.length}`);
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
      const mergeResult = mergeTasks(graph, fullSourceId, fullTargetId);

      // Save
      await saveGraph(projectPath, graph);
      await invalidateProjectCache(projectPath);

      success(`Tasks merged`);
      info(`Source deleted: ${chalk.cyan(fullSourceId.substring(0, 8))}`);
      info(`Target updated: ${chalk.cyan(fullTargetId.substring(0, 8))}`);
      if (mergeResult.updatedTasks.length > 1) {
        info(`Statuses recalculated: ${mergeResult.updatedTasks.length - 1} affected task(s)`);
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
