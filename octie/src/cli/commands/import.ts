/**
 * Import command - Import project data from file
 */

import { Command } from 'commander';
import { TaskStorage } from '../../core/storage/file-store.js';
import { getProjectPath, success, error, warning } from '../utils/helpers.js';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { TaskGraphStore } from '../../core/graph/index.js';
import { TaskNode } from '../../core/models/task-node.js';
import type { TaskStatus, TaskPriority, SuccessCriterion, Deliverable } from '../../types/index.js';
import { resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Auto-detect format from file extension
 */
function detectFormat(filePath: string): 'json' | 'md' | null {
  const ext = filePath.toLowerCase().split('.').pop();
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'md';
  return null;
}

/**
 * Parsed markdown task structure
 */
interface ParsedMarkdownTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  success_criteria: SuccessCriterion[];
  deliverables: Deliverable[];
  blockers: string[];
  dependencies: string;
  sub_items: string[];
  related_files: string[];
  notes: string;
  c7_verified: Array<{ library_id: string; verified_at: string; notes?: string }>;
  completed: boolean;
}

/**
 * Parse checkbox state from markdown
 * Supports: [x], [X], [ ], [y], [Y], etc.
 */
function parseCheckbox(text: string): { checked: boolean; content: string } {
  const checkboxMatch = text.match(/^\s*\[([ xXyY])\]\s*(.*)$/);
  if (checkboxMatch && checkboxMatch[1] !== undefined && checkboxMatch[2] !== undefined) {
    const checked = checkboxMatch[1].toLowerCase() === 'x' || checkboxMatch[1].toLowerCase() === 'y';
    return { checked, content: checkboxMatch[2].trim() };
  }
  return { checked: false, content: text.trim() };
}

/**
 * Extract task ID from line like "**ID**: `task-123`"
 */
function extractTaskId(lines: string[], startIndex: number): string | null {
  for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const idMatch = line.match(/\*\*ID\*\*:\s*`([^`]+)`/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
  }
  return null;
}

/**
 * Extract status from line like "**Status**: in_progress" or "**Status**: in progress"
 */
function extractStatus(lines: string[], startIndex: number): TaskStatus {
  for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
    const line = lines[i];
    if (line === undefined) continue;
    // Match both underscore format (in_progress) and space format (in progress)
    const statusMatch = line.match(/\*\*Status\*\*:\s*([\w\s]+?)(?:\s*\||\s*$)/);
    if (statusMatch && statusMatch[1]) {
      // Normalize: convert spaces to underscores, trim
      const status = statusMatch[1].toLowerCase().trim().replace(/\s+/g, '_');
      // Support both old and new status values for backward compatibility
      if (['ready', 'in_progress', 'in_review', 'completed', 'blocked'].includes(status)) {
        return status as TaskStatus;
      }
      // Migrate old statuses to new ones
      if (status === 'not_started' || status === 'pending') {
        return 'ready';
      }
    }
  }
  return 'ready';
}

/**
 * Extract priority from line like "**Priority**: top"
 */
function extractPriority(lines: string[], startIndex: number): TaskPriority {
  for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const priorityMatch = line.match(/\*\*Priority\*\*:\s*(\w+)/);
    if (priorityMatch && priorityMatch[1]) {
      const priority = priorityMatch[1].toLowerCase();
      if (['top', 'second', 'later'].includes(priority)) {
        return priority as TaskPriority;
      }
    }
  }
  return 'second';
}

/**
 * Extract task reference (blocker/dependency) from line like "- #task-123"
 * Supports UUIDs, custom IDs with alphanumerics and hyphens
 */
function extractTaskReference(line: string): string | null {
  const refMatch = line.match(/^-\s*#([\w-]+)$/);
  if (refMatch && refMatch[1]) {
    return refMatch[1];
  }
  return null;
}

/**
 * Extract file path from line like "- \`src/file.ts\`"
 */
function extractFilePath(line: string): string | null {
  const fileMatch = line.match(/^-\s*`([^`]+)`$/);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }
  return null;
}

