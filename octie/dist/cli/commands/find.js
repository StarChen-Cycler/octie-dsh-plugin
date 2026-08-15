/**
 * Find command - Search and filter tasks with advanced options
 *
 * The data layer lives in the service layer (`findTasksFull`); this
 * command keeps only rendering, and exit codes.
 */
import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import { getProjectPath, formatStatus, formatPriority, resolveOutputFormat } from '../utils/helpers.js';
import { findTasksFull } from '../../service/index.js';
/**
 * Format task as table row
 */
function formatTaskAsRow(task, showId = true) {
    const row = [];
    if (showId) {
        row.push(task.id.substring(0, 8));
    }
    row.push(formatStatus(task.status), formatPriority(task.priority), task.title.substring(0, 40));
    return row;
}
/**
 * Format task as markdown (brief for list view)
 */
function formatTaskAsMarkdown(task) {
    const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
    const status = formatStatus(task.status);
    const priority = formatPriority(task.priority);
    return `## ${checkbox} ${task.title}\n` +
        `**ID**: \`${task.id}\`\n` +
        `**Status**: ${status}\n` +
        `**Priority**: ${priority}\n` +
        `**Description**: ${task.description.substring(0, 100)}...\n`;
}
function summaryMarkdown(task) {
    const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
    const blockedBy = task.blockers.length > 0
        ? ` · blocked by: ${task.blockers.map(id => `#${id.substring(0, 8)}`).join(', ')}`
        : '';
    return `- ${checkbox} **${task.title}** (#${task.id.substring(0, 8)}) · ${task.status} · ${task.priority}${blockedBy}`;
}
function toSummary(task) {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        blockers: task.blockers,
    };
}
/**
 * Output results in the specified format
 */
function outputResults(tasks, format, summary = false) {
    switch (format) {
        case 'json':
            console.log(JSON.stringify(summary ? tasks.map(toSummary) : tasks, null, 2));
            break;
        case 'md':
            console.log(`# Search Results (${tasks.length})\n`);
            for (const task of tasks) {
                console.log(summary ? summaryMarkdown(task) : formatTaskAsMarkdown(task));
            }
            break;
        case 'table':
        default:
            if (tasks.length === 0) {
                console.log(chalk.yellow('No tasks found matching the criteria'));
                return;
            }
            const table = new Table({
                head: [
                    chalk.gray('ID'),
                    chalk.gray('Status'),
                    chalk.gray('Priority'),
                    chalk.gray('Title'),
                ].map(h => chalk.bold(h)),
                colWidths: [10, 15, 10, 40],
                wordWrap: true,
            });
            for (const task of tasks) {
                table.push(formatTaskAsRow(task));
            }
            console.log(table.toString());
            console.log(chalk.gray(`Found: ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`));
            break;
    }
}
/**
 * Create the find command
 */
export const findCommand = new Command('find')
    .description('Search and filter tasks with advanced options')
    .option('-t, --title <pattern>', 'Search task titles (case-insensitive substring)')
    .option('-s, --search <text>', 'Full-text search in description, notes, criteria, deliverables')
    .option('-f, --has-file <path>', 'Find tasks referencing a specific file')
    .option('-v, --verified <library>', 'Find tasks with C7 verification from specific library')
    .option('--without-blockers', 'Show tasks with no blockers (ready to start)')
    .option('--orphans', 'Show tasks with no relationships (no edges)')
    .option('--leaves', 'Show tasks with no outgoing edges (end tasks)')
    .option('--summary', 'Compact one-line-per-task output (id, title, status, priority, blockers; md and json formats)')
    .option('--status <status>', 'Filter by status (ready|in_progress|in_review|completed|blocked)')
    .option('-p, --priority <priority>', 'Filter by priority (top|second|later)')
    .addHelpText('after', `
Examples:
  $ octie find --title "auth"                  Find tasks with "auth" in title
  $ octie find --search "JWT token"            Full-text search for "JWT token"
  $ octie find --has-file "auth.ts"            Find tasks referencing auth.ts
  $ octie find --verified "/express"           Find tasks verified against Express docs
  $ octie find --without-blockers              Find tasks ready to start
  $ octie find --orphans                       Find disconnected tasks
  $ octie find --leaves --status ready         Find ready end tasks
  $ octie find --title "API" --priority top    Combine multiple filters

Output formats:
  $ octie find --title "auth" --format json    Output as JSON
  $ octie find --search "test" --format md     Output as Markdown
  $ octie find --summary --format md          Compact one-line-per-task markdown
`)
    .action(async (options, command) => {
    try {
        // Get global options
        const globalOpts = command.parent?.opts() || {};
        // Load project and matching tasks from the service layer
        const projectPath = await getProjectPath(globalOpts.project);
        const format = resolveOutputFormat(command, projectPath);
        const filter = {
            title: options.title,
            search: options.search,
            hasFile: options.hasFile,
            verified: options.verified,
            withoutBlockers: options.withoutBlockers,
            orphans: options.orphans,
            leaves: options.leaves,
            status: options.status,
            priority: options.priority,
        };
        const tasks = await findTasksFull(projectPath, filter);
        // Output results
        outputResults(tasks, format, options.summary);
        process.exit(0);
    }
    catch (err) {
        if (err instanceof Error) {
            console.error(chalk.red(`Error: ${err.message}`));
        }
        else {
            console.error(chalk.red('Failed to search tasks'));
        }
        process.exit(1);
    }
});
//# sourceMappingURL=find.js.map