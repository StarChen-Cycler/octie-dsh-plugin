/**
 * Shared task-field filtering — the single implementation behind both the
 * CLI `--fields` flag and the DSH `octie_get` fields parameter (spec C1).
 *
 * Pure functions only: no console output, no process exit. The CLI layer
 * adds its warning UX on top; the plugin layer embeds unknown-field
 * information into the returned error/result instead.
 */
import type { TaskProjection } from './types.js';
/**
 * All valid task field names (mirrors TaskNode.toJSON() keys).
 */
export declare const TASK_FIELDS: ReadonlySet<string>;
/**
 * Parse a field selection into validated names.
 * Accepts a comma-separated string (CLI style) or an array (tool style).
 * `undefined`/`null`/empty input, or the literal `all`, selects everything
 * (returns `fields: null`).
 */
export declare function parseFieldList(fieldsArg: string | string[] | undefined | null): {
    fields: string[] | null;
    invalid: string[];
};
/**
 * Return the task projection narrowed to the given fields.
 * `fields: null` (or an empty array) returns the full projection.
 */
export declare function filterTaskFields(task: TaskProjection, fields?: string[] | null): Record<string, unknown>;
//# sourceMappingURL=fields.d.ts.map