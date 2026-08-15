/**
 * JSON output formatters for tasks and projects
 */
/**
 * Schema reference for Octie project files
 */
const OCTIE_SCHEMA = 'https://octie.dev/schemas/project-v1.json';
/**
 * All valid field names from TaskNode.toJSON()
 */
const TASK_FIELDS = new Set([
    'id', 'title', 'description', 'status', 'priority',
    'success_criteria', 'deliverables', 'need_fix', 'assignee',
    'blockers', 'dependencies', 'sub_items', 'related_files',
    'notes', 'c7_verified', 'created_at', 'updated_at', 'completed_at', 'edges',
]);
/**
 * Parse and validate --fields argument
 * Returns array of valid field names, warns about unknowns
 */
export function parseFields(fieldsArg) {
    if (!fieldsArg)
        return null;
    const requested = fieldsArg.split(',').map(f => f.trim()).filter(Boolean);
    if (requested.length === 0)
        return null;
    const invalid = [];
    for (const f of requested) {
        if (!TASK_FIELDS.has(f))
            invalid.push(f);
    }
    if (invalid.length > 0) {
        console.warn(`Warning: unknown field(s): ${invalid.join(', ')}`);
        console.warn(`Valid fields: ${[...TASK_FIELDS].sort().join(', ')}`);
    }
    return requested.filter(f => TASK_FIELDS.has(f));
}
/**
 * Format a single task as JSON
 * Pretty-printed with 2-space indentation
 */
export function formatTaskJSON(task, fields) {
    const data = task;
    if (!fields || fields.length === 0) {
        return JSON.stringify(data, null, 2);
    }
    const filtered = {};
    // ponytail: double-cast needed — TaskNode lacks index signature
    const raw = data;
    for (const key of fields) {
        filtered[key] = raw[key];
    }
    return JSON.stringify(filtered, null, 2);
}
/**
 * Format entire project as JSON for storage
 * Includes all task fields, edges array, indexes, metadata, and schema reference
 */
export function formatProjectJSON(graph) {
    const projectData = graph.toJSON();
    // Add schema reference
    const dataWithSchema = {
        $schema: OCTIE_SCHEMA,
        ...projectData
    };
    return JSON.stringify(dataWithSchema, null, 2);
}
//# sourceMappingURL=json.js.map