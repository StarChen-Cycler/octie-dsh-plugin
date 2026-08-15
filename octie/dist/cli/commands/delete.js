/**
 * Delete command - Delete a task from the graph
 *
 * The engine lives in the service layer (`deletePreview` + `deleteTask`);
 * this command keeps only UX: impact display, confirmation, output.
 */
import { Command } from 'commander';
import { getProjectPath, success, error, info, warning, confirmPrompt } from '../utils/helpers.js';
import { deletePreview, deleteTask } from '../../service/index.js';
import chalk from 'chalk';
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
        const preview = await deletePreview(projectPath, id);
        const fullId = preview.task.id;
        // Show impact
        console.log('');
        console.log(chalk.bold('Task to delete:'));
        console.log(`  ${chalk.cyan(fullId.substring(0, 8))} - ${preview.task.title}`);
        console.log('');
        if (preview.dependents.length > 0) {
            warning(`This task is blocking ${preview.dependents.length} other task(s):`);
            for (const dep of preview.dependents) {
                console.log(`  - ${chalk.cyan(dep.id.substring(0, 8))} - ${dep.title}`);
            }
            console.log('');
        }
        if (preview.blockers.length > 0) {
            info(`This task is blocked by ${preview.blockers.length} task(s):`);
            for (const blocker of preview.blockers) {
                console.log(`  - ${chalk.cyan(blocker.id.substring(0, 8))} - ${blocker.title}`);
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
        const mode = options.reconnect ? 'reconnect' : options.cascade ? 'cascade' : 'simple';
        if (mode === 'reconnect') {
            info('Reconnecting edges...');
        }
        else if (mode === 'cascade') {
            info('Cascading deletion to dependents...');
        }
        // Perform deletion (backup + atomic save inside the engine)
        const result = await deleteTask(projectPath, id, mode);
        if (mode === 'cascade') {
            success(`Deleted ${result.deletedIds.length} task(s): ${result.deletedIds.map(d => d.substring(0, 8)).join(', ')}`);
            process.exit(0);
        }
        success(`Task deleted: ${chalk.cyan(result.deletedIds[0].substring(0, 8))}`);
        process.exit(0);
    }
    catch (err) {
        if (err instanceof Error) {
            error(err.message);
        }
        else {
            error('Failed to delete task');
        }
        process.exit(1);
    }
});
//# sourceMappingURL=delete.js.map