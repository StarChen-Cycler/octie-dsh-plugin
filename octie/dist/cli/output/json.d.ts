/**
 * JSON output formatters for tasks and projects
 *
 * Field filtering is implemented once in src/service/fields.ts (spec C1) and
 * shared with the DSH octie_get tool; this module only adds the CLI warning UX.
 */
import type { TaskGraphStore } from '../../core/graph/index.js';
import type { TaskProjection } from '../../service/types.js';
/**
 * Parse and validate --fields argument
 * Returns array of valid field names, warns about unknowns
 */
export declare function parseFields(fieldsArg: string | undefined): string[] | null;
/**
 * Format a single task as JSON
 * Pretty-printed with 2-space indentation
 */
export declare function formatTaskJSON(task: TaskProjection, fields?: string[] | null): string;
/**
 * Format entire project as JSON for storage
 * Includes all task fields, edges array, indexes, metadata, and schema reference
 */
export declare function formatProjectJSON(graph: TaskGraphStore): string;
//# sourceMappingURL=json.d.ts.map