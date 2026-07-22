/**
 * List command - List tasks with filtering options
 */

import { Command, Option } from 'commander';
import Table from 'cli-table3';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { TaskNode } from '../../core/models/task-node.js';
import { getProjectPath, loadGraph, formatStatus, formatPriority, resolveOutputFormat, toTaskSummary, formatTaskSummaryMarkdown } from '../utils/helpers.js';
import chalk from 'chalk';
import { formatTaskMarkdown } from '../output/markdown.js';

/**
 * Format task as table row
 */
function formatTaskAsRow(task: TaskNode, showId: boolean = true, titleMaxWidth: number = 80): string[] {
  const row: string[] = [];

  if (showId) {
    row.push(task.id.substring(0, 8));
  }

  row.push(
    formatStatus(task.status),
    formatPriority(task.priority),
    // ponytail: let table colWidths handle truncation; no need to substring here
    // unless titleMaxWidth is unreasonably small
    titleMaxWidth < 30 ? task.title.substring(0, titleMaxWidth) : task.title
  );

  return row;
}

/**
 * Build and render tree structure for display
 */
function buildAndRenderTree(graph: TaskGraphStore, rootTasks: string[]): string {
  const lines: string[] = [];
  const visited = new Set<string>();

  function renderNode(taskId: string, prefix: string, isLast: boolean): void {
    if (visited.has(taskId)) {
      return;
    }
    visited.add(taskId);

    const task = graph.getNode(taskId);
    if (!task) return;

    const connector = isLast ? '└── ' : '├── ';
    lines.push(prefix + connector + `${task.title} ${chalk.gray(`(${task.status})`)}`);

    const dependents = graph.getOutgoingEdges(taskId);
    const dependentCount = dependents.length;

    dependents.forEach((depId, index) => {
      const isLastChild = index === dependentCount - 1;
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
  .addOption(
    new Option('-s, --status <status>', 'Filter by status')
      .choices(['ready', 'in_progress', 'in_review', 'completed', 'blocked'])
  )
  .addOption(
    new Option('-p, --priority <priority>', 'Filter by priority')
      .choices(['top', 'second', 'later'])
  )
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

      // Load project
      const projectPath = await getProjectPath(globalOpts.project);
      const format = resolveOutputFormat(command, projectPath);
      const graph = await loadGraph(projectPath);

      // Apply filters
      let tasks = graph.getAllTasks();

      if (options.status) {
        tasks = tasks.filter(task => task.status === options.status);
      }
      if (options.priority) {
        tasks = tasks.filter(task => task.priority === options.priority);
      }

      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found'));
        process.exit(0);
      }

      // Graph structure view
      if (options.graph) {
        console.log(chalk.bold('Graph Structure:'));
        console.log('');

        for (const task of tasks) {
          const incoming = graph.getIncomingEdges(task.id);
          const outgoing = graph.getOutgoingEdges(task.id);

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
        const rootTasks = graph.getRootTasks();
        const treeOutput = buildAndRenderTree(graph, rootTasks);

        console.log(chalk.bold('Task Tree:'));
        console.log('');
        console.log(treeOutput);
        process.exit(0);
      }

      // Format output
      switch (format) {
        case 'json':
          console.log(JSON.stringify(options.summary ? tasks.map(toTaskSummary) : tasks, null, 2));
          break;

        case 'md':
          console.log(`# Tasks (${tasks.length})\n`);
          for (const task of tasks) {
            if (options.summary) {
              console.log(formatTaskSummaryMarkdown(task));
            } else {
              console.log(formatTaskMarkdown(task));
              console.log('');
              console.log('---');
              console.log('');
            }
          }
          break;

        case 'table':
        default: {
          // ponytail: adaptive column widths — ID and Priority are fixed,
          // Status gets enough room for "in_progress" (11 chars),
          // Title gets the rest of the terminal
          const termWidth = process.stdout.columns || 80;
          const idWidth = 10;
          const statusWidth = 13;
          const priorityWidth = 10;
          // ~3 chars padding per column (left+right) + 1 separator per column
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
    } catch (err) {
      if (err instanceof Error) {
        console.error(chalk.red(`Error: ${err.message}`));
      } else {
        console.error(chalk.red('Failed to list tasks'));
      }
      process.exit(1);
    }
  });
