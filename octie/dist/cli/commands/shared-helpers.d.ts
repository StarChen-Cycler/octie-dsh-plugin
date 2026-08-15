/**
 * Shared helpers for command preflight and execution.
 *
 * The engine logic (preflight/execute for init & create, notes handling,
 * registry checks, blocker resolution, cache invalidation) now lives in
 * `src/service/engine.ts` — the DSH-agnostic service layer — and is
 * re-exported here so existing CLI commands keep their import surface.
 * Only CLI display/option concerns (addTaskCreationOptions, the atomic-task
 * policy text) remain in this module.
 */
import { Command } from 'commander';
export { CliPreparationError, preflightProjectInit, executeProjectInit, preflightTaskCreation, executeTaskCreation, invalidateProjectCache, normalizeGitBashPath, } from '../../service/engine.js';
export type { CreateCommandOptions, InitCommandOptions, ValidatedInitRequest, PreparedTaskCreation, } from '../../service/engine.js';
export declare function addTaskCreationOptions<T extends Command>(command: T): T;
export declare function displayAtomicTaskPolicy(): void;
//# sourceMappingURL=shared-helpers.d.ts.map