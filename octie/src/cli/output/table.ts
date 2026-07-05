/**
 * Table output formatters for tasks
 */

import { TaskNode } from '../../core/models/task-node.js';
import Table from 'cli-table3';
import { formatStatus, formatPriority, truncate } from '../utils/helpers.js';
import chalk from 'chalk';

/**
 * Format multiple tasks as a table
 * Columns: ID, Status, Priority, Title, Blockers, Dependencies
 *
 * @param tasks - Array of tasks to format
 * @param options - Formatting options
 * @returns Formatted table string
 */
export interface FormatTasksTableOptions {
  compact?: boolean; // Compact mode (less detail)
  verbose?: boolean; // Verbose mode (more detail)
  showId?: boolean; // Show full ID instead of truncated
}

export function formatTasksTable(
  tasks: TaskNode[],
  options: FormatTasksTableOptions = {}
): string {
  const { verbose = false, showId = false } = options;

  // Handle empty task list
  if (tasks.length === 0) {
    return chalk.yellow('No tasks to display');
  }

  // Define table structure
  const colWidths = showId ? [36, 15, 10, 40] : [10, 15, 10, 40];
  const head = showId
    ? [chalk.gray('ID'), chalk.gray('Status'), chalk.gray('Priority'), chalk.gray('Title')]
    : [chalk.gray('ID'), chalk.gray('Status'), chalk.gray('Priority'), chalk.gray('Title')];

  const table = new Table({
    head: head.map(h => chalk.bold(h)),
    colWidths,
    wordWrap: true,
  });

  // Add rows
  for (const task of tasks) {
    const id = showId ? task.id : task.id.substring(0, 8);
    const status = formatStatus(task.status);
    const priority = formatPriority(task.priority);
    const title = truncate(task.title, 40);

    table.push([id, status, priority, title]);

    // Verbose mode: add blockers and dependencies as additional rows
    if (verbose) {
      if (task.blockers.length > 0) {
        table.push([
          '',
          chalk.gray('Blocked by:'),
          '',
          chalk.cyan(task.blockers.map(id => id.substring(0, 8)).join(', ')),
        ]);
      }

      if (task.dependencies) {
        table.push([
          '',
          chalk.gray('Dependencies:'),
          '',
          chalk.cyan(task.dependencies.substring(0, 40) + (task.dependencies.length > 40 ? '...' : '')),
        ]);
      }
    }
  }

  let output = table.toString();

  // Add summary
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const inReview = tasks.filter(t => t.status === 'in_review').length;
  const ready = tasks.filter(t => t.status === 'ready').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;

  output += '\n' + chalk.gray(`Total: ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);

  if (verbose && tasks.length > 0) {
    output += '\n' + chalk.gray(
      `  ${chalk.green('✓')} ${completed} completed | ` +
      `${chalk.blue('○')} ${inProgress} in progress | ` +
      `${chalk.magenta('◎')} ${inReview} in review | ` +
      `${chalk.cyan('○')} ${ready} ready | ` +
      `${chalk.red('⊘')} ${blocked} blocked`
    );
  }

  return output;
}

/**
 * Format a single task as a detailed table view
 * @param task - The task to format
 * @param fields - Optional list of field names to include (null = all)
 */
export function formatTaskDetailTable(task: TaskNode, fields?: string[] | null): string {
  const show = (name: string) => !fields || fields.includes(name);
  const lines: string[] = [];

  // Header — always shown
  lines.push(chalk.bold(task.title));
  lines.push(chalk.gray(`ID: ${task.id}`));
  lines.push('');

  // Basic info table
  const infoRows: string[][] = [];
  if (show('status')) infoRows.push([chalk.gray('Status:'), formatStatus(task.status)]);
  if (show('priority')) infoRows.push([chalk.gray('Priority:'), formatPriority(task.priority)]);
  if (show('created_at')) infoRows.push([chalk.gray('Created:'), task.created_at]);
  if (show('updated_at')) infoRows.push([chalk.gray('Updated:'), task.updated_at]);
  if (show('completed_at') && task.completed_at) infoRows.push([chalk.gray('Completed:'), task.completed_at]);

  if (infoRows.length > 0) {
    const infoTable = new Table({ colWidths: [15, 50], wordWrap: true });
    for (const row of infoRows) infoTable.push(row);
    lines.push(infoTable.toString());
    lines.push('');
  }

  // Description
  if (show('description')) {
    lines.push(chalk.bold('Description:'));
    lines.push(task.description);
    lines.push('');
  }

  // Success criteria
  if (show('success_criteria') && task.success_criteria.length > 0) {
    lines.push(chalk.bold('Success Criteria:'));
    for (const sc of task.success_criteria) {
      const symbol = sc.completed ? chalk.green('✓') : chalk.gray('○');
      const idDisplay = chalk.gray(`(${sc.id.substring(0, 8)})`);
      lines.push(`  ${symbol} ${sc.text} ${idDisplay}`);
    }
    lines.push('');
  }

  // Deliverables
  if (show('deliverables') && task.deliverables.length > 0) {
    lines.push(chalk.bold('Deliverables:'));
    for (const d of task.deliverables) {
      const symbol = d.completed ? chalk.green('✓') : chalk.gray('○');
      const fileRef = d.file_path ? chalk.gray(` (${d.file_path})`) : '';
      const idDisplay = chalk.gray(`(${d.id.substring(0, 8)})`);
      lines.push(`  ${symbol} ${d.text}${fileRef} ${idDisplay}`);
    }
    lines.push('');
  }

  // Need Fix Items (blocking issues)
  if (show('need_fix') && task.need_fix.length > 0) {
    lines.push(chalk.bold('Need Fix:'));
    for (const nf of task.need_fix) {
      const symbol = nf.completed ? chalk.green('✓') : chalk.red('!');
      const sourceDisplay = nf.source ? chalk.yellow(` [${nf.source}]`) : '';
      const fileRef = nf.file_path ? chalk.gray(` (${nf.file_path})`) : '';
      const idDisplay = chalk.gray(`(${nf.id.substring(0, 8)})`);
      lines.push(`  ${symbol} ${nf.text}${sourceDisplay}${fileRef} ${idDisplay}`);
    }
    lines.push('');
  }

  // Relationships
  if (show('blockers') && task.blockers.length > 0) {
    lines.push(chalk.bold('Blocked by:'), chalk.cyan(task.blockers.join(', ')));
    lines.push('');
  }

  if (show('dependencies') && task.dependencies) {
    lines.push(chalk.bold('Dependencies:'), chalk.cyan(task.dependencies));
    lines.push('');
  }

  // Related files
  if (show('related_files') && task.related_files.length > 0) {
    lines.push(chalk.bold('Related Files:'));
    for (const file of task.related_files) {
      lines.push(`  - ${chalk.cyan(file)}`);
    }
    lines.push('');
  }

  // Notes
  if (show('notes') && task.notes) {
    lines.push(chalk.bold('Notes:'));
    lines.push(task.notes);
    lines.push('');
  }

  return lines.join('\n');
}
