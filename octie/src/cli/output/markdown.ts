/**
 * Markdown output formatters for tasks and projects
 */

import { TaskNode } from '../../core/models/task-node.js';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { formatStatus, formatPriority } from '../utils/helpers.js';

/**
 * Format a single task as markdown
 * Format: ## [ ] Title: Description
 */
export function formatTaskMarkdown(task: TaskNode): string {
  const lines: string[] = [];

  // Header with checkbox
  const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
  const statusIndicator = formatStatus(task.status);
  const priorityIndicator = formatPriority(task.priority);

  lines.push(`## ${checkbox} ${task.title}`);
  lines.push('');
  lines.push(`**ID**: \`${task.id}\` | **Status**: ${statusIndicator} | **Priority**: ${priorityIndicator}`);
  lines.push('');

  // Description
  lines.push('### Description');
  lines.push(task.description);
  lines.push('');

  // Success Criteria
  if (task.success_criteria.length > 0) {
    lines.push('### Success Criteria');
    for (const sc of task.success_criteria) {
      const scCheckbox = sc.completed ? '[x]' : '[ ]';
      // Export FULL UUID for import preservation (decoupled from GET display which uses short IDs)
      const idDisplay = `\`${sc.id}\``;
      lines.push(`- ${scCheckbox} ${sc.text} ${idDisplay}`);
      if (sc.completed && sc.completed_at) {
        lines.push(`  - Completed: ${sc.completed_at}`);
      }
      if (sc.evidence) {
        lines.push(`  - Evidence: ${sc.evidence}`);
      }
    }
    lines.push('');
  }

  // Deliverables
  if (task.deliverables.length > 0) {
    lines.push('### Deliverables');
    for (const d of task.deliverables) {
      const dCheckbox = d.completed ? '[x]' : '[ ]';
      const fileRef = d.file_path ? ` → \`${d.file_path}\`` : '';
      // Export FULL UUID for import preservation (decoupled from GET display which uses short IDs)
      const idDisplay = `\`${d.id}\``;
      lines.push(`- ${dCheckbox} ${d.text}${fileRef} ${idDisplay}`);
    }
    lines.push('');
  }

  // Need Fix Items (blocking issues)
  if (task.need_fix.length > 0) {
    lines.push('### Need Fix');
    for (const nf of task.need_fix) {
      const nfCheckbox = nf.completed ? '[x]' : '[ ]';
      const idDisplay = `\`${nf.id}\``;
      const sourceDisplay = nf.source ? ` [${nf.source}]` : '';
      const fileRef = nf.file_path ? ` → \`${nf.file_path}\`` : '';
      lines.push(`- ${nfCheckbox} ${nf.text}${sourceDisplay}${fileRef} ${idDisplay}`);
    }
    lines.push('');
  }

  // Blockers (with #task-id format)
  if (task.blockers.length > 0) {
    lines.push('### Blockers');
    for (const blockerId of task.blockers) {
      lines.push(`- #${blockerId}`);
    }
    lines.push('');
  }

  // Dependencies (explanatory text - twin to blockers)
  if (task.dependencies) {
    lines.push('### Dependencies');
    lines.push(task.dependencies);
    lines.push('');
  }

  // Sub-items
  if (task.sub_items.length > 0) {
    lines.push('### Sub-items');
    for (const subItemId of task.sub_items) {
      lines.push(`- #${subItemId}`);
    }
    lines.push('');
  }

  // Related Files
  if (task.related_files.length > 0) {
    lines.push('### Related Files');
    for (const file of task.related_files) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  // C7 MCP Verifications
  if (task.c7_verified.length > 0) {
    lines.push('### Library Verifications');
    for (const c7 of task.c7_verified) {
      lines.push(`- ${c7.library_id} (verified: ${c7.verified_at})`);
      if (c7.notes) {
        lines.push(`  - ${c7.notes}`);
      }
    }
    lines.push('');
  }

  // Notes
  if (task.notes) {
    lines.push('### Notes');
    lines.push(task.notes);
    lines.push('');
  }

  // Timestamps
  lines.push('---');
  lines.push(`**Created**: ${task.created_at}`);
  lines.push(`**Updated**: ${task.updated_at}`);

  if (task.completed_at) {
    lines.push(`**Completed**: ${task.completed_at}`);
  }

  return lines.join('\n');
}

/**
 * Format entire project as markdown for AI consumption
 */
export function formatProjectMarkdown(graph: TaskGraphStore): string {
  const lines: string[] = [];

  const metadata = graph.metadata;
  const taskCount = graph.size;

  // Project header
  lines.push(`# ${metadata.project_name}`);
  lines.push('');
  lines.push(`**Version**: ${metadata.version}`);
  lines.push(`**Tasks**: ${taskCount}`);
  lines.push(`**Exported**: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Tasks list summary
  const tasks = graph.getAllTasks();
  const rootTasks = graph.getRootTasks();

  lines.push(`## Tasks Summary (${tasks.length} tasks)`);
  lines.push('');

  // Group by status
  const byStatus: Record<string, string[]> = {
    ready: [],
    in_progress: [],
    in_review: [],
    blocked: [],
    completed: [],
  };

  for (const task of tasks) {
    const statusArray = byStatus[task.status as keyof typeof byStatus];
    if (statusArray) {
      statusArray.push(task.id);
    }
  }

  for (const [status, taskIds] of Object.entries(byStatus)) {
    if (taskIds.length > 0) {
      const statusLabel = formatStatus(status as any); // Type assertion for status
      lines.push(`### ${statusLabel} (${taskIds.length})`);
      for (const taskId of taskIds) {
        const task = graph.getNode(taskId);
        if (task) {
          const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
          lines.push(`- ${checkbox} **${task.title}** (#${taskId})`);
        }
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  // Root tasks (entry points)
  lines.push(`## Root Tasks (${rootTasks.length} tasks with no blockers)`);
  lines.push('');
  for (const rootId of rootTasks) {
    const task = graph.getNode(rootId);
    if (task) {
      const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} **${task.title}** (#${rootId})`);
    } else {
      lines.push(`- Missing task #${rootId}`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('');

  // Full task details
  lines.push(`## Task Details`);
  lines.push('');

  // Sort by topological order if possible, otherwise by created_at
  let sortedTasks = [...tasks];
  try {
    // Try to get topological sort
    // For now, sort by created_at
    sortedTasks.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch {
    // Fall back to unsorted
  }

  for (const task of sortedTasks) {
    lines.push(formatTaskMarkdown(task));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
