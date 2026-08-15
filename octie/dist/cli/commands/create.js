/**
 * Create command - Create a new task with atomic task validation
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { AtomicTaskViolationError } from '../../types/index.js';
import { getProjectPath, loadGraph, success, error, info } from '../utils/helpers.js';
import { CliPreparationError, addTaskCreationOptions, displayAtomicTaskPolicy, executeTaskCreation, preflightTaskCreation, } from './shared-helpers.js';
/**
 * Create the create command
 */
export const createCommand = addTaskCreationOptions(new Command('create').description('Create a new atomic task in the project'))
    .action(async (options, command) => {
    try {
        if (process.argv.includes('--help') || process.argv.includes('-h')) {
            displayAtomicTaskPolicy();
            return;
        }
        const globalOpts = command.parent?.opts() || {};
        const projectPath = await getProjectPath(options.project || globalOpts.project);
        const graph = await loadGraph(projectPath);
        const prepared = preflightTaskCreation(graph, options);
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
    }
    catch (err) {
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
                    console.log(chalk.red('  ✗ ') + violation);
                }
                console.log('');
                info("Run 'octie create -h' to see the full atomic task policy.");
            }
            process.exit(1);
        }
        if (err instanceof Error) {
            error(err.message);
            if (err.message.includes('atomic') || err.message.includes('vague')) {
                console.log('');
                info("Run 'octie create -h' to see the full atomic task policy.");
            }
        }
        else {
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
    console.log(chalk.cyan('  --dependency-explanation (-d)') + ': Explanatory text WHY this task depends on its blockers.');
    console.log('                  REQUIRED when --blockers is set (twin validation).');
    console.log('                  Alias: --dependencies');
    console.log('                  Does NOT affect execution order - pure metadata.');
    console.log('');
    console.log(chalk.yellow('  Example (both required together):'));
    console.log('    octie create --title "Build Frontend" \\');
    console.log('      --blockers abc123,def456 \\');
    console.log('      --dependency-explanation "Needs API spec from abc123 and auth from def456"');
    console.log('');
    console.log(chalk.red('  Error if only one provided:'));
    console.log('    --blockers without --dependency-explanation → Error: twin required');
    console.log('    --dependency-explanation without --blockers → Error: twin required');
});
//# sourceMappingURL=create.js.map