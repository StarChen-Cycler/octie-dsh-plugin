/**
 * Export command - Export project data
 */

import { Command } from 'commander';
import { getProjectPath, loadGraph, success, error } from '../utils/helpers.js';
import { formatProjectMarkdown } from '../output/markdown.js';
import { formatProjectJSON } from '../output/json.js';
import chalk from 'chalk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function ensureExportDir(outputPath: string): void {
  if (process.env.OCTIE_TEST_FORCE_EXPORT_MKDIR_FAILURE === '1') {
    throw new Error('Injected export mkdir failure');
  }

  mkdirSync(dirname(outputPath), { recursive: true });
}

/**
 * Create the export command
 */
export const exportCommand = new Command('export')
  .description('Export project data to file')
  .option('-t, --type <format>', 'Export format: json, md (default: "json")')
  .option('-o, --output <path>', 'Output file path')
  .addHelpText('after', `
Examples:
  $ octie export -o backup.json
  $ octie export --type md -o tasks.md

Default: Writes to tasks.json (or tasks.md) if no -o specified
`)
  .action(async (options, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      let output: string;
      let defaultFileName: string;

      switch (options.type) {
        case 'md':
          output = formatProjectMarkdown(graph);
          defaultFileName = 'tasks.md';
          break;

        default:
          output = formatProjectJSON(graph);
          defaultFileName = 'tasks.json';
          break;
      }

      // Write to file
      const outputPath = options.output || defaultFileName;

      // Create parent directory if it doesn't exist
      ensureExportDir(outputPath);

      writeFileSync(outputPath, output, 'utf-8');

      success(`Exported to ${chalk.cyan(outputPath)}`);

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Export failed');
      }
      process.exit(1);
    }
  });
