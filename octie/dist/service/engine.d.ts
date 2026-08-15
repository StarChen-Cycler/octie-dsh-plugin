/**
 * Service engine: the shared business rules behind init / create / handoff.
 *
 * These functions were extracted from `src/cli/commands/shared-helpers.ts`
 * (which now re-exports them) so the DSH bundle, the CLI, and the Web layer
 * all run one engine. No console output, no process.exit — failures throw.
 */
import { loadRegistry } from '../core/registry/index.js';
import { TaskNode } from '../core/models/task-node.js';
import { TaskStorage } from '../core/storage/file-store.js';
import type { TaskGraphStore } from '../core/graph/index.js';
import type { CreateTaskInput, ProjectHandle } from './types.js';
export declare class CliPreparationError extends Error {
    readonly infoMessages: string[];
    constructor(message: string, infoMessages?: string[]);
}
/** CLI-compatible option bag (kept for shared-helpers re-export compatibility). */
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
export interface InitCommandOptions {
    name?: string;
}
export interface ValidatedInitRequest {
    projectName: string;
    projectPath: string;
    storage: TaskStorage;
    registry: ReturnType<typeof loadRegistry>;
}
export interface PreparedTaskCreation {
    task: TaskNode;
}
export declare function normalizeGitBashPath(input: string): string;
export declare function preflightProjectInit(projectPath: string, options: InitCommandOptions): Promise<ValidatedInitRequest>;
export declare function executeProjectInit(request: ValidatedInitRequest): Promise<void>;
export declare function preflightTaskCreation(graph: TaskGraphStore, options: CreateCommandOptions): PreparedTaskCreation;
export declare function invalidateProjectCache(projectPath: string): Promise<void>;
export declare function executeTaskCreation(projectPath: string, graph: TaskGraphStore, prepared: PreparedTaskCreation): Promise<TaskNode>;
/** Convert a service CreateTaskInput into the CLI-compatible option bag. */
export declare function toCreateOptions(input: CreateTaskInput): CreateCommandOptions;
/** Initialize a project at an explicit path (engine entry used by the service layer). */
export declare function initProjectAt(projectPath: string, name: string): Promise<ProjectHandle>;
//# sourceMappingURL=engine.d.ts.map