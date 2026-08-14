/**
 * Service: loose subproject handoffs.
 * Initializes the child project under .octie/subprojects/<name> and creates
 * the parent gate task, with full rollback when either step fails.
 */

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { unregisterProjectDetailed } from '../core/registry/index.js';
import { TaskStorage } from '../core/storage/file-store.js';
import {
  CliPreparationError,
  executeProjectInit,
  executeTaskCreation,
  preflightProjectInit,
  preflightTaskCreation,
  toCreateOptions,
  type CreateCommandOptions,
} from './engine.js';
import { toTaskProjection } from './projections.js';
import type { HandoffInput, TaskProjection } from './types.js';

const SUBPROJECTS_DIR = '.octie/subprojects';

function normalizeSubprojectName(name?: string): string {
  const trimmed = name?.trim();
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

function rollbackChildProject(childProjectPath: string): void {
  const rollbackFailures: string[] = [];
  const unregisterResult = unregisterProjectDetailed(childProjectPath);
  if (!unregisterResult.removed) {
    const detail = unregisterResult.error?.message || 'registry entry was not removed';
    rollbackFailures.push(`registry cleanup failed for ${childProjectPath}: ${detail}`);
  }
  try {
    if (process.env.OCTIE_TEST_FORCE_HANDOFF_RM_SYNC_FAILURE === '1') {
      throw new Error('Injected rollback rmSync failure');
    }
    rmSync(childProjectPath, { recursive: true, force: true });
  } catch (error) {
    rollbackFailures.push(
      `directory cleanup failed for ${childProjectPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (rollbackFailures.length > 0) {
    throw new Error(`rollback cleanup incomplete\n${rollbackFailures.map(m => `- ${m}`).join('\n')}`);
  }
}

export async function createHandoff(
  projectPath: string,
  input: HandoffInput,
): Promise<TaskProjection> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const parentGraph = await storage.load();

  const subprojectName = normalizeSubprojectName(input.subprojectName);
  const childProjectName = subprojectName;
  const childProjectPath = join(projectPath, '.octie', 'subprojects', subprojectName);
  const relativePath = `${SUBPROJECTS_DIR}/${subprojectName}/`;

  if (existsSync(childProjectPath)) {
    throw new CliPreparationError(
      `Subproject folder already exists: ${relativePath}`,
      ['Choose a different --subproject-name or remove the existing folder first.'],
    );
  }

  const parentOptions: CreateCommandOptions = {
    ...toCreateOptions({
      title: input.title,
      description: input.description,
      successCriteria: input.successCriteria,
      deliverables: input.deliverables,
      priority: input.priority,
    }),
    notes: [...(toCreateOptions({
      title: input.title,
      description: input.description,
      successCriteria: input.successCriteria,
      deliverables: input.deliverables,
      priority: input.priority,
    }).notes ?? []), buildHandoffNotesBlock(relativePath, childProjectName)],
  };

  const preparedParentTask = preflightTaskCreation(parentGraph, parentOptions);
  const validatedChildProject = await preflightProjectInit(childProjectPath, { name: childProjectName });

  try {
    await executeProjectInit(validatedChildProject);
  } catch (err) {
    try {
      rollbackChildProject(childProjectPath);
    } catch (rollbackError) {
      throw new Error(
        `Original failure: ${err instanceof Error ? err.message : String(err)}\n` +
        `Rollback failure: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    }
    throw err;
  }

  try {
    const task = await executeTaskCreation(projectPath, parentGraph, preparedParentTask);
    return toTaskProjection(task);
  } catch (err) {
    try {
      rollbackChildProject(childProjectPath);
    } catch (rollbackError) {
      throw new Error(
        `Original failure: ${err instanceof Error ? err.message : String(err)}\n` +
        `Rollback failure: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    }
    throw err;
  }
}
