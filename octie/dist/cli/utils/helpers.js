/**
 * CLI utility functions
 */
import chalk from 'chalk';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { findProjectPath, TaskStorage } from '../../core/storage/file-store.js';
import { OctieError } from '../../types/index.js';
/**
 * Valid CLI output formats
 */
export const OUTPUT_FORMATS = ['json', 'md', 'table'];
/**
 * Resolve the effective output format for a command
 *
 * Precedence:
 * 1. Explicit --format flag (or env) passed by the user
 * 2. "format" key in <projectPath>/.octie/config.json
 * 3. 'table' default
 *
 * @param command - The executing (sub)command; the root program is found by walking parents
 * @param projectPath - Resolved Octie project path (contains .octie/)
 */
export function resolveOutputFormat(command, projectPath) {
    // Walk up to the root program where the global --format option is defined
    let program = command;
    while (program.parent) {
        program = program.parent;
    }
    const source = typeof program.getOptionValueSource === 'function'
        ? program.getOptionValueSource('format')
        : undefined;
    if (source === 'cli' || source === 'env') {
        return program.opts().format || 'table';
    }
    // --format not explicitly passed: fall back to project config
    try {
        const configPath = path.join(projectPath, '.octie', 'config.json');
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (typeof config.format === 'string' && OUTPUT_FORMATS.includes(config.format)) {
                return config.format;
            }
        }
    }
    catch {
        // Malformed or unreadable config: fall through to default
    }
    return 'table';
}
/**
 * Get the project path from options or auto-detect
 */
export async function getProjectPath(projectOption) {
    if (projectOption) {
        const resolved = path.resolve(projectOption);
        // --project . means "current directory" — auto-detect from here
        const cwd = path.resolve('.');
        if (resolved === cwd) {
            const detected = await findProjectPath(cwd);
            if (detected)
                return detected;
            throw new Error('No Octie project found in current directory. Run `octie init` first.');
        }
        // --project .octie or --project path/to/.octie — user passed the .octie dir itself,
        // resolve to parent directory (same as what auto-detection returns)
        if (resolved.endsWith(path.sep + '.octie') || resolved.endsWith('/.octie')) {
            const parent = path.dirname(resolved);
            const storage = new TaskStorage({ projectDir: parent });
            if (await storage.exists())
                return parent;
            throw new Error(`No Octie project found at ${resolved}\n\n` +
                '  Tip: For the root project, omit --project entirely (auto-detection handles it).\n' +
                '  For subprojects, use --project with the PARENT directory that contains .octie/\n' +
                '  Example: octie list --project .octie/subprojects/my-project');
        }
        return resolved;
    }
    // Auto-detect project path
    const detectedPath = await findProjectPath();
    if (detectedPath) {
        return detectedPath;
    }
    throw new Error('No Octie project found. Run `octie init` first or specify --project <path>');
}
/**
 * Load the project graph
 */
export async function loadGraph(projectPath) {
    const storage = new TaskStorage({ projectDir: projectPath });
    if (!(await storage.exists())) {
        const basename = path.basename(projectPath);
        let hint = '';
        if (basename === '.octie' || basename === '.octie') {
            hint = '\n\n  Tip: Pass the parent directory, not the .octie folder itself.\n' +
                '  For root project, omit --project; for subprojects use the parent path.';
        }
        else if (projectPath.includes('.octie' + path.sep + 'subprojects')) {
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
export async function saveGraph(projectPath, graph) {
    const storage = new TaskStorage({ projectDir: projectPath });
    await storage.save(graph);
}
/**
 * Format success message
 */
export function success(message) {
    console.log(chalk.green('✓'), message);
}
/**
 * Format error message
 */
export function error(message) {
    console.error(chalk.red('✗'), message);
}
/**
 * Format warning message
 */
export function warning(message) {
    console.warn(chalk.yellow('⚠'), message);
}
/**
 * Format info message
 */
export function info(message) {
    console.log(chalk.blue('ℹ'), message);
}
/**
 * Parse comma-separated list
 */
export function parseList(value) {
    if (!value)
        return [];
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
export function parseMultipleIds(value, previous) {
    if (!value)
        return previous;
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
 * Format status for display
 */
export function formatStatus(status) {
    const statusColors = {
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
export function formatPriority(priority) {
    const priorityColors = {
        top: chalk.red,
        second: chalk.yellow,
        later: chalk.gray,
    };
    const colorFn = priorityColors[priority] || chalk.white;
    return colorFn(priority);
}
/**
 * Format error for CLI output
 * Provides consistent error formatting with code, message, and suggestion
 */
export function formatError(error, verbose = false) {
    // Handle OctieError with suggestion
    if (error instanceof OctieError) {
        const lines = [];
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
        const lines = [];
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
 * Prompt user for confirmation
 * Returns true if user confirms (y/yes), false otherwise
 */
export async function confirmPrompt(message) {
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
    }
    finally {
        rl.close();
    }
}
/**
 * Project a task to its 5-field summary shape
 */
export function toTaskSummary(task) {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        blockers: task.blockers,
    };
}
/**
 * Render one task as a compact one-line markdown summary
 */
export function formatTaskSummaryMarkdown(task) {
    const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
    const blockedBy = task.blockers.length > 0
        ? ` · blocked by: ${task.blockers.map(id => `#${id.substring(0, 8)}`).join(', ')}`
        : '';
    return `- ${checkbox} **${task.title}** (#${task.id.substring(0, 8)}) · ${task.status} · ${task.priority}${blockedBy}`;
}
//# sourceMappingURL=helpers.js.map