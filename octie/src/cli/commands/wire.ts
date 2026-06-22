/**
 * Wire command - Insert an existing task between two connected tasks
 *
 * This command wires an existing task (B) into a blocker chain:
 * Before: A → C (A blocks C)
 * After:  A → B → C (A blocks B, B blocks C)
 *
 * It uses the existing blocker manipulation patterns and twin validation system.
 */

import { Command } from 'commander';
import { getProjectPath, loadGraph, saveGraph, success, error, info } from '../utils/helpers.js';
import { invalidateProjectCache } from './shared-helpers.js';
import chalk from 'chalk';

/**
 * Create the wire command
 */
export const wireCommand = new Command('wire')
  .description('Insert an existing task between two connected tasks on a blocker chain')
  .argument('<task-id>', 'Task ID to insert (full UUID or first 7-8 characters)')
  .requiredOption('--after <id>', 'Source task ID - will become the inserted task\'s blocker')
  .requiredOption('--before <id>', 'Target task ID - will block on the inserted task instead')
  .requiredOption('--dep-on-after <text>', 'Why the inserted task depends on the --after task (twin validation)')
  .requiredOption('--dep-on-before <text>', 'Why the --before task depends on the inserted task')
  .action(async (taskId, options, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      // Resolve task IDs (support short UUIDs)
      const taskB = graph.getNodeByIdOrPrefix(taskId);
      if (!taskB) {
        error(`Task not found: ${taskId}`);
        process.exit(1);
      }

      const taskA = graph.getNodeByIdOrPrefix(options.after);
      if (!taskA) {
        error(`--after task not found: ${options.after}`);
        process.exit(1);
      }

      const taskC = graph.getNodeByIdOrPrefix(options.before);
      if (!taskC) {
        error(`--before task not found: ${options.before}`);
        process.exit(1);
      }

      // Use resolved full IDs
      const bId = taskB.id;
      const aId = taskA.id;
      const cId = taskC.id;

      // Validation 1: B cannot be the same as A or C
      if (bId === aId) {
        error('Cannot wire a task after itself.');
        process.exit(1);
      }
      if (bId === cId) {
        error('Cannot wire a task before itself.');
        process.exit(1);
      }

      // Validation 2: A and C must be different
      if (aId === cId) {
        error('--after and --before must be different tasks.');
        process.exit(1);
      }

      // Validation 3: Edge A→C must exist
      if (!graph.hasEdge(aId, cId)) {
        error(`No edge exists from ${chalk.cyan(aId)} to ${chalk.cyan(cId)}.`);
        info('The --after and --before tasks must already be connected.');
        info(`Use 'octie list --graph' to view current task relationships.`);
        process.exit(1);
      }

      // Validation 4: C must have A as a blocker
      if (!taskC.blockers.includes(aId)) {
        error(`${chalk.cyan(cId)} is not blocked by ${chalk.cyan(aId)}.`);
        info('The --before task must have --after as a blocker.');
        process.exit(1);
      }

      // Validation 5: B should not already block C (would create duplicate edge)
      if (graph.hasEdge(bId, cId)) {
        error(`${chalk.cyan(bId)} already blocks ${chalk.cyan(cId)}.`);
        info('Cannot create a duplicate edge.');
        process.exit(1);
      }

      // Validation 6: A should not already block B (would create duplicate edge)
      if (graph.hasEdge(aId, bId)) {
        error(`${chalk.cyan(aId)} already blocks ${chalk.cyan(bId)}.`);
        info('Cannot create a duplicate edge.');
        process.exit(1);
      }

      // === WIRING OPERATION ===

      // Step 1: Add A as blocker to B (with twin: dependencies)
      taskB.addBlocker(aId);
      graph.addEdge(aId, bId);
      const existingDepsB = taskB.dependencies || '';
      taskB.setDependencies(existingDepsB
        ? `${existingDepsB}\n${options.depOnAfter}`
        : options.depOnAfter);

      // Step 2: Transfer C's blocker from A to B
      // First, remove A from C's blockers and remove edge A→C
      taskC.removeBlocker(aId);
      graph.removeEdge(aId, cId);

      // Then, add B as blocker to C and add edge B→C
      taskC.addBlocker(bId);
      graph.addEdge(bId, cId);

      // Replace C's dependencies with the new explanation for B
      // (since the dependency on A is replaced with dependency on B)
      taskC.setDependencies(options.depOnBefore);

      // Step 3: Update nodes in graph
      graph.updateNode(taskB);
      graph.updateNode(taskC);

      // Step 4: Propagate status changes from both affected tasks
      // Task B may become blocked or ready based on A's status
      graph.propagateStatus(taskB.id);
      // Task C's status depends on B's new status
      graph.propagateStatus(taskC.id);

      // Step 5: Save
      await saveGraph(projectPath, graph);
      await invalidateProjectCache(projectPath);

      // Success message
      success(`Wired ${chalk.cyan(bId)} between ${chalk.cyan(aId)} and ${chalk.cyan(cId)}`);
      console.log('');
      console.log(chalk.gray('  Before: ') + `${chalk.cyan(aId)} → ${chalk.cyan(cId)}`);
      console.log(chalk.gray('  After:  ') + `${chalk.cyan(aId)} → ${chalk.cyan(bId)} → ${chalk.cyan(cId)}`);
      console.log('');
      console.log(chalk.gray('Task ') + chalk.cyan(bId) + chalk.gray(' now blocks on ') + chalk.cyan(aId));
      console.log(chalk.gray('Task ') + chalk.cyan(cId) + chalk.gray(' now blocks on ') + chalk.cyan(bId));

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to wire task');
      }
      process.exit(1);
    }
  });

// Add help text
wireCommand.on('--help', () => {
  console.log('');
  console.log(chalk.bold('Description:'));
  console.log('  Insert an existing task into a blocker chain between two connected tasks.');
  console.log('  This operation uses the twin validation system (blockers + dependencies).');
  console.log('');
  console.log(chalk.bold('Workflow:'));
  console.log('  1. Create the intermediate task first (using octie create)');
  console.log('  2. Wire it into the chain using this command');
  console.log('');
  console.log(chalk.bold('Visual Example:'));
  console.log('  ' + chalk.gray('Before:') + ' A → C (A blocks C)');
  console.log('  ' + chalk.gray('After:') + '  A → B → C (A blocks B, B blocks C)');
  console.log('');
  console.log(chalk.bold('Twin Validation (Required):'));
  console.log(chalk.cyan('  --dep-on-after') + '  Why B depends on A (sets B.dependencies)');
  console.log(chalk.cyan('  --dep-on-before') + ' Why C depends on B (replaces C\'s old dependency on A)');
  console.log('');
  console.log(chalk.yellow('  Example:'));
  console.log('    octie create --title "Review API spec" # Creates task xyz789');
  console.log('    octie wire xyz789 \\');
  console.log('      --after abc123 \\');
  console.log('      --before def456 \\');
  console.log('      --dep-on-after "Needs API spec to create models" \\');
  console.log('      --dep-on-before "Frontend needs TypeScript models"');
  console.log('');
  console.log(chalk.red('  Validation Errors:'));
  console.log('    - Edge A→C doesn\'t exist → Error (tasks must be connected)');
  console.log('    - C doesn\'t have A as blocker → Error (invalid chain)');
  console.log('    - B already blocks C → Error (duplicate edge)');
  console.log('    - Missing --dep-on-* options → Error (twin validation)');
});
