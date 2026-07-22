/**
 * Panel command - Read-only overview of the current project and its subprojects.
 *
 * Provides a compact, real-time status summary so an Agent can grasp the
 * whole project context from a single command without truncated output.
 */

import { Command } from 'commander';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { getProjectPath, loadGraph, error, info, resolveOutputFormat } from '../utils/helpers.js';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { TaskStorage } from '../../core/storage/file-store.js';
import { isValidOctieProject } from '../../core/registry/index.js';

interface PanelSummary {
  name: string;
  path: string;
  isRoot: boolean;
  total: number;
  byStatus: Record<string, number>;
  completedPct: number;
  updatedAt: string;
  goal: string;
}

const ALL_STATUSES = ['ready', 'in_progress', 'in_review', 'completed', 'blocked'] as const;

/**
 * Aggregate tasks from a loaded graph into a panel summary.
 */
function summarizeGraph(
  graph: TaskGraphStore,
  name: string,
  projectPath: string,
  isRoot: boolean,
): PanelSummary {
  const tasks = graph.getAllTasks();
  const total = tasks.length;
  const byStatus: Record<string, number> = {};
  for (const status of ALL_STATUSES) {
    byStatus[status] = 0;
  }
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
  }
  const completed = byStatus.completed ?? 0;
  const completedPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  let goal = graph.metadata.description?.trim() || '';
  if (!goal) {
    const rootTasks = graph.getRootTasks();
    if (rootTasks.length > 0) {
      goal = rootTasks
        .map(id => graph.getNode(id)?.title)
        .filter(Boolean)
        .join('; ');
    }
  }
  if (!goal) {
    goal = '—';
  }

  return {
    name,
    path: projectPath,
    isRoot,
    total,
    byStatus,
    completedPct,
    updatedAt: graph.metadata.updated_at || '—',
    goal,
  };
}

/**
 * Discover immediate subprojects under .octie/subprojects/.
 */
function discoverSubprojects(projectPath: string): Array<{ name: string; path: string }> {
  const subprojectsDir = join(projectPath, '.octie', 'subprojects');
  if (!existsSync(subprojectsDir)) {
    return [];
  }

  const result: Array<{ name: string; path: string }> = [];
  for (const entry of readdirSync(subprojectsDir)) {
    const entryPath = join(subprojectsDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const subprojectPath = join(entryPath);
    if (isValidOctieProject(subprojectPath)) {
      result.push({ name: entry, path: subprojectPath });
    }
  }

  return result;
}

/**
 * Render a compact status badge string.
 */
function statusBadge(status: string, count: number): string {
  if (count === 0) {
    return chalk.gray(`${status}:0`);
  }
  const plain = status.replace('_', ' ');
  const colorMap: Record<string, (s: string) => string> = {
    ready: chalk.cyan,
    in_progress: chalk.blue,
    in_review: chalk.magenta,
    completed: chalk.green,
    blocked: chalk.red,
  };
  const colorFn = colorMap[status] || chalk.white;
  return colorFn(`${plain}:${count}`);
}

/**
 * Render the summary as a compact block list so nothing is truncated.
 */
function renderTable(summaries: PanelSummary[]): string {
  const lines: string[] = [];

  for (const s of summaries) {
    const name = s.isRoot ? chalk.bold(s.name) : s.name;
    const pct = `${s.completedPct}%`;
    const pctColored = s.completedPct === 100 ? chalk.green(pct) : chalk.yellow(pct);
    const updated = s.updatedAt !== '—' ? new Date(s.updatedAt).toLocaleString() : '—';
    const statusParts = ALL_STATUSES.map(status => statusBadge(status, s.byStatus[status] ?? 0));

    lines.push(`${name}  ${pctColored}  ${updated}`);
    lines.push(`  tasks: ${statusParts.join(' ')} (${s.total} total)`);
    lines.push(`  goal:  ${s.goal}`);
  }

  return lines.join('\n');
}

/**
 * Render the summary as JSON.
 */
function renderJSON(summaries: PanelSummary[]): string {
  return JSON.stringify(
    summaries.map(s => ({
      name: s.name,
      isRoot: s.isRoot,
      path: s.path,
      total: s.total,
      completedPct: s.completedPct,
      updatedAt: s.updatedAt,
      goal: s.goal,
      statusCounts: s.byStatus,
    })),
    null,
    2,
  );
}

/**
 * Render the summary as Markdown.
 */
function renderMarkdown(summaries: PanelSummary[]): string {
  const lines: string[] = ['# Octie Panel Summary\n'];
  lines.push('| Panel | Total | Done | Updated | Goal |');
  lines.push('|-------|-------|------|---------|------|');

  for (const s of summaries) {
    const statusList = ALL_STATUSES
      .map(status => `${status.replace('_', ' ')}: ${s.byStatus[status] ?? 0}`)
      .join(', ');
    const name = s.isRoot ? `**${s.name}**` : s.name;
    lines.push(
      `| ${name} | ${s.total} (${statusList}) | ${s.completedPct}% | ${s.updatedAt} | ${s.goal} |`,
    );
  }

  return lines.join('\n');
}

/**
 * Create the panel command.
 */
export const panelCommand = new Command('panel')
  .description('Show a read-only overview of the current project and its subprojects')
  .addHelpText(
    'after',
    `
Examples:
  $ octie panel                       Show panel summary for the current project
  $ octie --project ./my-app panel    Show panel summary for a specific project
  $ octie --format json panel         Output as JSON for Agents
  $ octie --format md panel           Output as Markdown for reports
`,
  )
  .action(async (_options, command) => {
    try {
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);
      const format = resolveOutputFormat(command, projectPath);

      // Load root project.
      const rootStorage = new TaskStorage({ projectDir: projectPath });
      if (!(await rootStorage.exists())) {
        throw new Error(`No Octie project found at ${projectPath}`);
      }
      const rootGraph = await loadGraph(projectPath);
      const summaries: PanelSummary[] = [
        summarizeGraph(rootGraph, rootGraph.metadata.project_name || 'root', projectPath, true),
      ];

      // Discover and load subprojects.
      const warnings: string[] = [];
      for (const { name, path: subprojectPath } of discoverSubprojects(projectPath)) {
        try {
          const graph = await loadGraph(subprojectPath);
          summaries.push(summarizeGraph(graph, name, subprojectPath, false));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          warnings.push(`Skipped subproject "${name}": ${message}`);
        }
      }

      // Render output.
      switch (format) {
        case 'json':
          console.log(renderJSON(summaries));
          break;
        case 'md':
          console.log(renderMarkdown(summaries));
          break;
        case 'table':
        default: {
          const totalTasks = summaries.reduce((sum, s) => sum + s.total, 0);
          console.log(chalk.bold('Octie Panels'));
          console.log('');
          console.log(renderTable(summaries));
          console.log(
            chalk.gray(
              `Total: ${summaries.length} panel${summaries.length !== 1 ? 's' : ''} (${totalTasks} task${totalTasks !== 1 ? 's' : ''})`,
            ),
          );
          break;
        }
      }

      // Emit warnings after primary output so they do not truncate context.
      if (warnings.length > 0) {
        console.log('');
        for (const warning of warnings) {
          info(warning);
        }
      }

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to load panel summary');
      }
      process.exit(1);
    }
  });
