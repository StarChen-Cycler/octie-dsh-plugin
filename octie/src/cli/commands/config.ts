/**
 * Config command - Get and set project-level Octie configuration
 *
 * Configuration is stored in <project>/.octie/config.json.
 * Supported keys:
 * - format: default CLI output format (json | md | table) when --format is not passed
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectPath, resolveOutputFormat, success, error, info, OUTPUT_FORMATS } from '../utils/helpers.js';

const SUPPORTED_KEYS = ['format'] as const;

/**
 * Read the project config file (tolerates missing or malformed files)
 */
function readConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed config: treat as empty rather than crashing
  }
  return {};
}

/**
 * Create the config command
 */
export const configCommand = new Command('config')
  .description('Get and set project-level Octie configuration');

configCommand
  .command('set')
  .description('Set a configuration value (supported keys: format)')
  .argument('<key>', 'Configuration key (currently only: format)')
  .argument('<value>', 'Configuration value (for format: json | md | table)')
  .action(async (key: string, value: string, _options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);

      if (!(SUPPORTED_KEYS as readonly string[]).includes(key)) {
        error(`Unsupported config key: '${key}'. Supported keys: ${SUPPORTED_KEYS.join(', ')}`);
        process.exit(1);
      }

      if (key === 'format' && !(OUTPUT_FORMATS as readonly string[]).includes(value)) {
        error(`Invalid format: '${value}'. Must be one of: ${OUTPUT_FORMATS.join(', ')}`);
        process.exit(1);
      }

      const octieDir = join(projectPath, '.octie');
      const configPath = join(octieDir, 'config.json');
      const config = readConfig(configPath);
      config[key] = value;

      mkdirSync(octieDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

      success(`Config updated: ${key} = ${chalk.cyan(value)}`);
      info(`Written to ${configPath}`);
      process.exit(0);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to set config');
      process.exit(1);
    }
  });

configCommand
  .command('get')
  .description('Get the effective value of a configuration key and its source')
  .argument('<key>', 'Configuration key (currently only: format)')
  .action(async (key: string, _options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);

      if (!(SUPPORTED_KEYS as readonly string[]).includes(key)) {
        error(`Unsupported config key: '${key}'. Supported keys: ${SUPPORTED_KEYS.join(', ')}`);
        process.exit(1);
      }

      const configPath = join(projectPath, '.octie', 'config.json');
      const config = readConfig(configPath);
      const effective = resolveOutputFormat(command, projectPath);

      console.log(`${key} = ${chalk.cyan(effective)}`);
      if (typeof config[key] === 'string') {
        info(`Source: ${configPath}`);
      } else {
        info('Source: default (no config value set; explicit --format flag always wins)');
      }
      process.exit(0);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to get config');
      process.exit(1);
    }
  });
