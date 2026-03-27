/**
 * History commands - immutable snapshot history inspection and restore.
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import type { SnapshotHistoryEntry } from '../../types/index.js';
import { TaskStorage } from '../../core/storage/file-store.js';
import { getProjectPath, confirmPrompt, success, error, info } from '../utils/helpers.js';

function formatHistoryTable(entries: SnapshotHistoryEntry[]): string {
  if (entries.length === 0) {
    return chalk.yellow('No snapshot history found');
  }

  const table = new Table({
    head: [
      chalk.bold(chalk.gray('Snapshot ID')),
      chalk.bold(chalk.gray('Created')),
      chalk.bold(chalk.gray('Reason')),
      chalk.bold(chalk.gray('Tasks')),
      chalk.bold(chalk.gray('Edges')),
      chalk.bold(chalk.gray('Orphans')),
      chalk.bold(chalk.gray('Roots')),
    ],
    colWidths: [38, 26, 18, 8, 8, 10, 8],
    wordWrap: true,
  });

  for (const entry of entries) {
    table.push([
      entry.snapshot_id,
      entry.created_at,
      entry.reason,
      entry.task_count,
      entry.edge_count,
      entry.orphan_count,
      entry.root_count,
    ]);
  }

  return table.toString();
}

function formatHistoryMarkdown(entries: SnapshotHistoryEntry[]): string {
  if (entries.length === 0) {
    return '# Snapshot History (0)\n';
  }

  const lines: string[] = ['# Snapshot History', '', `Snapshots: ${entries.length}`, ''];
  for (const entry of entries) {
    lines.push(`## ${entry.snapshot_id}`);
    lines.push('');
    lines.push(`- Created: ${entry.created_at}`);
    lines.push(`- Reason: ${entry.reason}`);
    lines.push(`- Source Command: ${entry.source_command}`);
    lines.push(`- Tasks: ${entry.task_count}`);
    lines.push(`- Edges: ${entry.edge_count}`);
    lines.push(`- Orphans: ${entry.orphan_count}`);
    lines.push(`- Roots: ${entry.root_count}`);
    lines.push(`- Has Cycle: ${entry.has_cycle}`);
    if (entry.restored_from_snapshot_id) {
      lines.push(`- Restored From: ${entry.restored_from_snapshot_id}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function outputHistory(entries: SnapshotHistoryEntry[], format: string): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(entries, null, 2));
      break;
    case 'md':
      console.log(formatHistoryMarkdown(entries));
      break;
    case 'table':
    default:
      console.log(formatHistoryTable(entries));
      break;
  }
}

export const historyCommand = new Command('history')
  .description('Inspect and restore immutable snapshot history');

historyCommand
  .command('list')
  .description('List snapshot history entries')
  .addHelpText(
    'after',
    `
Examples:
  $ octie history list
  $ octie history list --format md
  $ octie history list --format json
`,
  )
  .action(async (_options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const format = globalOpts.format || 'table';
      const projectPath = await getProjectPath(globalOpts.project);
      const storage = new TaskStorage({ projectDir: projectPath });
      const entries = await storage.listHistory();

      outputHistory(entries, format);
      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to list snapshot history');
      }
      process.exit(1);
    }
  });

historyCommand
  .command('restore')
  .description('Restore a live project.json from an immutable snapshot')
  .argument('<snapshot-id>', 'Full snapshot ID to restore')
  .option('--force', 'Skip restore confirmation prompt')
  .addHelpText(
    'after',
    `
Examples:
  $ octie history restore <snapshot-id>
  $ octie history restore <snapshot-id> --force

Behavior:
  • Creates a pre_restore snapshot of the current live state before replacing project.json
  • Keeps legacy .bak writes as a low-level safety net during the restore write
`,
  )
  .action(async (snapshotId: string, options, command) => {
    try {
      const globalOpts = command.parent?.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const storage = new TaskStorage({ projectDir: projectPath });
      const entries = await storage.listHistory();
      const entry = entries.find(item => item.snapshot_id === snapshotId);

      if (!entry) {
        error(`Snapshot not found: ${snapshotId}`);
        process.exit(1);
      }

      if (!options.force) {
        console.log(chalk.bold('Restore Snapshot'));
        console.log(chalk.gray(`Snapshot ID: ${entry.snapshot_id}`));
        console.log(chalk.gray(`Created: ${entry.created_at}`));
        console.log(chalk.gray(`Reason: ${entry.reason}`));
        console.log(chalk.gray(`Tasks: ${entry.task_count} | Edges: ${entry.edge_count} | Orphans: ${entry.orphan_count} | Roots: ${entry.root_count}`));
        console.log('');

        const confirmed = await confirmPrompt(chalk.yellow('Restore this snapshot? (y/N)'));
        if (!confirmed) {
          info('Restore cancelled');
          process.exit(0);
        }
      }

      await storage.restoreSnapshot(snapshotId, {
        sourceCommand: 'octie history restore',
      });

      success(`Restored snapshot: ${snapshotId}`);
      info('A pre_restore snapshot of the previous live state was recorded before the restore.');
      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to restore snapshot');
      }
      process.exit(1);
    }
  });
