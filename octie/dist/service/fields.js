/**
 * Shared task-field filtering — the single implementation behind both the
 * CLI `--fields` flag and the DSH `octie_get` fields parameter (spec C1).
 *
 * Pure functions only: no console output, no process exit. The CLI layer
 * adds its warning UX on top; the plugin layer embeds unknown-field
 * information into the returned error/result instead.
 */
/**
 * All valid task field names (mirrors TaskNode.toJSON() keys).
 */
export const TASK_FIELDS = new Set([
    'id', 'title', 'description', 'status', 'priority',
    'success_criteria', 'deliverables', 'need_fix', 'assignee',
    'blockers', 'dependencies', 'sub_items', 'related_files',
    'notes', 'c7_verified', 'created_at', 'updated_at', 'completed_at', 'edges',
]);
/**
 * Parse a field selection into validated names.
 * Accepts a comma-separated string (CLI style) or an array (tool style).
 * `undefined`/`null`/empty input, or the literal `all`, selects everything
 * (returns `fields: null`).
 */
export function parseFieldList(fieldsArg) {
    if (fieldsArg === undefined || fieldsArg === null) {
        return { fields: null, invalid: [] };
    }
    const requested = (Array.isArray(fieldsArg) ? fieldsArg : fieldsArg.split(','))
        .map(f => f.trim())
        .filter(Boolean);
    if (requested.length === 0 || requested.includes('all')) {
        return { fields: null, invalid: [] };
    }
    const invalid = requested.filter(f => !TASK_FIELDS.has(f));
    const fields = requested.filter(f => TASK_FIELDS.has(f));
    return { fields, invalid };
}
/**
 * Return the task projection narrowed to the given fields.
 * `fields: null` (or an empty array) returns the full projection.
 */
export function filterTaskFields(task, fields) {
    const raw = task;
    if (!fields || fields.length === 0) {
        return { ...raw };
    }
    const filtered = {};
    for (const key of fields) {
        filtered[key] = raw[key];
    }
    return filtered;
}
//# sourceMappingURL=fields.js.map