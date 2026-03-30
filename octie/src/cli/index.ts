#!/usr/bin/env node

/**
 * Octie CLI - Graph-based task management system
 * Main entry point for all CLI commands
 */

import { Command, CommanderError } from 'commander';
import { initCommand } from './commands/init.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { getCommand } from './commands/get.js';
import { updateCommand } from './commands/update.js';
import { deleteCommand } from './commands/delete.js';
import { mergeCommand } from './commands/merge.js';
import { graphCommand } from './commands/graph.js';
import { historyCommand } from './commands/history.js';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';
import { serveCommand } from './commands/serve.js';
import { findCommand } from './commands/find.js';
import { wireCommand } from './commands/wire.js';
import {
  CREATE_SUBTASK_HANDOFF_GUIDE_FLAG,
  handoffCommand,
  tryHandleGuideFlags,
} from './commands/handoff.js';
import { registerApproveCommand } from './commands/approve.js';
// import { batchCommand } from './commands/batch.js';
import { formatError } from './utils/helpers.js';
import {
  extractProjectPathFromArgs,
  verifyAndRegisterProject,
} from '../core/registry/root-guard.js';

// Version from package.json
const VERSION = '1.0.0';

/**
 * Global error handler
 * Provides consistent error formatting with suggestions and optional stack traces
 */
function handleError(error: unknown): never {
  const verbose = process.env.DEBUG === 'true' || process.env.VERBOSE === 'true';

  // Handle Commander's normal exits (--help, --version) - exit cleanly
  if (error instanceof CommanderError) {
    // Commander has already output the error via writeErr, just exit
    process.exit(error.exitCode);
  }

  // Handle all other errors with our formatter
  console.error(formatError(error, verbose));
  process.exit(1);
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('octie')
    .description('Graph-based task management system')
    .version(VERSION, '-v, --version', 'Display version number')
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
      writeOut: (str) => process.stdout.write(str),
    });

  // Global options
  program
    .option('-p, --project <path>', 'Path to Octie project directory')
    .option('--format <format>', 'Output format: json, md, table', 'table')
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-error output')
    .configureHelp({
      sortSubcommands: true,
      showGlobalOptions: true,
    });

  program.addHelpText(
    'after',
    `
Guide Flags:
  ${CREATE_SUBTASK_HANDOFF_GUIDE_FLAG}  Print the loose subproject handoff playbook
`,
  );

  // Error handling
  program.exitOverride(handleError);

  return program;
}

/**
 * Main entry point
 */
function main(): void {
  const rawArgs = process.argv.slice(2);
  if (tryHandleGuideFlags(rawArgs)) {
    return;
  }

  // Run root guard before Commander parses args, but respect explicit --project.
  const explicitProjectPath = extractProjectPathFromArgs(rawArgs);
  verifyAndRegisterProject(explicitProjectPath);

  const program = createProgram();

  // Register commands
  program.addCommand(initCommand);
  program.addCommand(createCommand);
  program.addCommand(listCommand);
  program.addCommand(getCommand);
  program.addCommand(updateCommand);
  program.addCommand(deleteCommand);
  program.addCommand(mergeCommand);
  program.addCommand(graphCommand);
  program.addCommand(historyCommand);
  program.addCommand(exportCommand);
  program.addCommand(importCommand);
  program.addCommand(serveCommand);
  program.addCommand(findCommand);
  program.addCommand(wireCommand);
  program.addCommand(handoffCommand);
  registerApproveCommand(program);
  // program.addCommand(batchCommand);

  // Parse arguments
  program.parse(process.argv);

  // Show help if no command provided
  // if (!process.argv.slice(2).length) {
  //   program.outputHelp();
  // }
}

// Run CLI
main();
