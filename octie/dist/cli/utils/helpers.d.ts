/**
 * CLI utility functions
 */
import type { Command } from 'commander';
import type { TaskGraphStore } from '../../core/graph/index.js';
import type { TaskNode } from '../../core/models/task-node.js';
/**
 * Valid CLI output formats
 */
export declare const OUTPUT_FORMATS: readonly ["json", "md", "table"];
/**
 * Resolve the effective output format for a command
 *
 * Precedence:
 * 1. Explicit --format flag (or env) passed by the user
 * 2. "format" key in <projectPath>/.octie/config.json
 * 3. 'table' default
 *
 * @param command - The executing (sub)command; the root program is found by walking parents
 * @param projectPath - Resolved Octie project path (contains .octie/)
 */
export declare function resolveOutputFormat(command: Command, projectPath: string): string;
/**
 * Get the project path from options or auto-detect
 */
export declare function getProjectPath(projectOption?: string): Promise<string>;
/**
 * Load the project graph
 */
export declare function loadGraph(projectPath: string): Promise<TaskGraphStore>;
/**
 * Save the project graph
 */
export declare function saveGraph(projectPath: string, graph: TaskGraphStore): Promise<void>;
/**
 * Format success message
 */
export declare function success(message: string): void;
/**
 * Format error message
 */
export declare function error(message: string): void;
/**
 * Format warning message
 */
export declare function warning(message: string): void;
/**
 * Format info message
 */
export declare function info(message: string): void;
/**
 * Parse comma-separated list
 */
export declare function parseList(value: string): string[];
/**
 * Parse multiple IDs from various formats
 * Supports:
 * - "id1","id2","id3" (quoted CSV format)
 * - id1,id2,id3 (simple comma-separated)
 * - Single ID (backward compatible)
 *
 * Used with Commander.js collector pattern:
 * .option('--ids <id>', 'IDs to process', parseMultipleIds, [])
 */
export declare function parseMultipleIds(value: string, previous: string[]): string[];
/**
 * Format status for display
 */
export declare function formatStatus(status: string): string;
/**
 * Format priority for display
 */
export declare function formatPriority(priority: string): string;
/**
 * Format error for CLI output
 * Provides consistent error formatting with code, message, and suggestion
 */
export declare function formatError(error: unknown, verbose?: boolean): string;
/**
 * Prompt user for confirmation
 * Returns true if user confirms (y/yes), false otherwise
 */
export declare function confirmPrompt(message: string): Promise<boolean>;
/**
 * Compact task summary projection for --summary output
 */
export interface TaskSummary {
    id: string;
    title: string;
    status: string;
    priority: string;
    blockers: string[];
}
/**
 * Project a task to its 5-field summary shape
 */
export declare function toTaskSummary(task: TaskNode): TaskSummary;
/**
 * Render one task as a compact one-line markdown summary
 */
export declare function formatTaskSummaryMarkdown(task: TaskNode): string;
//# sourceMappingURL=helpers.d.ts.map