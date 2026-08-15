/**
 * Service: task queries and mutations.
 * All functions: load graph → operate → persist → return JSON projections.
 * Failures throw Errors (CliPreparationError carries info tips); no console
 * output, no process.exit. Messages mirror the CLI surface so the CLI can
 * rewire onto this layer with byte-identical output.
 */
import type { CreateTaskInput, FindFilter, ListFilter, ProjectHandle, TaskProjection, TaskSummary, UpdateTaskPatch } from './types.js';
export interface TaskMutationResult {
    task: TaskProjection;
    propagatedCount: number;
    infoMessages: string[];
}
export declare function openProject(path?: string): Promise<ProjectHandle>;
export declare function createTask(projectPath: string, input: CreateTaskInput): Promise<TaskProjection>;
export declare function listTasks(projectPath: string, filter?: ListFilter): Promise<TaskSummary[]>;
/** Like listTasks but returns full projections for CLI rendering. */
export declare function listTasksFull(projectPath: string, filter?: ListFilter): Promise<TaskProjection[]>;
export declare function getTask(projectPath: string, id: string): Promise<TaskProjection | null>;
export declare function findTasks(projectPath: string, filter?: FindFilter): Promise<TaskSummary[]>;
/** Like findTasks but returns full projections for CLI rendering. */
export declare function findTasksFull(projectPath: string, filter?: FindFilter): Promise<TaskProjection[]>;
/**
 * Full update port of the CLI `octie update` action, returning the
 * projection plus propagation count and success-path info lines so the
 * CLI can reproduce its output exactly.
 */
export declare function updateTaskWithPropagation(projectPath: string, id: string, patch: UpdateTaskPatch): Promise<TaskMutationResult>;
export declare function updateTask(projectPath: string, id: string, patch: UpdateTaskPatch): Promise<TaskProjection>;
export declare function approveTaskWithPropagation(projectPath: string, id: string): Promise<{
    task: TaskProjection;
    propagatedCount: number;
}>;
export declare function approveTask(projectPath: string, id: string): Promise<TaskProjection>;
//# sourceMappingURL=tasks.d.ts.map