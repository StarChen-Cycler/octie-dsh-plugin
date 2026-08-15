#!/usr/bin/env node
/**
 * Octie CLI - Graph-based task management system
 * Main entry point for all CLI commands
 */
import { createRequire } from 'node:module';
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
import { getGuideFlagsHelpText, tryHandleGuideFlags, } from './commands/guides.js';
import { handoffCommand } from './commands/handoff.js';
import { panelCommand } from './commands/panel.js';
import { configCommand } from './commands/config.js';
import { registryCommand } from './commands/registry.js';
import { registerApproveCommand } from './commands/approve.js';
import { formatError } from './utils/helpers.js';
import { extractProjectPathFromArgs, verifyAndRegisterProject, } from '../core/registry/root-guard.js';
const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');
/**
 * Global error handler
 * Provides consistent error formatting with suggestions and optional stack traces
 */
function handleError(error) {
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
function createProgram() {
    const program = new Command();
    program
        .name('octie')
        .description('Graph-based task management system')
        .version(VERSION, '-v, --version', 'Display version number')
        .configureOutput({
        writeErr: (str) => process.stderr.write(str),
        writeOut: (str) => process.stdout.write(str),
    });
    program.addHelpText('beforeAll', '\n' +
        '   ═══════════════════════════════════════════════════\n' +
        '   Welcome to Octie — State-oriented Agent Task mgmt System!!!\n' +
        '   ═══════════════════════════════════════════════════\n' +
        '                              \n' +
        '             rMMs             \n' +
        '        ::,;is22si;,::        \n' +
        '       iHH5,      ,2MMi       \n' +
        '        rX          Xr        \n' +
        '        :i          i:        \n' +
        '       ;55s        s55;       \n' +
        '       ,rri;:,;;,:;irr,       \n' +
        '            .s33X.            \n' +
        '              ,,              \n' +
        '                              \n');
    // Global options
    program
        .option('--project <path>', 'Path to Octie project directory')
        .option('--format <format>', 'Output format: json, md, table (overrides .octie/config.json format; default: table)', 'table')
        .option('--verbose', 'Enable verbose output')
        .option('--quiet', 'Suppress non-error output')
        .configureHelp({
        sortSubcommands: true,
        showGlobalOptions: true,
    });
    program.addHelpText('after', getGuideFlagsHelpText());
    // Error handling
    program.exitOverride(handleError);
    return program;
}
/**
 * Main entry point
 */
function main() {
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
    program.addCommand(panelCommand);
    program.addCommand(configCommand);
    program.addCommand(registryCommand);
    registerApproveCommand(program);
    // Parse arguments
    program.parse(process.argv);
}
// Run CLI
main();
//# sourceMappingURL=index.js.map