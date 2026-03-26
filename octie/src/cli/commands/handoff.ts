/**
 * Handoff commands - loose subproject handoff workflows.
 */

import { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { AtomicTaskViolationError } from '../../types/index.js';
import { unregisterProject } from '../../core/registry/index.js';
import { getProjectPath, loadGraph, success, error, info } from '../utils/helpers.js';
import {
  addTaskCreationOptions,
  CliPreparationError,
  type CreateCommandOptions,
  displayAtomicTaskPolicy,
  executeProjectInit,
  executeTaskCreation,
  preflightProjectInit,
  preflightTaskCreation,
} from './shared-helpers.js';

const SUBPROJECTS_DIR = '.octie/subprojects';
export const CREATE_SUBTASK_HANDOFF_GUIDE_FLAG = '--right-way-to-create-subtask-handoff';
export const CREATE_SUBTASK_HANDOFF_PLAYBOOK = `
Right Way: Create Subtask Handoff

Use a handoff when follow-on work needs its own Octie graph to keep the parent graph smaller and the active context narrower. Use normal task decomposition when the work can stay inside one project graph.

Workflow:
1. Run \`octie handoff create --subproject-name <name>\` with the normal parent-task creation flags.
2. Octie creates the child project at \`.octie/subprojects/<name>/.octie/project.json\`.
3. Octie creates the parent handoff task with a canonical note block pointing at that child path.
4. Treat the link as loose context only. Do not add cross-project graph edges, \`sub_items\` links, or extra \`related_files\` just for the handoff.
5. Switch into the child project and create the child closeout gate manually there.
6. Approve the parent handoff task only after the child backlog is complete.

Edge Cases:
- If \`.octie/subprojects/<name>/\` already exists, the command aborts before creating new state.
- If parent task persistence fails after child init, the child folder is rolled back.
- If the child folder is deleted later, the parent task record still remains valid because the connection is only contextual.

Example:
  octie handoff create --subproject-name robust-tests --title "Create robust-tests handoff gate" --description "Create a loose root handoff that points to a dedicated robust-tests subproject for follow-on work." --success-criterion "Child subproject exists at the expected path" --deliverable "root handoff gate record"
`.trim();

function getSubprojectRelativePath(subprojectName: string): string {
  return `${SUBPROJECTS_DIR}/${subprojectName}/`;
}

function normalizeSubprojectName(subprojectName?: string): string {
  const trimmed = subprojectName?.trim();
  if (!trimmed) {
    throw new CliPreparationError(
      'Subproject name is required. Use --subproject-name <name> to create a child handoff project.',
    );
  }

  return trimmed;
}

function buildHandoffNotesBlock(relativePath: string, childProjectName: string): string {
  return [
    '--- OCTIE SUBTASK HANDOFF ---',
    `Subproject Path: ${relativePath}`,
    `Child Project Name: ${childProjectName}`,
    `Child Octie Root: ${relativePath}.octie/`,
    'Use the child subproject as the active Octie project for follow-on work.',
    'This is a loose contextual reference only. Do not add cross-project graph edges, sub_items links, or related_files solely for this handoff.',
    'Do not approve this parent handoff task until the child subproject backlog is complete.',
    'Create the child closeout gate manually inside the child project.',
  ].join('\n');
}

function appendHandoffNotes(
  options: CreateCommandOptions,
  notesBlock: string,
): CreateCommandOptions {
  return {
    ...options,
    notes: [...(options.notes || []), notesBlock],
  };
}

function rollbackChildProject(childProjectPath: string): void {
  unregisterProject(childProjectPath);
  rmSync(childProjectPath, { recursive: true, force: true });
}

export function printCreateSubtaskHandoffGuide(): void {
  console.log(CREATE_SUBTASK_HANDOFF_PLAYBOOK);
}

export function tryHandleGuideFlags(rawArgs: string[]): boolean {
  if (rawArgs.includes(CREATE_SUBTASK_HANDOFF_GUIDE_FLAG)) {
    printCreateSubtaskHandoffGuide();
    return true;
  }

  return false;
}

const handoffCreateCommand = addTaskCreationOptions(
  new Command('create')
    .description('Create a loose subproject handoff and initialize the child Octie project')
    .requiredOption(
      '--subproject-name <name>',
      'Subproject folder name under .octie/subprojects/',
    )
    .option(
      '--name <name>',
      'Child project name (defaults to --subproject-name). Long flag only because -n is reserved for --notes.',
    ),
)
  .addHelpText(
    'after',
    `
Handoff Behavior:
  • Initializes child project at .octie/subprojects/<subproject-name>/.octie/project.json
  • Creates the parent task using the same validation rules as 'octie create'
  • Appends a canonical handoff note block to the parent task
  • Keeps the relationship loose and note-only

Examples:
  $ octie handoff create --subproject-name robust-tests --title "Close root handoff to robust-tests" \\
      --description "Close the repository-root handoff only after the robust-tests backlog is complete." \\
      --success-criterion "Child backlog ready count = 0 before approval" \\
      --deliverable "repository-root closeout gate for robust-tests"

Notes:
  • Use --name to override the child project name stored in the child .octie/project.json
  • The child closeout gate is created manually inside the child project
  • Existing target folders fail fast before new state is created

Guide Flag:
  • ${CREATE_SUBTASK_HANDOFF_GUIDE_FLAG}
`,
  )
  .action(async (options, command) => {
    try {
      const rootOpts = command.parent?.parent?.opts() || {};
      const parentProjectPath = await getProjectPath(options.project || rootOpts.project);
      const parentGraph = await loadGraph(parentProjectPath);

      const subprojectName = normalizeSubprojectName(options.subprojectName);
      const childProjectName = options.name?.trim() || subprojectName;
      const childProjectPath = join(parentProjectPath, '.octie', 'subprojects', subprojectName);
      const relativePath = getSubprojectRelativePath(subprojectName);

      if (existsSync(childProjectPath)) {
        throw new CliPreparationError(
          `Subproject folder already exists: ${relativePath}`,
          ['Choose a different --subproject-name or remove the existing folder first.'],
        );
      }

      const parentOptions = appendHandoffNotes(
        options as CreateCommandOptions,
        buildHandoffNotesBlock(relativePath, childProjectName),
      );
      const preparedParentTask = preflightTaskCreation(parentGraph, parentOptions);
      const validatedChildProject = await preflightProjectInit(childProjectPath, {
        name: childProjectName,
      });

      try {
        await executeProjectInit(validatedChildProject);
      } catch (err) {
        rollbackChildProject(childProjectPath);
        throw err;
      }

      try {
        const task = await executeTaskCreation(parentProjectPath, parentGraph, preparedParentTask);

        success('Handoff created');
        info(`Subproject: ${childProjectName}`);
        info(`Location: ${relativePath}`);
        info(`Parent task: ${task.id}`);
        console.log('');
        console.log(
          chalk.gray('Child project:'),
          chalk.gray(`octie --project "${childProjectPath}" list`),
        );
        process.exit(0);
      } catch (err) {
        rollbackChildProject(childProjectPath);
        throw err;
      }
    } catch (err) {
      if (err instanceof CliPreparationError) {
        error(err.message);
        for (const message of err.infoMessages) {
          info(message);
        }
        process.exit(1);
      }

      if (err instanceof AtomicTaskViolationError) {
        error(err.message);
        if (err.violations.length > 0) {
          console.log('');
          console.log(chalk.yellow.bold('Specific issues found:'));
          for (const violation of err.violations) {
            console.log(chalk.red('  ✗') + violation);
          }
          console.log('');
          info('See atomic task policy below for guidance');
          displayAtomicTaskPolicy();
        }
        process.exit(1);
      }

      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to create handoff');
      }

      process.exit(1);
    }
  });

export const handoffCommand = new Command('handoff')
  .description('Create and manage loose subproject handoffs')
  .addCommand(handoffCreateCommand);
