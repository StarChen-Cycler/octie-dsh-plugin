/**
 * Init command - Initialize a new Octie project
 */

import { Command } from 'commander';
import path from 'node:path';
import { TaskStorage } from '../../core/storage/file-store.js';
import { loadRegistry, registerProject } from '../../core/registry/index.js';
import { success, error, info } from '../utils/helpers.js';
import chalk from 'chalk';

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

      // Validate project name is provided
      const projectName = options.name?.trim();
      if (!projectName) {
        error('Project name is required. Use --name <name> to specify a unique project name.');
        info('Example: octie init --name my-project');
        process.exit(1);
      }

      // Check global registry for duplicate name
      const registry = loadRegistry();
      const existing = Object.values(registry.projects).find(
        project => project.name === projectName
      );
      if (existing) {
        error(`Project with name '${projectName}' already exists.`);
        info(`Existing project: ${existing.path}`);
        info('Choose a different name using --name <different-name>');
        process.exit(1);
      }

      info(`Initializing Octie project at ${projectPath}`);

      // Create storage instance
      const storage = new TaskStorage({ projectDir: projectPath });

      // Check if project already exists
      if (await storage.exists()) {
        error('Octie project already exists at this location');
        info('Use --project <path> to specify a different location');
        process.exit(1);
      }

      // Create project
      await storage.createProject(projectName);

      // Register in global registry
      registerProject(projectPath);

      success(`Octie project initialized`);
      info(`Project: ${projectName}`);
      info(`Location: ${projectPath}`);
      info(`Registered in global registry`);

      console.log('');
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  octie create --title "My first task" \\'));
      console.log(chalk.gray('    --description "Task description" \\'));
      console.log(chalk.gray('    --success-criterion "Criterion 1" \\'));
      console.log(chalk.gray('    --deliverable "Output 1"'));

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to initialize project');
      }
      process.exit(1);
    }
  });
