/**
 * Shared helpers for command preflight and execution.
 *
 * These helpers keep command actions thin and allow composed flows
 * like `handoff create` to reuse the exact init/create behavior.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { Command, Option } from 'commander';
import { loadRegistry, registerProject } from '../../core/registry/index.js';
import type { ProjectRegistry } from '../../core/registry/index.js';
import { touchProject } from '../../core/registry/index.js';
import { TaskNode } from '../../core/models/task-node.js';
import type {
  C7Verification,
  TaskPriority,
} from '../../types/index.js';
import { TaskStorage } from '../../core/storage/file-store.js';
import type { TaskGraphStore } from '../../core/graph/index.js';
import { parseList, saveGraph } from '../utils/helpers.js';

const DEFAULT_OCTIE_SERVER_URL = 'http://localhost:3000';
const DEFAULT_CACHE_INVALIDATION_TIMEOUT_MS = 750;

export class CliPreparationError extends Error {
  readonly infoMessages: string[];

  constructor(message: string, infoMessages: string[] = []) {
    super(message);
    this.name = 'CliPreparationError';
    this.infoMessages = infoMessages;
  }
}

export function addTaskCreationOptions<T extends Command>(command: T): T {
  return command
    .addOption(
      new Option('--title <string>', 'Task title (max 200 chars). Must contain action verb')
        .env('OCTIE_TASK_TITLE')
        .makeOptionMandatory(true),
    )
    .addOption(
      new Option(
        '--description <string>',
        'Detailed task description (min 50 chars, max 10000)',
      )
        .env('OCTIE_TASK_DESCRIPTION')
        .makeOptionMandatory(true),
    )
    .addOption(
      new Option(
        '--success-criterion <text>',
        'Quantitative success criterion (can be specified multiple times)',
      )
        .argParser((value: string, previous: string[]) => [...(previous || []), value])
        .env('OCTIE_SUCCESS_CRITERION')
        .makeOptionMandatory(true),
    )
    .addOption(
      new Option(
        '--deliverable <text>',
        'Specific output expected (can be specified multiple times)',
      )
        .argParser((value: string, previous: string[]) => [...(previous || []), value])
        .env('OCTIE_DELIVERABLE')
        .makeOptionMandatory(true),
    )
    .option('-p, --priority <level>', 'Task priority: top | second | later', 'second')
    .option(
      '-b, --blockers <ids>',
      'Comma-separated task IDs that block this task (creates graph edges for execution order)',
    )
    .option(
      '-d, --dependency-explanation <text>',
      'Explanatory text: WHY this task depends on its blockers (required if --blockers is set)',
    )
    .addOption(
      new Option('--dependencies <text>')
        .hideHelp(),
    )
    .addOption(
      new Option(
        '-f, --related-files <paths>',
        'File paths relevant to task (can be specified multiple times or comma-separated)',
      ).argParser((value: string, previous: string[]) => {
        const items = value.includes(',') ? value.split(',').map(item => item.trim()) : [value.trim()];
        return [...(previous || []), ...items.filter(Boolean)];
      }),
    )
    .addOption(
      new Option(
        '-c, --c7-verified <library:notes>',
        'C7 library verification (format: library-id or library-id:notes, can be specified multiple times)',
      ).argParser((value: string, previous: string[]) => [...(previous || []), value]),
    )
    .addOption(
      new Option(
        '-n, --notes <text>',
        'Additional context or comments (can be specified multiple times)',
      ).argParser((value: string, previous: string[]) => [...(previous || []), value]),
    )
    .option('--notes-file <path>', 'Read notes from file (multi-line notes support)')
    .option('-i, --interactive', 'Interactive mode with prompts')
    .option('--project <path>', 'Path to Octie project directory');
}

export interface InitCommandOptions {
  name?: string;
}

export interface ValidatedInitRequest {
  projectName: string;
  projectPath: string;
  storage: TaskStorage;
  registry: ProjectRegistry;
}

export interface CreateCommandOptions {
  title?: string;
  description?: string;
  successCriterion?: string[];
  deliverable?: string[];
  priority?: string;
  blockers?: string;
  dependencyExplanation?: string;
  dependencies?: string;
  relatedFiles?: string[];
  c7Verified?: string[];
  notes?: string[];
  notesFile?: string;
}

export interface PreparedTaskCreation {
  task: TaskNode;
}

export function displayAtomicTaskPolicy(): void {
  console.log('');
  console.log('\x1b[31m\x1b[1m⚠️  ATOMIC TASK POLICY ⚠️\x1b[0m');
  console.log('');
  console.log('\x1b[33mTasks MUST be atomic - small, specific, executable, and verifiable.\x1b[0m');
  console.log('');
  console.log('\x1b[1mWhat is an Atomic Task?\x1b[0m');
  console.log('  • Single purpose: Does ONE thing well');
  console.log('  • Executable: Can be completed in 2-8 hours (typical) or 1-2 days (max)');
  console.log('  • Verifiable: Has quantitative success criteria');
  console.log('  • Independent: Minimizes dependencies on other tasks');
  console.log('');
  console.log('\x1b[31m\x1b[1m❌ BAD Examples (too vague or too large):\x1b[0m');
  console.log('\x1b[90m  • "Fix authentication" (too vague - what specifically?)\x1b[0m');
  console.log('\x1b[90m  • "Build auth system" (too large - split into: login, signup, password reset, etc.)\x1b[0m');
  console.log('\x1b[90m  • "Improve performance" (not measurable - what metric?)\x1b[0m');
  console.log('\x1b[90m  • "Code review" (not atomic - which files? what criteria?)\x1b[0m');
  console.log('');
  console.log('\x1b[32m\x1b[1m✅ GOOD Examples (atomic):\x1b[0m');
  console.log('\x1b[90m  • "Implement login endpoint with JWT" (specific, testable)\x1b[0m');
  console.log('\x1b[90m  • "Add bcrypt password hashing with 10 rounds" (clear, verifiable)\x1b[0m');
  console.log('\x1b[90m  • "Write unit tests for User model" (specific scope)\x1b[0m');
  console.log('\x1b[90m  • "Fix NPE in AuthService.login method" (atomic bug fix)\x1b[0m');
  console.log('');
  console.log('\x1b[1mValidation Rules:\x1b[0m');
  console.log('  • Title: 1-200 chars, must contain action verb');
  console.log('  • Description: 50-10000 chars, must be specific');
  console.log('  • Success Criteria: 1-10 items, must be quantitative');
  console.log('  • Deliverables: 1-10 items, must be specific outputs');
  console.log('');
  console.log('\x1b[33mIf your task is rejected as non-atomic:\x1b[0m');
  console.log('  → Split it into smaller, focused tasks');
  console.log('  → Be more specific about what will be done');
  console.log('  → Define measurable success criteria');
  console.log('  → Limit scope to 2-8 hours of work');
  console.log('');
}

export async function preflightProjectInit(
  projectPath: string,
  options: InitCommandOptions,
): Promise<ValidatedInitRequest> {
  const projectName = options.name?.trim();
  if (!projectName) {
    throw new CliPreparationError(
      'Project name is required. Use --name <name> to specify a unique project name.',
      ['Example: octie init --name my-project'],
    );
  }

  const registry = loadRegistry();
  const existing = Object.values(registry.projects).find(
    project => project.name === projectName,
  );
  if (existing) {
    throw new CliPreparationError(
      `Project with name '${projectName}' already exists.`,
      [
        `Existing project: ${existing.path}`,
        'Choose a different name using --name <different-name>',
      ],
    );
  }

  const storage = new TaskStorage({ projectDir: projectPath });
  if (await storage.exists()) {
    throw new CliPreparationError(
      'Octie project already exists at this location',
      ['Use --project <path> to specify a different location'],
    );
  }

  return {
    projectName,
    projectPath,
    storage,
    registry,
  };
}

export async function executeProjectInit(
  request: ValidatedInitRequest,
): Promise<void> {
  await request.storage.createProject(request.projectName);
  registerProject(request.projectPath);
}

export function normalizeGitBashPath(input: string): string {
  const gitBashPrefix = /^[A-Za-z]:\/(\/)?Program Files\/Git\//;
  if (!gitBashPrefix.test(input)) {
    return input;
  }

  const match = input.match(/Program Files\/Git\/(.*)$/);
  return match ? `/${match[1]}` : input;
}

function parseC7Verifications(entries: string[]): C7Verification[] {
  return entries.map((entry: string) => {
    const cleanEntry = normalizeGitBashPath(entry);

    const colonIndex = cleanEntry.indexOf(':');
    if (colonIndex === -1) {
      return {
        library_id: cleanEntry.trim(),
        verified_at: new Date().toISOString(),
      };
    }

    return {
      library_id: cleanEntry.substring(0, colonIndex).trim(),
      verified_at: new Date().toISOString(),
      notes: cleanEntry.substring(colonIndex + 1).trim(),
    };
  });
}

function readNotesText(options: CreateCommandOptions): string {
  let notes: string[] = [];

  if (options.notesFile) {
    const notesPath = resolve(options.notesFile);
    if (!existsSync(notesPath)) {
      throw new CliPreparationError(`Notes file not found: ${notesPath}`);
    }

    try {
      const fileContent = readFileSync(notesPath, 'utf-8').trim();
      if (fileContent) {
        notes.push(fileContent);
      }
    } catch (err) {
      throw new CliPreparationError(
        `Failed to read notes file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  if (options.notes && Array.isArray(options.notes)) {
    notes = notes.concat(options.notes.map(note => note.trim()).filter(Boolean));
  }

  return notes.join('\n\n');
}

function normalizePriority(priority?: string): TaskPriority {
  const validPriorities: TaskPriority[] = ['top', 'second', 'later'];
  const normalized = priority?.toLowerCase() || 'second';
  if (!validPriorities.includes(normalized as TaskPriority)) {
    throw new CliPreparationError(
      `Invalid priority "${priority}". Must be one of: ${validPriorities.join(', ')}`,
    );
  }

  return normalized as TaskPriority;
}

export function preflightTaskCreation(
  graph: TaskGraphStore,
  options: CreateCommandOptions,
): PreparedTaskCreation {
  const successCriteria = options.successCriterion || [];
  const deliverables = options.deliverable || [];

  if (!options.title || options.title.trim().length === 0) {
    throw new CliPreparationError('Title is required and cannot be empty');
  }

  if (!options.description || options.description.trim().length === 0) {
    throw new CliPreparationError('Description is required and cannot be empty');
  }

  if (successCriteria.length === 0) {
    throw new CliPreparationError(
      'At least one success criterion is required (--success-criterion)',
    );
  }

  if (deliverables.length === 0) {
    throw new CliPreparationError(
      'At least one deliverable is required (--deliverable)',
    );
  }

  const blockers = parseList(options.blockers || '');
  const dependenciesText = (options.dependencyExplanation || options.dependencies || '').trim();
  if (blockers.length > 0 && !dependenciesText) {
    throw new CliPreparationError(
      'When --blockers is provided, --dependency-explanation text is also required.',
      [
        'The twin feature requires both blockers (task IDs) and dependency explanation text.',
        'Example: --blockers abc123 --dependency-explanation "Needs the API spec from abc123"',
      ],
    );
  }

  if (dependenciesText && blockers.length === 0) {
    throw new CliPreparationError(
      'When --dependency-explanation is provided, --blockers task IDs are also required.',
      [
        'The twin feature requires both blockers (task IDs) and dependency explanation text.',
        'Example: --blockers abc123 --dependency-explanation "Needs the API spec from abc123"',
      ],
    );
  }

  const priority = normalizePriority(options.priority);
  const notesText = readNotesText(options);
  const task = new TaskNode({
    id: graph.generateUniqueId(),
    title: options.title.trim(),
    description: options.description.trim(),
    priority,
    success_criteria: successCriteria.map(text => ({
      id: uuidv4(),
      text: text.trim(),
      completed: false,
    })),
    deliverables: deliverables.map(text => ({
      id: uuidv4(),
      text: text.trim(),
      completed: false,
    })),
    blockers,
    dependencies: dependenciesText,
    related_files: options.relatedFiles || [],
    notes: notesText,
    c7_verified: parseC7Verifications(options.c7Verified || []),
    sub_items: [],
    edges: [],
  });

  const resolvedBlockers: string[] = [];
  const invalidBlockers: string[] = [];
  for (const blockerId of task.blockers) {
    const resolvedTask = graph.getNodeByIdOrPrefix(blockerId);
    if (resolvedTask) {
      resolvedBlockers.push(resolvedTask.id);
    } else {
      invalidBlockers.push(blockerId);
    }
  }

  if (invalidBlockers.length > 0) {
    throw new CliPreparationError(
      `Blocker task IDs not found: ${invalidBlockers.join(', ')}`,
    );
  }

  task.blockers = resolvedBlockers;
  return { task };
}

async function invalidateProjectCache(projectPath: string): Promise<void> {
  const serverUrl = process.env.OCTIE_SERVER_URL || DEFAULT_OCTIE_SERVER_URL;
  const rawTimeoutMs = Number(process.env.OCTIE_CACHE_INVALIDATE_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0
    ? rawTimeoutMs
    : DEFAULT_CACHE_INVALIDATION_TIMEOUT_MS;

  try {
    const response = await fetch(
      `${serverUrl}/api/cache/invalidate?project=${encodeURIComponent(projectPath)}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      console.warn(`Cache invalidation skipped: ${response.status} ${response.statusText || 'response error'}`);
    }
  } catch (error) {
    const isTimeoutError = error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (isTimeoutError || serverUrl !== DEFAULT_OCTIE_SERVER_URL) {
      const detail = isTimeoutError
        ? `timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
      console.warn(`Cache invalidation skipped: ${detail}`);
    }
  }
}

export async function executeTaskCreation(
  projectPath: string,
  graph: TaskGraphStore,
  prepared: PreparedTaskCreation,
): Promise<TaskNode> {
  graph.addNode(prepared.task);

  for (const blockerId of prepared.task.blockers) {
    graph.addEdge(blockerId, prepared.task.id);
  }

  graph.propagateStatus(prepared.task.id);
  await saveGraph(projectPath, graph);
  touchProject(projectPath);
  await invalidateProjectCache(projectPath);
  return prepared.task;
}
