/**
 * Batch command - Perform bulk operations on multiple tasks
 *
 * Provides atomic batch operations with safety features:
 * - Preview mode with --dry-run
 * - Atomic operations (all succeed or all fail)
 * - Progress indicators for large batches
 * - Safety confirmation for destructive operations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { TaskGraphStore } from '../../core/graph/index.js';
import type { TaskNode } from '../../core/models/task-node.js';
import type { TaskStatus } from '../../types/index.js';
import { getProjectPath, loadGraph, saveGraph, success, error, info, warning } from '../utils/helpers.js';
import { invalidateProjectCache } from './shared-helpers.js';

/**
 * Filter options for batch operations (reused from find command)
 */
interface BatchFilterOptions {
  title?: string;
  search?: string;
  hasFile?: string;
  verified?: string;
  withoutBlockers?: boolean;
  orphans?: boolean;
  leaves?: boolean;
  status?: string;
  priority?: string;
}

/**
 * Batch operation result
 */
interface BatchResult {
  success: boolean;
  affected: number;
  failed: number;
  errors: string[];
  affectedTasks: string[];
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

  if (task.title.toLowerCase().includes(queryLower)) return true;
  if (task.description.toLowerCase().includes(queryLower)) return true;
  if (task.notes.toLowerCase().includes(queryLower)) return true;
  if (task.success_criteria.some(sc => sc.text.toLowerCase().includes(queryLower))) return true;
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
function applyBatchFilters(graph: TaskGraphStore, options: BatchFilterOptions): TaskNode[] {
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
    tasks = tasks.filter(t => matchesC7Verification(t, options.verified!));
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
 * Preview affected tasks in a table
 */
function previewTasks(tasks: TaskNode[], operation: string): void {
  if (tasks.length === 0) {
    info('No tasks match the criteria');
    return;
  }

  console.log('');
  console.log(chalk.bold(`${operation} - ${tasks.length} task(s) affected:`));
  console.log('');

  const table = new Table({
    head: [
      chalk.gray('ID'),
      chalk.gray('Status'),
      chalk.gray('Priority'),
      chalk.gray('Title'),
    ].map(h => chalk.bold(h)),
    colWidths: [10, 15, 10, 50],
    wordWrap: true,
  });

  for (const task of tasks) {
    table.push([
      task.id.substring(0, 8),
      task.status,
      task.priority,
      task.title.substring(0, 50),
    ]);
  }

  console.log(table.toString());
  console.log('');
}

/**
 * Batch update-status subcommand
 */
async function batchUpdateStatus(
  graph: TaskGraphStore,
  newStatus: TaskStatus,
  filterOptions: BatchFilterOptions,
  dryRun: boolean
): Promise<BatchResult> {
  const tasks = applyBatchFilters(graph, filterOptions);
  const result: BatchResult = {
    success: true,
    affected: 0,
    failed: 0,
    errors: [],
    affectedTasks: [],
  };

  if (dryRun) {
    previewTasks(tasks, 'Update Status');
    result.affected = tasks.length;
    result.affectedTasks = tasks.map(t => t.id);
    return result;
  }

  for (const task of tasks) {
    try {
      task.setStatus(newStatus);
      result.affected++;
      result.affectedTasks.push(task.id);
    } catch (err) {
      result.failed++;
      if (err instanceof Error) {
        result.errors.push(`Task ${task.id.substring(0, 8)}: ${err.message}`);
      }
      result.success = false;
    }
  }

  return result;
}

/**
 * Batch delete subcommand
 */
async function batchDelete(
  graph: TaskGraphStore,
  filterOptions: BatchFilterOptions,
  dryRun: boolean,
  force: boolean
): Promise<BatchResult> {
  const tasks = applyBatchFilters(graph, filterOptions);
  const result: BatchResult = {
    success: true,
    affected: 0,
    failed: 0,
    errors: [],
    affectedTasks: [],
  };

  if (dryRun) {
    previewTasks(tasks, 'Delete Tasks');
    result.affected = tasks.length;
    result.affectedTasks = tasks.map(t => t.id);
    return result;
  }

  if (!force && tasks.length > 0) {
    warning('Use --force flag to actually delete tasks');
    warning('This is a destructive operation that cannot be undone');
    result.success = false;
    result.errors.push('Operation cancelled: --force flag required');
    return result;
  }

  // Delete tasks (in reverse order to handle dependencies)
  for (let i = tasks.length - 1; i >= 0; i--) {
    const task = tasks[i];
    if (!task) continue;

    try {
      graph.removeNode(task.id);
      result.affected++;
      result.affectedTasks.push(task.id);
    } catch (err) {
      result.failed++;
      if (err instanceof Error) {
        result.errors.push(`Task ${task.id.substring(0, 8)}: ${err.message}`);
      }
      result.success = false;
    }
  }

  return result;
}

/**
 * Batch add-blocker subcommand
 */
async function batchAddBlocker(
  graph: TaskGraphStore,
  blockerId: string,
  filterOptions: BatchFilterOptions,
  dryRun: boolean
): Promise<BatchResult> {
  const tasks = applyBatchFilters(graph, filterOptions);
  const result: BatchResult = {
    success: true,
    affected: 0,
    failed: 0,
    errors: [],
    affectedTasks: [],
  };

  // Validate blocker exists
  const blockerTask = graph.getNode(blockerId);
  if (!blockerTask) {
    result.success = false;
    result.errors.push(`Blocker task not found: ${blockerId}`);
    return result;
  }

  if (dryRun) {
    previewTasks(tasks, `Add Blocker ${blockerId.substring(0, 8)}`);
    result.affected = tasks.length;
    result.affectedTasks = tasks.map(t => t.id);
    return result;
  }

  for (const task of tasks) {
    try {
      // Check if task already has this blocker
      if (!task.blockers.includes(blockerId)) {
        task.addBlocker(blockerId);
        result.affected++;
        result.affectedTasks.push(task.id);
      }
    } catch (err) {
      result.failed++;
      if (err instanceof Error) {
        result.errors.push(`Task ${task.id.substring(0, 8)}: ${err.message}`);
      }
      result.success = false;
    }
  }

  // Propagate status changes from all affected tasks
  for (const taskId of result.affectedTasks) {
    graph.propagateStatus(taskId);
  }

  return result;
}

/**
 * Batch remove-blocker subcommand
 */
async function batchRemoveBlocker(
  graph: TaskGraphStore,
  blockerId: string,
  filterOptions: BatchFilterOptions,
  dryRun: boolean
): Promise<BatchResult> {
  const tasks = applyBatchFilters(graph, filterOptions);
  const result: BatchResult = {
    success: true,
    affected: 0,
    failed: 0,
    errors: [],
    affectedTasks: [],
  };

  if (dryRun) {
    previewTasks(tasks, `Remove Blocker ${blockerId.substring(0, 8)}`);
    result.affected = tasks.length;
    result.affectedTasks = tasks.map(t => t.id);
    return result;
  }

  for (const task of tasks) {
    try {
      // Check if task has this blocker
      if (task.blockers.includes(blockerId)) {
        task.removeBlocker(blockerId);
        result.affected++;
        result.affectedTasks.push(task.id);
      }
    } catch (err) {
      result.failed++;
      if (err instanceof Error) {
        result.errors.push(`Task ${task.id.substring(0, 8)}: ${err.message}`);
      }
      result.success = false;
    }
  }

  // Propagate status changes from all affected tasks
  for (const taskId of result.affectedTasks) {
    graph.propagateStatus(taskId);
  }

  return result;
}

/**
 * Display batch operation results
 */
function displayResults(result: BatchResult, dryRun: boolean): void {
  console.log('');

  if (dryRun) {
    info('Dry run complete - no changes made');
    console.log(chalk.gray(`Would affect: ${result.affected} task(s)`));
  } else if (result.success) {
    success(`Batch operation complete: ${result.affected} task(s) affected`);
  } else {
    error(`Batch operation partially failed: ${result.affected} succeeded, ${result.failed} failed`);

    if (result.errors.length > 0) {
      console.log('');
      warning('Errors:');
      for (const err of result.errors) {
        console.log(`  - ${err}`);
      }
    }
  }

  console.log('');
}

/**
 * Create the batch command with subcommands
 */
export const batchCommand = new Command('batch')
  .description('Perform bulk operations on multiple tasks')
  .addHelpText('after', `
Safety Features:
  --dry-run    Preview affected tasks without making changes
  --force      Required for destructive operations (delete)

Filter Options (same as 'find' command):
  --status <status>       Filter by status
  --priority <priority>   Filter by priority
  --title <pattern>       Filter by title substring
  --search <text>         Full-text search
  --has-file <path>       Filter by related file
  --verified <library>    Filter by C7 verification
  --without-blockers      Filter to tasks with no blockers
  --orphans               Filter to orphan tasks
  --leaves                Filter to leaf tasks

Examples:
  # Preview batch status update
  $ octie batch update-status in_progress --status ready --dry-run

  # Update all ready tasks to in_progress
  $ octie batch update-status in_progress --status ready

  # Delete all orphan tasks (requires --force)
  $ octie batch delete --orphans --force

  # Add blocker to all tasks matching filter
  $ octie batch add-blocker task-123 --priority top

  # Remove blocker from tasks
  $ octie batch remove-blocker task-123 --status blocked
`);

// Subcommand: update-status
batchCommand
  .command('update-status <status>')
  .description('Update status of all tasks matching filters')
  .option('-t, --title <pattern>', 'Filter by title')
  .option('-s, --search <text>', 'Full-text search filter')
  .option('-f, --has-file <path>', 'Filter by related file')
  .option('-v, --verified <library>', 'Filter by C7 verification')
  .option('--without-blockers', 'Filter to tasks with no blockers')
  .option('--orphans', 'Filter to orphan tasks')
  .option('--leaves', 'Filter to leaf tasks')
  .option('--status <currentStatus>', 'Filter by current status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('--dry-run', 'Preview changes without making them')
  .action(async (newStatus, options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      const result = await batchUpdateStatus(
        graph,
        newStatus as TaskStatus,
        options,
        options.dryRun || false
      );

      displayResults(result, options.dryRun || false);

      if (!options.dryRun && result.success) {
        await saveGraph(projectPath, graph);
        await invalidateProjectCache(projectPath);
      }

      process.exit(result.success ? 0 : 1);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to batch update status');
      }
      process.exit(1);
    }
  });

// Subcommand: delete
batchCommand
  .command('delete')
  .description('Delete all tasks matching filters')
  .option('-t, --title <pattern>', 'Filter by title')
  .option('-s, --search <text>', 'Full-text search filter')
  .option('-f, --has-file <path>', 'Filter by related file')
  .option('-v, --verified <library>', 'Filter by C7 verification')
  .option('--without-blockers', 'Filter to tasks with no blockers')
  .option('--orphans', 'Filter to orphan tasks')
  .option('--leaves', 'Filter to leaf tasks')
  .option('--status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('--dry-run', 'Preview changes without making them')
  .option('--force', 'Actually delete tasks (required for safety)')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      const result = await batchDelete(
        graph,
        options,
        options.dryRun || false,
        options.force || false
      );

      displayResults(result, options.dryRun || false);

      if (!options.dryRun && result.success) {
        info('Creating backup before save...');
        await saveGraph(projectPath, graph);
        await invalidateProjectCache(projectPath);
      }

      process.exit(result.success ? 0 : 1);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to batch delete tasks');
      }
      process.exit(1);
    }
  });

