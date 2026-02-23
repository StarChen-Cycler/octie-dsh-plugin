/**
 * Graph command - Graph analysis and validation operations
 */

import { Command } from 'commander';
import { getProjectPath, loadGraph, saveGraph, success, error, info } from '../utils/helpers.js';
import chalk from 'chalk';
import { detectCycle, validateReferences } from '../../core/graph/cycle.js';
import { topologicalSort } from '../../core/graph/sort.js';
import { getConnectedComponents } from '../../core/graph/traversal.js';

/**
 * Create the graph command
 */
export const graphCommand = new Command('graph')
  .description('Graph analysis and validation operations')
  .addHelpText('after', `
Subcommands:
  validate    Check graph integrity (cycles, orphan references)
  cycles      Detect and display all cycles in the graph

Examples:
  $ octie graph                    Show graph statistics
  $ octie graph validate           Validate graph has no cycles or broken refs
  $ octie graph cycles             Show all cycles with task titles
`)
  .action(async (_options, command) => {
    try {
      // Get global options - traverse up to main program
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      console.log('');
      console.log(chalk.bold('Graph Statistics:'));
      console.log('');

      const totalTasks = graph.size;
      const rootTasks = graph.getRootTasks();
      const orphanTasks = graph.getOrphanTasks();

      console.log(`Total tasks: ${totalTasks}`);
      console.log(`Root tasks: ${rootTasks.length}`);
      console.log(`Orphan tasks: ${orphanTasks.length}`);
      console.log('');

      // Check for cycles
      const cycleResult = detectCycle(graph);
      if (cycleResult.hasCycle) {
        console.error(chalk.red(`⚠️  Graph contains ${cycleResult.cycles.length} cycle(s)!`));
        for (const cycle of cycleResult.cycles) {
          console.error(chalk.red(`  Cycle: ${cycle.join(' → ')}`));
        }
      } else {
        success('Graph is acyclic (valid DAG)');
      }

      // Topological sort
      const sortResult = topologicalSort(graph);
      if (sortResult.hasCycle) {
        console.error(chalk.red(`⚠️  Topological sort failed: cycle detected`));
      } else {
        console.log(chalk.green(`✓ Topological sort: ${sortResult.sorted.length} tasks ordered`));
      }

      // Connected components
      const components = getConnectedComponents(graph);
      console.log(`Connected components: ${components.length}`);

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to analyze graph');
      }
      process.exit(1);
    }
  });

// Add subcommands
graphCommand
  .command('validate')
  .description('Validate graph structure (checks for cycles and orphan references)')
  .option('--fix', 'Automatically fix invalid blocker references by removing them')
  .addHelpText('after', `
Validation Checks:
  1. Cycle Detection - Ensures graph is a valid DAG (no circular dependencies)
  2. Reference Integrity - Ensures all blocker references point to existing tasks

Exit Codes:
  0 - Graph is valid
  1 - Validation failed (cycles or broken references found)

Example:
  $ octie graph validate
  ✓ Graph validation passed: No cycles detected, all blocker references valid
  $ octie graph validate --fix
  ✓ Removed 3 invalid blocker references, graph is now valid
`)
  .action(async (options, command) => {
    try {
      // Get global options - traverse up to main program (parent.parent)
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      // Check for cycles
      const cycleResult = detectCycle(graph);

      if (cycleResult.hasCycle) {
        console.error(chalk.red(`Graph validation failed: ${cycleResult.cycles.length} cycle(s) detected`));
        process.exit(1);
      }

      // Check for missing blocker references
      const refResult = validateReferences(graph);

      if (refResult.hasInvalidReferences) {
        // If --fix is provided, automatically remove invalid blockers
        if (options.fix) {
          let fixedCount = 0;
          for (const ref of refResult.invalidReferences) {
            const task = graph.getNode(ref.taskId);
            if (task && task.blockers.includes(ref.invalidBlockerId)) {
              task.removeBlocker(ref.invalidBlockerId);
              graph.updateNode(task);
              fixedCount++;
            }
          }
          // Save the graph after fixing
          await saveGraph(projectPath, graph);
          success(`Removed ${fixedCount} invalid blocker reference(s), graph is now valid`);
          process.exit(0);
        }

        // Without --fix, show errors and exit
        console.error(chalk.red(`Graph validation failed: ${refResult.invalidReferences.length} missing blocker reference(s)`));
        for (const ref of refResult.invalidReferences) {
          console.error(chalk.red(`  Task ${ref.taskId.substring(0, 8)} references non-existent blocker: ${ref.invalidBlockerId.substring(0, 8)}`));
        }
        console.log('');
        info('Run with --fix to automatically remove invalid blockers');
        process.exit(1);
      }

      success('Graph validation passed: No cycles detected, all blocker references valid');
      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Validation failed');
      }
      process.exit(1);
    }
  });

graphCommand
  .command('cycles')
  .description('Detect and display cycles in the graph')
  .addHelpText('after', `
Output Format:
  Each cycle is shown as a chain of task IDs with task titles:

  ⚠️  Found 2 cycle(s):

  1. abc12345 → def67890 → abc12345
     - Task A title
     - Task B title
     - Task A title

  2. xyz11111 → yyy22222 → zzz33333 → xyz11111
     - Task X title
     - Task Y title
     - Task Z title
     - Task X title

Exit Codes:
  0 - No cycles found
  1 - Cycles detected

How to Fix:
  Use 'octie update <id> --unblock <blocker-id>' to break the cycle.

Example:
  $ octie graph cycles
  ⚠️  Found 1 cycle(s):
  1. abc12345 → def67890 → abc12345
`)
  .action(async (_options, command) => {
    try {
      // Get global options - traverse up to main program (parent.parent)
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      const result = detectCycle(graph);

      if (result.hasCycle) {
        console.log('');
        console.error(chalk.red.bold(`⚠️  Found ${result.cycles.length} cycle(s):`));
        console.log('');

        for (let i = 0; i < result.cycles.length; i++) {
          const cycle = result.cycles[i];
          if (cycle) {
            console.error(chalk.red(`${i + 1}. ${cycle.join(' → ')}`));

            // Show task titles
            for (const taskId of cycle) {
              const task = graph.getNode(taskId);
              if (task) {
                console.error(chalk.gray(`   - ${task.title}`));
              }
            }
            console.log('');
          }
        }

        process.exit(1);
      } else {
        success('No cycles detected in graph');
        process.exit(0);
      }
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Cycle detection failed');
      }
      process.exit(1);
    }
  });
