/**
 * Wire command - Insert an existing task between two connected tasks
 *
 * Before: A → C (A blocks C)
 * After:  A → B → C (A blocks B, B blocks C)
 *
 * The engine lives in the service layer (`wireTask`); this command keeps
 * only UX: validation error branches, output, exit codes.
 */
import { Command } from 'commander';
import { getProjectPath, success, error, info } from '../utils/helpers.js';
import { CliPreparationError, wireTask } from '../../service/index.js';
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
        const result = await wireTask(projectPath, taskId, {
            after: options.after,
            before: options.before,
            depOnAfter: options.depOnAfter,
            depOnBefore: options.depOnBefore,
        });
        const aId = result.before[0];
        const bId = result.taskId;
        const cId = result.before[1];
        // Success message
        success(`Wired ${chalk.cyan(bId)} between ${chalk.cyan(aId)} and ${chalk.cyan(cId)}`);
        console.log('');
        console.log(chalk.gray('  Before: ') + `${chalk.cyan(aId)} → ${chalk.cyan(cId)}`);
        console.log(chalk.gray('  After:  ') + `${chalk.cyan(aId)} → ${chalk.cyan(bId)} → ${chalk.cyan(cId)}`);
        console.log('');
        console.log(chalk.gray('Task ') + chalk.cyan(bId) + chalk.gray(' now blocks on ') + chalk.cyan(aId));
        console.log(chalk.gray('Task ') + chalk.cyan(cId) + chalk.gray(' now blocks on ') + chalk.cyan(bId));
        process.exit(0);
    }
    catch (err) {
        if (err instanceof Error) {
            error(err.message);
        }
        else {
            error('Failed to wire task');
        }
        if (err instanceof CliPreparationError) {
            for (const message of err.infoMessages) {
                info(message);
            }
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
//# sourceMappingURL=wire.js.map