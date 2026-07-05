/**
 * CLI utility functions
 */

import chalk from 'chalk';
import path from 'node:path';
import { findProjectPath, TaskStorage } from '../../core/storage/file-store.js';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { OctieError, ERROR_SUGGESTIONS } from '../../types/index.js';

/**
 * Get the project path from options or auto-detect
 */
export async function getProjectPath(projectOption?: string): Promise<string> {
  if (projectOption) {
    const resolved = path.resolve(projectOption);

    // --project . means "current directory" — auto-detect from here
    const cwd = path.resolve('.');
    if (resolved === cwd) {
      const detected = await findProjectPath(cwd);
      if (detected) return detected;
      throw new Error(
        'No Octie project found in current directory. Run `octie init` first.'
      );
    }

    // --project .octie or --project path/to/.octie — user passed the .octie dir itself,
    // resolve to parent directory (same as what auto-detection returns)
    if (resolved.endsWith(path.sep + '.octie') || resolved.endsWith('/.octie')) {
      const parent = path.dirname(resolved);
      const storage = new TaskStorage({ projectDir: parent });
      if (await storage.exists()) return parent;
      throw new Error(
        `No Octie project found at ${resolved}\n\n` +
        '  Tip: For the root project, omit --project entirely (auto-detection handles it).\n' +
        '  For subprojects, use --project with the PARENT directory that contains .octie/\n' +
        '  Example: octie list --project .octie/subprojects/my-project'
      );
    }

    return resolved;
  }

  // Auto-detect project path
  const detectedPath = await findProjectPath();
  if (detectedPath) {
    return detectedPath;
  }

  throw new Error(
    'No Octie project found. Run `octie init` first or specify --project <path>'
  );
}

/**
 * Load the project graph
 */
export async function loadGraph(projectPath: string): Promise<TaskGraphStore> {
  const storage = new TaskStorage({ projectDir: projectPath });

  if (!(await storage.exists())) {
    const basename = path.basename(projectPath);
    let hint = '';
    if (basename === '.octie' || basename === '.octie') {
      hint = '\n\n  Tip: Pass the parent directory, not the .octie folder itself.\n' +
        '  For root project, omit --project; for subprojects use the parent path.';
    } else if (projectPath.includes('.octie' + path.sep + 'subprojects')) {
      hint = '\n\n  Tip: Subproject paths should point to the directory containing .octie/\n' +
        '  Example: --project .octie/subprojects/my-project (not .octie/subprojects/my-project/.octie)';
    }
    throw new Error(`No Octie project found at ${projectPath}${hint}`);
  }

  return await storage.load();
}

/**
 * Save the project graph
 */
export async function saveGraph(projectPath: string, graph: TaskGraphStore): Promise<void> {
  const storage = new TaskStorage({ projectDir: projectPath });
  await storage.save(graph);
}

/**
 * Format success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Format error message
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Format warning message
 */
export function warning(message: string): void {
  console.warn(chalk.yellow('⚠'), message);
}

/**
 * Format info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Format verbose message (only shown if --verbose flag is set)
 */
export function verbose(message: string, verbose: boolean): void {
  if (verbose) {
    console.log(chalk.gray(message));
  }
}

/**
 * Create a spinner for long-running operations
 */
export function createSpinner(message: string, enabled: boolean) {
  // Simple spinner implementation
  let dots = 0;
  let interval: NodeJS.Timeout | null = null;

  return {
    start: () => {
      if (!enabled) return;
      process.stdout.write(`\r${chalk.cyan('○')} ${message}`);
      interval = setInterval(() => {
        dots = (dots + 1) % 4;
        const dotStr = '.'.repeat(dots);
        process.stdout.write(`\r${chalk.cyan('○')} ${message}${dotStr}`);
      }, 100);
    },
    stop: (finalMessage: string) => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (enabled) {
        process.stdout.write(`\r${chalk.green('✓')} ${finalMessage}\n`);
      }
    },
    fail: (finalMessage: string) => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (enabled) {
        process.stdout.write(`\r${chalk.red('✗')} ${finalMessage}\n`);
      }
    },
  };
}

/**
 * Parse comma-separated list
 */
