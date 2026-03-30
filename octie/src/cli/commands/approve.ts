/**
 * Approve Command
 *
 * Manually approve a task that is in review.
 * This is the ONLY manual status transition in the new system:
 * in_review → completed
 *
 * @module cli/commands/approve
 */

import { Command } from 'commander';
import { ValidationError } from '../../types/index.js';
import { getProjectPath, loadGraph, saveGraph } from '../utils/helpers.js';
import chalk from 'chalk';

/**
 * Approve a task in review
 *
 * This command transitions a task from 'in_review' to 'completed' status.
 * This is the ONLY manual status transition in the new automatic status system.
 *
 * @param taskId - Task ID or prefix to approve
 * @param options - Command options
 */
export async function approveCommand(
  taskId: string,
  options: { project?: string }
): Promise<void> {
  try {
    // Find project path
    const projectPath = await getProjectPath(options.project);

    // Load the graph
    const graph = await loadGraph(projectPath);

    // Find the task by ID or prefix
    const task = graph.getNodeByIdOrPrefix(taskId);
    if (!task) {
      console.error(chalk.red(`Error: Task with ID '${taskId}' not found.`));
      process.exit(1);
    }

    // Check if task is in review status
    if (task.status !== 'in_review') {
      console.error(
        chalk.red(`Error: Cannot approve task in '${task.status}' status.`)
      );
      console.error(
        chalk.yellow('Task must be in \'in_review\' status to be approved.')
      );
      console.error(
        chalk.gray(
          'Tip: Complete all success criteria, deliverables, and need_fix items to transition to in_review.'
        )
      );
      process.exit(1);
    }

    // Approve the task
    task.approve();

    // Propagate status changes through the graph starting from this task
    // This updates the starting node (if needed) and all descendants
    const propagateResult = graph.propagateStatus(task.id);
    const updatedTaskIds = propagateResult.updatedTasks;

    // Save the graph
    await saveGraph(projectPath, graph);

    // Output success message
    console.log(chalk.green(`✓ Task approved: ${task.id}`));
    console.log(chalk.gray(`  Title: ${task.title}`));
    console.log(chalk.gray(`  Status: ${task.status}`));
    if (task.completed_at) {
      console.log(chalk.gray(`  Completed: ${task.completed_at}`));
    }

    // Report if any dependent tasks were unblocked
    if (updatedTaskIds.length > 0) {
      console.log(chalk.cyan(`  Unblocked tasks: ${updatedTaskIds.length}`));
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(chalk.red(`Validation Error: ${error.message}`));
      if (error.suggestion) {
        console.error(chalk.yellow(`Suggestion: ${error.suggestion}`));
      }
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Register the approve command with the CLI
 */
export function registerApproveCommand(program: Command): void {
  program
    .command('approve')
    .description(
      'Approve a task in review (in_review → completed). This is the only manual status transition.'
    )
    .argument('<task-id>', 'Task ID (full UUID or first 7-8 characters)')
    .option('-p, --project <path>', 'Project directory path')
    .addHelpText('after', `
Status System:
  This is the ONLY manual status transition in the automatic status system.
  All other status transitions happen automatically based on task state.

  Automatic Transitions:
    ready → in_progress      When any criterion/deliverable is checked
    in_progress → in_review  When all items are complete
    any → blocked            When a blocker is added
    blocked → in_progress    When all blockers completed AND items already checked
    blocked → ready          When all blockers completed AND no items checked yet

  Manual Transition (this command):
    in_review → completed    Approve after review

  Note: blocked → in_progress (not ready) when items are already checked.
  This preserves work state and is the intended behavior.

Prerequisites for Approval:
  • Task must be in 'in_review' status
  • All success criteria must be complete
  • All deliverables must be complete
  • All need_fix items must be resolved

Side Effects:
  • Status propagates through the dependency graph starting from this task
  • Children of completed tasks calculate status from their own items
  • Parent not completed → child is blocked (regardless of child's items)

Examples:
  $ octie approve abc12345
  $ octie approve abc12345 --project /path/to/project

Error Cases:
  • Task not found → Error
  • Task not in 'in_review' status → Error with guidance
`)
    .action(async (taskId, options, command) => {
      const globalOpts = command.parent?.opts() || {};
      await approveCommand(taskId, {
        project: options.project ?? globalOpts.project,
      });
    });
}
