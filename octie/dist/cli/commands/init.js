/**
 * Init command - Initialize a new Octie project
 */
import { Command } from 'commander';
import path from 'node:path';
import { success, error, info } from '../utils/helpers.js';
import chalk from 'chalk';
import { CliPreparationError, executeProjectInit, preflightProjectInit, } from './shared-helpers.js';
/**
 * Create the init command
 */
export const initCommand = new Command('init')
    .description('Initialize a new Octie project (requires unique project name)')
    .option('-n, --name <name>', 'Project name (required, must be unique)')
    .action(async (options, command) => {
    try {
        // Get project path from parent's options (global --project option)
        const projectOption = command.parent?.opts().project;
        const projectPath = path.resolve(projectOption || process.cwd());
        const validated = await preflightProjectInit(projectPath, options);
        info(`Initializing Octie project at ${projectPath}`);
        await executeProjectInit(validated);
        success(`Octie project initialized`);
        info(`Project: ${validated.projectName}`);
        info(`Location: ${projectPath}`);
        info(`Registered in global registry`);
        console.log('');
        console.log(chalk.gray('Next steps:'));
        console.log(chalk.gray('  octie create --title "My first task" \\'));
        console.log(chalk.gray('    --description "Task description" \\'));
        console.log(chalk.gray('    --success-criterion "Criterion 1" \\'));
        console.log(chalk.gray('    --deliverable "Output 1"'));
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
        if (err instanceof Error) {
            error(err.message);
        }
        else {
            error('Failed to initialize project');
        }
        process.exit(1);
    }
});
//# sourceMappingURL=init.js.map