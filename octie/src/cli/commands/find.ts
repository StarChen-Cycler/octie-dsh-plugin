/**
 * Find command - Search and filter tasks with advanced options
 *
 * Provides powerful search capabilities:
 * - Title substring matching
 * - Full-text search across description, notes, criteria, deliverables
 * - File reference search
 * - C7 verification library search
 * - Special filters: without-blockers, orphans, leaves
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import type { TaskGraphStore } from '../../core/graph/index.js';
import type { TaskNode } from '../../core/models/task-node.js';
import { getProjectPath, loadGraph, formatStatus, formatPriority, resolveOutputFormat, toTaskSummary, formatTaskSummaryMarkdown } from '../utils/helpers.js';
import { normalizeGitBashPath } from './shared-helpers.js';

/**
 * Search options interface
 */
interface FindOptions {
  title?: string;
  search?: string;
  hasFile?: string;
  verified?: string;
  withoutBlockers?: boolean;
  orphans?: boolean;
  leaves?: boolean;
  status?: string;
  priority?: string;
  summary?: boolean;
}

/**
 * Format task as table row
 */
function formatTaskAsRow(task: TaskNode, showId: boolean = true): string[] {
  const row: string[] = [];

  if (showId) {
    row.push(task.id.substring(0, 8));
  }

  row.push(
    formatStatus(task.status),
    formatPriority(task.priority),
    task.title.substring(0, 40)
  );

  return row;
}

/**
 * Format task as markdown (brief for list view)
 */
function formatTaskAsMarkdown(task: TaskNode): string {
  const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
  const status = formatStatus(task.status);
  const priority = formatPriority(task.priority);

  return `## ${checkbox} ${task.title}\n` +
         `**ID**: \`${task.id}\`\n` +
         `**Status**: ${status}\n` +
         `**Priority**: ${priority}\n` +
         `**Description**: ${task.description.substring(0, 100)}...\n`;
}

/**
 * Check if task matches title pattern (case-insensitive substring)
 */
function matchesTitle(task: TaskNode, pattern: string): boolean {
  return task.title.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Check if task contains search text in various fields
 */
function matchesSearch(task: TaskNode, query: string): boolean {
  const queryLower = query.toLowerCase();

  // Search in title
  if (task.title.toLowerCase().includes(queryLower)) return true;

  // Search in description
  if (task.description.toLowerCase().includes(queryLower)) return true;

  // Search in notes
  if (task.notes.toLowerCase().includes(queryLower)) return true;

  // Search in success criteria
  if (task.success_criteria.some(sc => sc.text.toLowerCase().includes(queryLower))) return true;

  // Search in deliverables
  if (task.deliverables.some(d => d.text.toLowerCase().includes(queryLower))) return true;

  return false;
}

/**
 * Check if task has a specific related file
 */
function matchesFile(task: TaskNode, filePath: string): boolean {
  return task.related_files.some(f =>
    f.toLowerCase().includes(filePath.toLowerCase())
  );
}

/**
 * Check if task has C7 verification from specific library
 */
function matchesC7Verification(task: TaskNode, libraryId: string): boolean {
  const libraryLower = libraryId.toLowerCase();
  return task.c7_verified.some(v =>
    v.library_id.toLowerCase().includes(libraryLower)
  );
}

/**
 * Check if task has no blockers
 */
function hasNoBlockers(task: TaskNode): boolean {
  return task.blockers.length === 0;
}

/**
 * Apply all filters and return matching tasks
 */
function applyFilters(graph: TaskGraphStore, options: FindOptions): TaskNode[] {
  let taskIds: Set<string> | null = null;
  let tasks = graph.getAllTasks();

  // If --orphans flag is set, filter to orphan tasks only
  if (options.orphans) {
    const orphanIds = graph.getOrphanTasks();
    if (taskIds === null) {
      taskIds = new Set(orphanIds);
    } else {
      taskIds = new Set(orphanIds.filter(id => taskIds!.has(id)));
    }
  }

  // If --leaves flag is set, filter to leaf tasks only
  if (options.leaves) {
    const leafIds = graph.getLeafTasks();
    if (taskIds === null) {
      taskIds = new Set(leafIds);
    } else {
      taskIds = new Set(leafIds.filter(id => taskIds!.has(id)));
    }
  }

  // If --without-blockers flag is set, filter to tasks with no blockers
  if (options.withoutBlockers) {
    const noBlockerIds = tasks.filter(t => hasNoBlockers(t)).map(t => t.id);
    if (taskIds === null) {
      taskIds = new Set(noBlockerIds);
    } else {
      taskIds = new Set(noBlockerIds.filter(id => taskIds!.has(id)));
    }
  }

  // If taskIds has been constrained by flags, filter tasks
  if (taskIds !== null) {
    tasks = tasks.filter(t => taskIds!.has(t.id));
  }

  // Apply --title filter
  if (options.title) {
    tasks = tasks.filter(t => matchesTitle(t, options.title!));
  }

  // Apply --search filter (full-text search)
  if (options.search) {
    tasks = tasks.filter(t => matchesSearch(t, options.search!));
  }

  // Apply --has-file filter
  if (options.hasFile) {
    tasks = tasks.filter(t => matchesFile(t, options.hasFile!));
  }

  // Apply --verified filter (C7 verification library)
  if (options.verified) {
    const libraryId = normalizeGitBashPath(options.verified);
    tasks = tasks.filter(t => matchesC7Verification(t, libraryId));
  }

  // Apply --status filter
  if (options.status) {
    tasks = tasks.filter(t => t.status === options.status);
  }

  // Apply --priority filter
  if (options.priority) {
    tasks = tasks.filter(t => t.priority === options.priority);
  }

  return tasks;
}

/**
 * Output results in the specified format
 */
function outputResults(tasks: TaskNode[], format: string, summary: boolean = false): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(summary ? tasks.map(toTaskSummary) : tasks, null, 2));
      break;

    case 'md':
      console.log(`# Search Results (${tasks.length})\n`);
      for (const task of tasks) {
        console.log(summary ? formatTaskSummaryMarkdown(task) : formatTaskAsMarkdown(task));
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
  .action(async (options: FindOptions, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};

      // Load project
      const projectPath = await getProjectPath(globalOpts.project);
      const format = resolveOutputFormat(command, projectPath);
      const graph = await loadGraph(projectPath);

      // Apply filters
      const tasks = applyFilters(graph, options);

      // Output results
      outputResults(tasks, format, options.summary);

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        console.error(chalk.red(`Error: ${err.message}`));
      } else {
        console.error(chalk.red('Failed to search tasks'));
      }
      process.exit(1);
    }
  });