export function parseList(value: string): string[] {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Parse multiple IDs from various formats
 * Supports:
 * - "id1","id2","id3" (quoted CSV format)
 * - id1,id2,id3 (simple comma-separated)
 * - Single ID (backward compatible)
 *
 * Used with Commander.js collector pattern:
 * .option('--ids <id>', 'IDs to process', parseMultipleIds, [])
 */
export function parseMultipleIds(value: string, previous: string[]): string[] {
  if (!value) return previous;

  // Check for quoted CSV format: "id1","id2","id3"
  // This happens when user wraps in quotes to prevent shell parsing
  const quotedCsvMatch = value.match(/^"([^"]+)"(?:,"([^"]+)")*/);
  if (quotedCsvMatch) {
    // Extract all quoted values
    const quotedValues = value.match(/"([^"]+)"/g);
    if (quotedValues) {
      const ids = quotedValues.map(v => v.replace(/"/g, '').trim()).filter(Boolean);
      return previous.concat(ids);
    }
  }

  // Fall back to simple comma-separated: id1,id2,id3
  if (value.includes(',')) {
    const ids = value.split(',').map(item => item.trim()).filter(Boolean);
    return previous.concat(ids);
  }

  // Single ID (backward compatible)
  return previous.concat([value.trim()]);
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Format task ID for display
 */
export function formatTaskId(id: string): string {
  return chalk.cyan(id);
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  const statusColors: Record<string, (msg: string) => string> = {
    ready: chalk.cyan,
    in_progress: chalk.blue,
    in_review: chalk.magenta,
    completed: chalk.green,
    blocked: chalk.red,
    // Legacy status support (for backward compatibility with old data)
    not_started: chalk.gray,
    pending: chalk.yellow,
  };

  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status.replace('_', ' '));
}

/**
 * Format priority for display
 */
export function formatPriority(priority: string): string {
  const priorityColors: Record<string, (msg: string) => string> = {
    top: chalk.red,
    second: chalk.yellow,
    later: chalk.gray,
  };

  const colorFn = priorityColors[priority] || chalk.white;
  return colorFn(priority);
}

/**
 * Truncate text to fit width
 */
export function truncate(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.substring(0, maxWidth - 3) + '...';
}

/**
 * Format error for CLI output
 * Provides consistent error formatting with code, message, and suggestion
 */
export function formatError(error: unknown, verbose: boolean = false): string {
  // Handle OctieError with suggestion
  if (error instanceof OctieError) {
    const lines: string[] = [];

    // Error header with code
    lines.push(chalk.red.bold(`Error [${error.code}]:`) + ' ' + chalk.red(error.message));

    // Add suggestion if available
    if (error.suggestion) {
      lines.push('');
      lines.push(chalk.yellow('Suggestion:') + ' ' + error.suggestion);
    }

    // Add stack trace in verbose mode
    if (verbose && error.stack) {
      lines.push('');
      lines.push(chalk.gray('Stack trace:'));
      lines.push(chalk.gray(error.stack.split('\n').slice(1).join('\n')));
    }

    return lines.join('\n');
  }

  // Handle standard Error
  if (error instanceof Error) {
    const lines: string[] = [];
    lines.push(chalk.red.bold('Error:') + ' ' + chalk.red(error.message));

    if (verbose && error.stack) {
      lines.push('');
      lines.push(chalk.gray('Stack trace:'));
      lines.push(chalk.gray(error.stack.split('\n').slice(1).join('\n')));
    }

    return lines.join('\n');
  }

  // Handle unknown error types
  return chalk.red.bold('Error:') + ' ' + chalk.red(String(error));
}

/**
 * Get suggestion for an error code
 * Returns a suggestion string for the given error code
 */
export function getErrorSuggestion(code: string): string | undefined {
  return ERROR_SUGGESTIONS[code];
}

/**
 * Exit with error message
 * Formats and displays error, then exits with code 1
 */
export function exitWithError(error: unknown, verbose: boolean = false): never {
  console.error(formatError(error, verbose));
  process.exit(1);
}

/**
 * Retry options for recovery operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  delayMs: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Operation name for error messages */
  operationName?: string;
}

/**
 * Retry a function with exponential backoff
 * Useful for file operations that may fail due to concurrent access
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, delayMs, backoffMultiplier = 2, operationName = 'operation' } = options;
  let lastError: Error | undefined;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        if (process.env.VERBOSE === 'true') {
          console.log(chalk.yellow(`Retry ${attempt}/${maxRetries} for ${operationName} after ${currentDelay}ms...`));
        }
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Prompt user for confirmation
 * Returns true if user confirms (y/yes), false otherwise
 */
export async function confirmPrompt(message: string): Promise<boolean> {
  const readline = await import('node:readline/promises');
  const { stdin, stdout } = await import('node:process');

  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    const answer = await rl.question(message + ' ');
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Attempt to recover from a corrupted project file
 * Tries to restore from backup and provides actionable suggestions
 */
export async function attemptRecovery(projectPath: string): Promise<{ success: boolean; message: string }> {
  const storage = new TaskStorage({ projectDir: projectPath });

  try {
    // Check if backup exists
    const backups = await storage.listBackups();
    if (backups.length === 0) {
      return {
        success: false,
        message: 'No backup files available for recovery. You may need to re-initialize the project.',
      };
    }

    // Attempt to restore
    await storage.restoreFromBackup();
    return {
      success: true,
      message: `Successfully restored from backup: ${backups[0]}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
