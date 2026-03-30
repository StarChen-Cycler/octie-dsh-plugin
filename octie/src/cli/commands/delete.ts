/**
 * Delete command - Delete a task from the graph
 */

import { Command } from 'commander';
import { getProjectPath, loadGraph, saveGraph, success, error, info, warning, confirmPrompt } from '../utils/helpers.js';
import { touchProject } from '../../core/registry/index.js';
import chalk from 'chalk';
import { cutNode, cascadeDelete } from '../../core/graph/operations.js';

/**
 * Create the delete command
 */
export const deleteCommand = new Command('delete')
  .description('Delete a task from the project')
  .argument('<id>', 'Task ID to delete (full UUID or first 7-8 characters)')
  .option('--reconnect', 'Reconnect edges after deletion (A→B→C → A→C)')
  .option('--cascade', 'Delete all dependent tasks (tasks that this task blocks)')
  .option('--force', 'Skip confirmation prompt')
  .addHelpText('after', `
Deletion Modes:

  Default (simple delete):
    Removes the task and its edges.
    Dependent tasks have this task removed from their blockers.
    Status of dependent tasks is recalculated.

  --reconnect (splice into chain):
    Before: A → B → C (A blocks B, B blocks C)
    After:  A → C     (A blocks C directly)
    Useful when removing an intermediate task in a chain.

  --cascade (delete dependents):
    Deletes this task AND all tasks that depend on it.
    Warning: Can delete many tasks at once!

Task ID:
  Supports full UUID or first 7-8 characters (short UUID).

Confirmation:
  Prompts for confirmation unless --force is used.
  Shows impact (how many tasks are affected) before deletion.

Examples:
  $ octie delete abc12345              Delete task with confirmation
  $ octie delete abc12345 --force      Delete without confirmation
  $ octie delete abc12345 --reconnect  Reconnect chain after deletion
  $ octie delete abc12345 --cascade    Delete task and all dependents
`)
  .action(async (id, options, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      // Support short UUID prefix lookup
      const task = graph.getNodeByIdOrPrefix(id);
      if (!task) {
        error(`Task not found: ${id}`);
        process.exit(1);
      }

      // Use the full ID for all subsequent operations
      const fullId = task.id;

      // Show impact
      const dependents = graph.getOutgoingEdges(fullId);
      const blockers = graph.getIncomingEdges(fullId);

      console.log('');
      console.log(chalk.bold('Task to delete:'));
      console.log(`  ${chalk.cyan(fullId.substring(0, 8))} - ${task.title}`);
      console.log('');

      if (dependents.length > 0) {
        warning(`This task is blocking ${dependents.length} other task(s):`);
        for (const depId of dependents) {
          const depTask = graph.getNode(depId);
          if (depTask) {
            console.log(`  - ${chalk.cyan(depId.substring(0, 8))} - ${depTask.title}`);
          }
        }
        console.log('');
      }

      if (blockers.length > 0) {
        info(`This task is blocked by ${blockers.length} task(s):`);
        for (const blockerId of blockers) {
          const blockerTask = graph.getNode(blockerId);
          if (blockerTask) {
            console.log(`  - ${chalk.cyan(blockerId.substring(0, 8))} - ${blockerTask.title}`);
          }
        }
        console.log('');
      }

      // Confirm deletion
      if (!options.force) {
        console.log(chalk.gray('(Use --force to skip confirmation)'));
        const confirmed = await confirmPrompt(chalk.yellow('Delete this task? (y/N)'));
        if (!confirmed) {
          info('Deletion cancelled');
          process.exit(0);
        }
      }

      // Create backup before deletion
      warning('Creating backup before deletion...');
      // Backup is automatic on save

      // Perform deletion
      if (options.reconnect) {
        info('Reconnecting edges...');
        const affectedTaskIds = cutNode(graph, fullId);
        for (const affectedId of affectedTaskIds) {
          graph.propagateStatus(affectedId);
        }
      } else if (options.cascade) {
        info('Cascading deletion to dependents...');
        const deletedIds = cascadeDelete(graph, fullId);

        // Save
        await saveGraph(projectPath, graph);

        // Update registry task count
        touchProject(projectPath);

        // Invalidate server graph cache via HTTP
        try {
          const serverUrl = process.env.OCTIE_SERVER_URL || 'http://localhost:3030';
          await fetch(`${serverUrl}/api/cache/invalidate?project=${encodeURIComponent(projectPath)}`, { method: 'POST' });
        } catch { /* ignore */ }

        success(`Deleted ${deletedIds.length} task(s): ${deletedIds.map(id => id.substring(0, 8)).join(', ')}`);
        process.exit(0);
      } else {
        // Simple removal - clean up blocker references from dependent tasks
        // Get tasks that this task is blocking (outgoing edges)
        const dependentTasks = graph.getOutgoingEdges(fullId);
        const affectedTaskIds: string[] = [];

        for (const depId of dependentTasks) {
          const depTask = graph.getNode(depId);
          if (depTask && depTask.blockers.includes(fullId)) {
            depTask.removeBlocker(fullId);
            affectedTaskIds.push(depId);
          }
        }

        // Remove the node (this also removes graph edges)
        graph.removeNode(fullId);

        // Propagate status changes from all affected tasks
        // This handles the case where removing a blocker unblocks children
        for (const affectedId of affectedTaskIds) {
          graph.propagateStatus(affectedId);
        }
      }

      // Save
      await saveGraph(projectPath, graph);

      // Update registry task count
      touchProject(projectPath);

      // Invalidate server graph cache via HTTP
      try {
        const serverUrl = process.env.OCTIE_SERVER_URL || 'http://localhost:3030';
        await fetch(`${serverUrl}/api/cache/invalidate?project=${encodeURIComponent(projectPath)}`, { method: 'POST' });
      } catch { /* ignore */ }

      success(`Task deleted: ${chalk.cyan(fullId.substring(0, 8))}`);

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to delete task');
      }
      process.exit(1);
    }
  });