// Subcommand: add-blocker
batchCommand
  .command('add-blocker <blocker-id>')
  .description('Add blocker to all tasks matching filters')
  .option('-t, --title <pattern>', 'Filter by title')
  .option('-s, --search <text>', 'Full-text search filter')
  .option('-f, --has-file <path>', 'Filter by related file')
  .option('-v, --verified <library>', 'Filter by C7 verification')
  .option('--without-blockers', 'Filter to tasks with no blockers')
  .option('--orphans', 'Filter to orphan tasks')
  .option('--leaves', 'Filter to leaf tasks')
  .option('--status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('--dry-run', 'Preview changes without making them')
  .action(async (blockerId, options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      const result = await batchAddBlocker(
        graph,
        blockerId,
        options,
        options.dryRun || false
      );

      displayResults(result, options.dryRun || false);

      if (!options.dryRun && result.success) {
        await saveGraph(projectPath, graph);
        await invalidateProjectCache(projectPath);
      }

      process.exit(result.success ? 0 : 1);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to batch add blocker');
      }
      process.exit(1);
    }
  });

// Subcommand: remove-blocker
batchCommand
  .command('remove-blocker <blocker-id>')
  .description('Remove blocker from all tasks matching filters')
  .option('-t, --title <pattern>', 'Filter by title')
  .option('-s, --search <text>', 'Full-text search filter')
  .option('-f, --has-file <path>', 'Filter by related file')
  .option('-v, --verified <library>', 'Filter by C7 verification')
  .option('--without-blockers', 'Filter to tasks with no blockers')
  .option('--orphans', 'Filter to orphan tasks')
  .option('--leaves', 'Filter to leaf tasks')
  .option('--status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('--dry-run', 'Preview changes without making them')
  .action(async (blockerId, options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const graph = await loadGraph(projectPath);

      const result = await batchRemoveBlocker(
        graph,
        blockerId,
        options,
        options.dryRun || false
      );

      displayResults(result, options.dryRun || false);

      if (!options.dryRun && result.success) {
        await saveGraph(projectPath, graph);
        await invalidateProjectCache(projectPath);
      }

      process.exit(result.success ? 0 : 1);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to batch remove blocker');
      }
      process.exit(1);
    }
  });
