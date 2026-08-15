/**
 * List command - List tasks with filtering options
 *
 * The data layer lives in the service layer (`listTasksFull`,
 * `graphStructure`); this command keeps only rendering and exit codes.
 */
import { Command, Option } from 'commander';
import Table from 'cli-table3';
import { getProjectPath, formatStatus, formatPriority, resolveOutputFormat } from '../utils/helpers.js';
import { listTasksFull, graphStructure } from '../../service/index.js';
import chalk from 'chalk';
import { formatTaskMarkdown } from '../output/markdown.js';
/**
 * Format task as table row
 */
function formatTaskAsRow(task, showId = true, titleMaxWidth = 80) {
    const row = [];
    if (showId) {
        row.push(task.id.substring(0, 8));
    }
    row.push(formatStatus(task.status), formatPriority(task.priority), titleMaxWidth < 30 ? task.title.substring(0, titleMaxWidth) : task.title);
    return row;
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
function summaryMarkdown(task) {
    const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
    const blockedBy = task.blockers.length > 0
        ? ` · blocked by: ${task.blockers.map(id => `#${id.substring(0, 8)}`).join(', ')}`
        : '';
    return `- ${checkbox} **${task.title}** (#${task.id.substring(0, 8)}) · ${task.status} · ${task.priority}${blockedBy}`;
}
/**
 * Build and render tree structure for display
 */
function buildAndRenderTree(structure, rootTasks) {
    const nodesById = new Map(structure.nodes.map(n => [n.id, n]));
    const lines = [];
    const visited = new Set();
    function renderNode(taskId, prefix, isLast) {
        if (visited.has(taskId))
            return;
        visited.add(taskId);
        const node = nodesById.get(taskId);
        if (!node)
            return;
        const connector = isLast ? '└── ' : '├── ';
        lines.push(prefix + connector + `${node.title} ${chalk.gray(`(${node.status})`)}`);
        const dependents = structure.outgoing[taskId] ?? [];
        dependents.forEach((depId, index) => {
            const isLastChild = index === dependents.length - 1;
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            renderNode(depId, newPrefix, isLastChild);
        });
    }
    rootTasks.forEach((rootId, index) => {
        const isLastRoot = index === rootTasks.length - 1;
        renderNode(rootId, '', isLastRoot);
    });
    return lines.join('\n');
}
/**
 * Create the list command
 */
export const listCommand = new Command('list')
    .description('List tasks with filtering options')
    .addOption(new Option('-s, --status <status>', 'Filter by status')
    .choices(['ready', 'in_progress', 'in_review', 'completed', 'blocked']))
    .addOption(new Option('-p, --priority <priority>', 'Filter by priority')
    .choices(['top', 'second', 'later']))
    .option('--graph', 'Show graph structure')
    .option('--tree', 'Show tree view')
    .option('--summary', 'Compact one-line-per-task output (id, title, status, priority, blockers; md and json formats)')
    .addHelpText('after', `
Status Values:
  ready       - Task has no blockers and no work started
  in_progress - Work has begun (criteria/deliverables checked, or need_fix added)
  in_review   - All criteria, deliverables, and need_fix items complete
  completed   - Task approved (use 'octie approve <id>')
  blocked     - Task has unresolved blockers

Priority Values:
  top         - Highest priority, work on next
  second      - Normal priority (default)
  later       - Low priority, future work

Examples:
  $ octie list                              List all tasks
  $ octie list --status in_progress         List tasks in progress
  $ octie list --priority top               List top priority tasks
  $ octie list --graph                      Show graph relationships
  $ octie list --tree                       Show tree view
  $ octie list --format json                Output as JSON
  $ octie list --summary --format md        Compact one-line-per-task markdown
`)
    .action(async (options, command) => {
    try {
        // Get global options
        const globalOpts = command.parent?.opts() || {};
        // Load project and filtered tasks from the service layer
        const projectPath = await getProjectPath(globalOpts.project);
        const format = resolveOutputFormat(command, projectPath);
        const tasks = await listTasksFull(projectPath, {
            status: options.status,
            priority: options.priority,
        });
        if (tasks.length === 0) {
            console.log(chalk.yellow('No tasks found'));
            process.exit(0);
        }
        // Graph structure view
        if (options.graph) {
            const structure = await graphStructure(projectPath);
            console.log(chalk.bold('Graph Structure:'));
            console.log('');
            for (const task of tasks) {
                const incoming = structure.incoming[task.id] ?? [];
                const outgoing = structure.outgoing[task.id] ?? [];
                console.log(chalk.cyan(task.id.substring(0, 8)), '-', task.title);
                if (incoming.length > 0) {
                    console.log(chalk.gray('  Blocked by:'), incoming.map(id => chalk.cyan(id.substring(0, 8))).join(', '));
                }
                if (outgoing.length > 0) {
                    console.log(chalk.gray('  Enables:'), outgoing.map(id => chalk.cyan(id.substring(0, 8))).join(', '));
                }
                console.log('');
            }
            process.exit(0);
        }
        // Tree view
        if (options.tree) {
            const structure = await graphStructure(projectPath);
            const treeOutput = buildAndRenderTree(structure, structure.roots);
            console.log(chalk.bold('Task Tree:'));
            console.log('');
            console.log(treeOutput);
            process.exit(0);
        }
        // Format output
        switch (format) {
            case 'json':
                console.log(JSON.stringify(options.summary ? tasks.map(toSummary) : tasks, null, 2));
                break;
            case 'md':
                console.log(`# Tasks (${tasks.length})\n`);
                for (const task of tasks) {
                    if (options.summary) {
                        console.log(summaryMarkdown(task));
                    }
                    else {
                        console.log(formatTaskMarkdown(task));
                        console.log('');
                        console.log('---');
                        console.log('');
                    }
                }
                break;
            case 'table':
            default: {
                // Adaptive column widths
                const termWidth = process.stdout.columns || 80;
                const idWidth = 10;
                const statusWidth = 13;
                const priorityWidth = 10;
                const overhead = 4 * 3 + 4;
                const titleWidth = Math.max(30, termWidth - idWidth - statusWidth - priorityWidth - overhead);
                const table = new Table({
                    head: [
                        chalk.gray('ID'),
                        chalk.gray('Status'),
                        chalk.gray('Priority'),
                        chalk.gray('Title'),
                    ].map(h => chalk.bold(h)),
                    colWidths: [idWidth, statusWidth, priorityWidth, titleWidth],
                    wordWrap: false,
                });
                for (const task of tasks) {
                    table.push(formatTaskAsRow(task, true, titleWidth));
                }
                console.log(table.toString());
                console.log(chalk.gray(`Total: ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`));
                break;
            }
        }
        process.exit(0);
    }
    catch (err) {
        if (err instanceof Error) {
            console.error(chalk.red(`Error: ${err.message}`));
        }
        else {
            console.error(chalk.red('Failed to list tasks'));
        }
        process.exit(1);
    }
});
//# sourceMappingURL=list.js.map