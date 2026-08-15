/**
 * Handoff commands - loose subproject handoff workflows.
 */
import { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { AtomicTaskViolationError } from '../../types/index.js';
import { unregisterProjectDetailed } from '../../core/registry/index.js';
import { getProjectPath, loadGraph, success, error, info } from '../utils/helpers.js';
import { CREATE_SUBTASK_HANDOFF_GUIDE_FLAG } from './guides.js';
import { addTaskCreationOptions, CliPreparationError, displayAtomicTaskPolicy, executeProjectInit, executeTaskCreation, preflightProjectInit, preflightTaskCreation, } from './shared-helpers.js';
const SUBPROJECTS_DIR = '.octie/subprojects';
function getSubprojectRelativePath(subprojectName) {
    return `${SUBPROJECTS_DIR}/${subprojectName}/`;
}
function normalizeSubprojectName(subprojectName) {
    const trimmed = subprojectName?.trim();
    if (!trimmed) {
        throw new CliPreparationError('Subproject name is required. Use --subproject-name <name> to create a child handoff project.');
    }
    return trimmed;
}
function buildHandoffNotesBlock(relativePath, childProjectName) {
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
function appendHandoffNotes(options, notesBlock) {
    return {
        ...options,
        notes: [...(options.notes || []), notesBlock],
    };
}
function toError(error) {
    return error instanceof Error ? error : new Error(String(error));
}
function removeChildProjectDir(childProjectPath) {
    if (process.env.OCTIE_TEST_FORCE_HANDOFF_RM_SYNC_FAILURE === '1') {
        throw new Error('Injected rollback rmSync failure');
    }
    rmSync(childProjectPath, { recursive: true, force: true });
}
function rollbackChildProject(childProjectPath) {
    const rollbackFailures = [];
    const unregisterResult = unregisterProjectDetailed(childProjectPath);
    if (!unregisterResult.removed) {
        const detail = unregisterResult.error?.message || 'registry entry was not removed';
        rollbackFailures.push(`registry cleanup failed for ${childProjectPath}: ${detail}`);
    }
    try {
        removeChildProjectDir(childProjectPath);
    }
    catch (error) {
        rollbackFailures.push(`directory cleanup failed for ${childProjectPath}: ${toError(error).message}`);
    }
    if (rollbackFailures.length > 0) {
        throw new Error(`rollback cleanup incomplete\n${rollbackFailures.map(message => `- ${message}`).join('\n')}`);
    }
}
export class HandoffRollbackError extends Error {
    originalError;
    rollbackError;
    constructor(originalError, rollbackError) {
        const original = toError(originalError);
        const rollback = toError(rollbackError);
        super(`Original failure: ${original.message}\nRollback failure: ${rollback.message}`, { cause: rollback });
        this.name = 'HandoffRollbackError';
        this.originalError = original;
        this.rollbackError = rollback;
    }
}
export function combineHandoffFailure(originalError, rollbackError) {
    return new HandoffRollbackError(originalError, rollbackError);
}
const handoffCreateCommand = addTaskCreationOptions(new Command('create')
    .description('Create a loose subproject handoff and initialize the child Octie project')
    .requiredOption('--subproject-name <name>', 'Subproject folder name under .octie/subprojects/')
    .option('--name <name>', 'Child project name (defaults to --subproject-name). Long flag only because -n is reserved for --notes.'))
    .addHelpText('after', `
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
`)
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
            throw new CliPreparationError(`Subproject folder already exists: ${relativePath}`, ['Choose a different --subproject-name or remove the existing folder first.']);
        }
        const parentOptions = appendHandoffNotes(options, buildHandoffNotesBlock(relativePath, childProjectName));
        const preparedParentTask = preflightTaskCreation(parentGraph, parentOptions);
        const validatedChildProject = await preflightProjectInit(childProjectPath, {
            name: childProjectName,
        });
        try {
            await executeProjectInit(validatedChildProject);
        }
        catch (err) {
            try {
                rollbackChildProject(childProjectPath);
            }
            catch (rollbackError) {
                throw combineHandoffFailure(err, rollbackError);
            }
            throw err;
        }
        try {
            const task = await executeTaskCreation(parentProjectPath, parentGraph, preparedParentTask);
            success('Handoff created');
            info(`Subproject: ${childProjectName}`);
            info(`Location: ${relativePath}`);
            info(`Parent task: ${task.id}`);
            console.log('');
            console.log(chalk.gray('Child project:'), chalk.gray(`octie --project "${childProjectPath}" list`));
            process.exit(0);
        }
        catch (err) {
            try {
                rollbackChildProject(childProjectPath);
            }
            catch (rollbackError) {
                throw combineHandoffFailure(err, rollbackError);
            }
            throw err;
        }
    }
    catch (err) {
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
        }
        else {
            error('Failed to create handoff');
        }
        process.exit(1);
    }
});
export const handoffCommand = new Command('handoff')
    .description('Create and manage loose subproject handoffs')
    .addCommand(handoffCreateCommand);
//# sourceMappingURL=handoff.js.map