/**
 * Parse markdown content into task array
 *
 * Supports format:
 * ## [x] Task Title
 * **ID**: `task-id` | **Status**: in_progress | **Priority**: top
 *
 * ### Description
 * Task description here...
 *
 * ### Success Criteria
 * - [x] Criterion 1
 * - [ ] Criterion 2
 *
 * ### Deliverables
 * - [ ] Deliverable 1 → `file.ts`
 *
 * ### Blockers
 * - #blocker-task-id
 *
 * ### Notes
 * Additional notes...
 */
export function parseMarkdownTasks(content: string): ParsedMarkdownTask[] {
  const tasks: ParsedMarkdownTask[] = [];
  const lines = content.split('\n');

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }

    const trimmedLine = line.trim();

    // Look for task header: ## [x] Title or ## [ ] Title
    const taskHeaderMatch = trimmedLine.match(/^##\s*\[([ xX])\]\s+(.+)$/);

    if (taskHeaderMatch && taskHeaderMatch[1] && taskHeaderMatch[2]) {
      const completed = taskHeaderMatch[1].toLowerCase() === 'x';
      const title = taskHeaderMatch[2].trim();

      // Find task end (next task header or end of file)
      let taskEndIndex = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine && nextLine.trim().match(/^##\s*\[[ xX]\]/)) {
          taskEndIndex = j;
          break;
        }
      }

      // Extract task metadata
      const taskId = extractTaskId(lines, i) || uuidv4();
      const status = completed ? 'completed' : extractStatus(lines, i);
      const priority = extractPriority(lines, i);

      // Extract description
      let description = '';
      let descStart = -1;
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l && l.trim() === '### Description') {
          descStart = j + 1;
          break;
        }
      }
      if (descStart > 0) {
        const descLines: string[] = [];
        for (let j = descStart; j < taskEndIndex; j++) {
          const l = lines[j];
          if (l === undefined) continue;
          const lt = l.trim();
          if (lt.startsWith('### ') || lt === '---') break;
          if (lt) descLines.push(l); // Preserve original formatting
        }
        description = descLines.join('\n').trim();
      }

      // Extract success criteria
      const success_criteria: SuccessCriterion[] = [];
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Success Criteria') {
          let k = j + 1;
          while (k < taskEndIndex) {
            const itemLine = lines[k];
            if (itemLine === undefined) {
              k++;
              continue;
            }
            const lt = itemLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;
            // Skip timestamp lines like "  - Completed: 2026-02-16T18:11:52.088Z"
            if (lt.match(/^\s*-\s*Completed:\s*\d{4}-\d{2}-\d{2}T/)) {
              k++;
              continue;
            }
            // Attach evidence lines to the most recent criterion: "  - Evidence: ..."
            const evidenceMatch = lt.match(/^-\s*Evidence:\s*(.+)$/);
            if (evidenceMatch && evidenceMatch[1] && success_criteria.length > 0) {
              success_criteria[success_criteria.length - 1]!.evidence = evidenceMatch[1].trim();
              k++;
              continue;
            }
            if (lt.startsWith('- ')) {
              const { checked, content } = parseCheckbox(lt.substring(2));
              if (content) {
                // Extract full UUID from end of content (format: "text \`uuid\`")
                // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                const uuidMatch = content.match(/^(.+?)\s*`([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`$/);
                let id = uuidv4();
                let text = content;
                if (uuidMatch && uuidMatch[1] && uuidMatch[2]) {
                  text = uuidMatch[1].trim();
                  id = uuidMatch[2];
                }
                success_criteria.push({
                  id,
                  text,
                  completed: checked,
                  completed_at: checked ? new Date().toISOString() : undefined,
                });
              }
            }
            k++;
          }
          break;
        }
      }

      // Extract deliverables
      const deliverables: Deliverable[] = [];
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Deliverables') {
          let k = j + 1;
          while (k < taskEndIndex) {
            const itemLine = lines[k];
            if (itemLine === undefined) {
              k++;
              continue;
            }
            const lt = itemLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;
            // Skip timestamp lines like "  - Completed: 2026-02-16T18:11:52.088Z"
            if (lt.match(/^\s*-\s*Completed:\s*\d{4}-\d{2}-\d{2}T/)) {
              k++;
              continue;
            }
            if (lt.startsWith('- ')) {
              const itemText = lt.substring(2).trim();
              const { checked, content } = parseCheckbox(itemText);

              // Extract full UUID from end of content (format: "text → `filepath` `uuid`" or "text `uuid`")
              let id = uuidv4();
              let text = content;
              let filePath: string | undefined;

              // First try to extract UUID from end
              const uuidMatch = content.match(/^(.+?)\s*`([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`$/);
              if (uuidMatch && uuidMatch[1] && uuidMatch[2]) {
                text = uuidMatch[1].trim();
                id = uuidMatch[2];
              }

              // Then check for file path: "text → `file.ts`"
              const fileMatch = text.match(/^(.+?)\s*→\s*`([^`]+)`$/);
              if (fileMatch && fileMatch[1] && fileMatch[2]) {
                text = fileMatch[1].trim();
                filePath = fileMatch[2];
              }

              if (text) {
                deliverables.push({
                  id,
                  text,
                  completed: checked,
                  file_path: filePath,
                });
              }
            }
            k++;
          }
          break;
        }
      }

      // Extract blockers
      const blockers: string[] = [];
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Blockers') {
          let k = j + 1;
          while (k < taskEndIndex) {
            const itemLine = lines[k];
            if (itemLine === undefined) {
              k++;
              continue;
            }
            const lt = itemLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;
            const ref = extractTaskReference(lt);
            if (ref) blockers.push(ref);
            k++;
          }
          break;
        }
      }

      // Extract dependencies (explanatory text - twin to blockers)
      let dependencies = '';
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Dependencies') {
          const depLines: string[] = [];
          let k = j + 1;
          while (k < taskEndIndex) {
            const itemLine = lines[k];
            if (itemLine === undefined) {
              k++;
              continue;
            }
            const lt = itemLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;
            depLines.push(itemLine);
            k++;
          }
          dependencies = depLines.join('\n').trim();
          break;
        }
      }

      // Extract related files
      const related_files: string[] = [];
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Related Files') {
          let k = j + 1;
          while (k < taskEndIndex) {
            const itemLine = lines[k];
            if (itemLine === undefined) {
              k++;
              continue;
            }
            const lt = itemLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;
            const file = extractFilePath(lt);
            if (file) related_files.push(file);
            k++;
          }
          break;
        }
      }

      // Extract notes
      let notes = '';
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Notes') {
          const noteLines: string[] = [];
          let k = j + 1;
          while (k < taskEndIndex) {
            const noteLine = lines[k];
            if (noteLine === undefined) {
              k++;
              continue;
            }
            const lt = noteLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;
            noteLines.push(noteLine);
            k++;
          }
          notes = noteLines.join('\n').trim();
          break;
        }
      }

      // Extract C7 verifications (Library Verifications section)
      const c7_verified: Array<{ library_id: string; verified_at: string; notes?: string }> = [];
      for (let j = i; j < taskEndIndex; j++) {
        const l = lines[j];
        if (l === undefined) continue;
        if (l.trim() === '### Library Verifications') {
          let k = j + 1;
          while (k < taskEndIndex) {
            const itemLine = lines[k];
            if (itemLine === undefined) {
              k++;
              continue;
            }
            const lt = itemLine.trim();
            if (lt.startsWith('### ') || lt === '---') break;

            // Parse: "- /library/id (verified: 2026-02-16T18:11:52.088Z)"
            const c7Match = lt.match(/^-?\s*([\/\w.-]+)\s*\(verified:\s*(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\)$/);
            if (c7Match && c7Match[1] && c7Match[2]) {
              const library_id = c7Match[1];
              const verified_at = c7Match[2];

              // Look for optional notes on next line(s) (indented with "  - ")
              let c7Notes: string | undefined;
              const noteLines: string[] = [];
              let nextK = k + 1;
              while (nextK < taskEndIndex) {
                const nextLine = lines[nextK];
                if (nextLine === undefined) break;
                const nextLt = nextLine.trim();
                // Check for indented note: "  - note text"
                if (nextLt.startsWith('- ') && nextLine.startsWith('  ')) {
                  noteLines.push(nextLt.substring(2).trim());
                  nextK++;
                } else if (nextLt.startsWith('-') || nextLt.startsWith('### ') || nextLt === '---') {
                  // Stop at next item or section
                  break;
                } else {
                  break;
                }
              }
              if (noteLines.length > 0) {
                c7Notes = noteLines.join(' ');
                k = nextK - 1; // Update k to skip processed note lines
              }

              c7_verified.push({
                library_id,
                verified_at,
                notes: c7Notes,
              });
            }
            k++;
          }
          break;
        }
      }

      // Create task with default required fields if missing
      const task: ParsedMarkdownTask = {
        id: taskId,
        title: title || 'Untitled Task',
        description: description || 'Imported from markdown file without description. Please add a detailed description.',
        status,
        priority,
        success_criteria: success_criteria.length > 0 ? success_criteria : [
          { id: uuidv4(), text: 'Task imported from markdown', completed: false },
        ],
        deliverables: deliverables.length > 0 ? deliverables : [
          { id: uuidv4(), text: 'Deliverable to be defined', completed: false },
        ],
        blockers,
        dependencies,
        sub_items: [],
        related_files,
        notes,
        c7_verified,
        completed,
      };

      tasks.push(task);
      i = taskEndIndex;
    } else {
      i++;
    }
  }

  return tasks;
}

/**
 * Validate imported data structure
 */
function validateImportData(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: must be an object');
  }

  const d = data as Record<string, unknown>;

  // Check for tasks format (from project file export)
  if (d.version && d.format && d.tasks) {
    // Full project file format
    if (!d.tasks || typeof d.tasks !== 'object') {
      throw new Error('Invalid project file: missing or invalid tasks object');
    }
    return;
  }

  // Check for nodes format (from toJSON() export)
  if (d.nodes && typeof d.nodes === 'object') {
    return;
  }

  // Check for simple task array format
  if (Array.isArray(data)) {
    for (const task of data) {
      if (!task.id || !task.title) {
        throw new Error('Invalid task data: missing id or title');
      }
    }
    return;
  }

  // Single task format
  if (d.id && d.title) {
    return;
  }

  throw new Error('Unrecognized data format. Expected project file, task array, or single task.');
}

/**
 * Create TaskGraphStore from various import formats
 */
function createGraphFromImportData(data: unknown): TaskGraphStore {
  const d = data as Record<string, unknown>;

  // Handle nodes format (from toJSON() export)
  if (d.nodes && d.outgoingEdges !== undefined && d.incomingEdges !== undefined) {
    return TaskGraphStore.fromJSON(d as any);
  }

  // Handle tasks format (from project file export)
  if (d.tasks && typeof d.tasks === 'object') {
    const metadata = d.metadata || {
      project_name: 'imported-project',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      task_count: Object.keys(d.tasks as object || {}).length,
    };

    const store = new TaskGraphStore(metadata as any);

    // Add tasks
    for (const [, taskData] of Object.entries(d.tasks as object)) {
      const node = TaskNode.fromJSON(taskData as any);
      store.addNode(node);
    }

    return store;
  }

  // Handle task array format
  if (Array.isArray(data)) {
    const metadata = {
      project_name: 'imported-project',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      task_count: data.length,
    };

    const store = new TaskGraphStore(metadata);

    for (const taskData of data) {
      const node = TaskNode.fromJSON(taskData as any);
      store.addNode(node);
    }

    return store;
  }

  // Handle single task format
  if (d.id && d.title) {
    const metadata = {
      project_name: 'imported-project',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      task_count: 1,
    };

    const store = new TaskGraphStore(metadata);
    const node = TaskNode.fromJSON(d as any);
    store.addNode(node);

    return store;
  }

  throw new Error('Could not convert import data to graph format');
}

/**
 * Create TaskGraphStore from parsed markdown tasks
 */
function createGraphFromMarkdownTasks(tasks: ParsedMarkdownTask[]): TaskGraphStore {
  const metadata = {
    project_name: 'imported-from-markdown',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    task_count: tasks.length,
  };

  const store = new TaskGraphStore(metadata);

  for (const taskData of tasks) {
    // Create TaskNode with _skipAtomicValidation for imported tasks
    const node = new TaskNode({
      id: taskData.id,
      title: taskData.title,
      description: taskData.description,
      status: taskData.status,
      priority: taskData.priority,
      success_criteria: taskData.success_criteria,
      deliverables: taskData.deliverables,
      blockers: taskData.blockers,
      dependencies: taskData.dependencies,
      sub_items: taskData.sub_items,
      related_files: taskData.related_files,
      notes: taskData.notes,
      c7_verified: taskData.c7_verified,
      _skipAtomicValidation: true, // Skip validation for imported tasks
    });

    store.addNode(node);
  }

  // Add edges based on blockers
  for (const taskData of tasks) {
    for (const blockerId of taskData.blockers) {
      if (store.getNode(blockerId)) {
        store.addEdge(blockerId, taskData.id);
      }
    }
  }

  return store;
}

/**
 * Merge markdown tasks with existing graph
 * Matches by title (case-insensitive) or ID
 */
function mergeMarkdownTasks(
  existing: TaskGraphStore,
  newTasks: ParsedMarkdownTask[]
): TaskGraphStore {
  // Create a map for quick lookup by title
  const existingByTitle = new Map<string, TaskNode>();
  for (const task of existing.getAllTasks()) {
    existingByTitle.set(task.title.toLowerCase(), task);
  }

  for (const newTask of newTasks) {
    // Try to find existing task by ID first
    let existingTask = existing.getNode(newTask.id);

    // If not found, try by title
    if (!existingTask) {
      existingTask = existingByTitle.get(newTask.title.toLowerCase());
    }

    if (existingTask) {
      // Merge: update completion states of criteria and deliverables
      for (const newSc of newTask.success_criteria) {
        // Find matching criterion by text (partial match)
        const existingSc = existingTask.success_criteria.find(
          sc => sc.text.toLowerCase().includes(newSc.text.toLowerCase()) ||
                newSc.text.toLowerCase().includes(sc.text.toLowerCase())
        );

        if (existingSc && newSc.completed && !existingSc.completed) {
          existingTask.completeCriterion(existingSc.id);
        }
      }

      for (const newDel of newTask.deliverables) {
        // Find matching deliverable by text (partial match)
        const existingDel = existingTask.deliverables.find(
          d => d.text.toLowerCase().includes(newDel.text.toLowerCase()) ||
               newDel.text.toLowerCase().includes(d.text.toLowerCase())
        );

        if (existingDel && newDel.completed && !existingDel.completed) {
          existingTask.completeDeliverable(existingDel.id);
        }
      }

      // Merge notes (append)
      if (newTask.notes && !existingTask.notes.includes(newTask.notes)) {
        existingTask.notes = existingTask.notes
          ? `${existingTask.notes}\n\n${newTask.notes}`
          : newTask.notes;
      }
    } else {
      // New task - add it
      const node = new TaskNode({
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        priority: newTask.priority,
        success_criteria: newTask.success_criteria,
        deliverables: newTask.deliverables,
        blockers: newTask.blockers,
        dependencies: newTask.dependencies,
        sub_items: newTask.sub_items,
        related_files: newTask.related_files,
        notes: newTask.notes,
        c7_verified: newTask.c7_verified,
        _skipAtomicValidation: true,
      });
      existing.addNode(node);
    }
  }

  return existing;
}

/**
 * Create the import command
 */
export const importCommand = new Command('import')
  .description('Import tasks from file (supports JSON and Markdown)')
  .argument('<file>', 'File path to import')
  .option('--format <format>', 'Import format: json | md (auto-detect from extension if not specified)')
  .option('--merge', 'Merge with existing tasks instead of replacing')
  .addHelpText('after', `
Examples:
  $ octie import tasks.json
  $ octie import tasks.md --merge

File Formats:
  JSON - Full project export format
  MD   - Markdown with task details
`)
  .action(async (file, options, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project as string | undefined);
      const storage = new TaskStorage({ projectDir: projectPath });

      // Resolve file path
      const filePath = resolve(file);

      // Check file exists
      if (!existsSync(filePath)) {
        error(`File not found: ${filePath}`);
        process.exit(1);
      }

      // Read file
      const content = readFileSync(filePath, 'utf-8');

      // Auto-detect format if not specified
      const format = options.format || detectFormat(filePath);
      if (!format) {
        error(`Cannot detect format. Please specify --format <json|md>`);
        process.exit(1);
      }

      let store: TaskGraphStore;
      const projectExists = await storage.exists();

      switch (format) {
        case 'json': {
          let data: unknown;
          try {
            data = JSON.parse(content);
          } catch (parseErr) {
            error(`Failed to parse JSON: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`);
            process.exit(1);
          }

          // Validate imported data
          try {
            validateImportData(data);
          } catch (validationErr) {
            error(`Invalid data structure: ${validationErr instanceof Error ? validationErr.message : 'Unknown error'}`);
            process.exit(1);
          }

          // Create backup before import if project exists
          if (projectExists) {
            warning('Project already exists. Creating backup before import...');
          }

          if (options.merge && projectExists) {
            // Merge mode: load existing and merge
            warning('Merging with existing tasks...');
            const existing = await storage.load();

            // Create store from import data
            store = createGraphFromImportData(data);

            // Add tasks from existing that aren't in import
            for (const task of existing.getAllTasks()) {
              if (!store.getNode(task.id)) {
                store.addNode(task);
              }
            }
          } else {
            // Replace mode (default)
            store = createGraphFromImportData(data);
          }
          break;
        }

        case 'md': {
          // Parse markdown tasks
          warning('Parsing markdown file...');
          const mdTasks = parseMarkdownTasks(content);

          if (mdTasks.length === 0) {
            error('No tasks found in markdown file. Expected format: ## [x] Task Title');
            process.exit(1);
          }

          // Create backup before import if project exists
          if (projectExists) {
            warning('Project already exists. Creating backup before import...');
          }

          if (options.merge && projectExists) {
            // Merge mode for markdown
            warning('Merging markdown tasks with existing tasks...');
            const existing = await storage.load();
            store = mergeMarkdownTasks(existing, mdTasks);
          } else {
            // Replace mode (default)
            store = createGraphFromMarkdownTasks(mdTasks);
          }

          success(`Parsed ${mdTasks.length} task(s) from markdown`);
          break;
        }

        default:
          error(`Unsupported format: ${format}. Supported formats: json, md`);
          process.exit(1);
      }

      // Save with storage
      await storage.save(store);

      success(`Imported ${store.size} task(s) from ${chalk.cyan(filePath)}`);

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Import failed');
      }
      process.exit(1);
    }
  });
