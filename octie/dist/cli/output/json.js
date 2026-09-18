/**
 * JSON output formatters for tasks and projects
 *
 * Field filtering is implemented once in src/service/fields.ts (spec C1) and
 * shared with the DSH octie_get tool; this module only adds the CLI warning UX.
 */
import { TASK_FIELDS, parseFieldList, filterTaskFields } from '../../service/fields.js';
/**
 * Schema reference for Octie project files
 */
const OCTIE_SCHEMA = 'https://octie.dev/schemas/project-v1.json';
/**
 * Parse and validate --fields argument
 * Returns array of valid field names, warns about unknowns
 */
export function parseFields(fieldsArg) {
    const { fields, invalid } = parseFieldList(fieldsArg);
    if (invalid.length > 0) {
        console.warn(`Warning: unknown field(s): ${invalid.join(', ')}`);
        console.warn(`Valid fields: ${[...TASK_FIELDS].sort().join(', ')}`);
    }
    return fields;
}
/**
 * Format a single task as JSON
 * Pretty-printed with 2-space indentation
 */
export function formatTaskJSON(task, fields) {
    return JSON.stringify(filterTaskFields(task, fields), null, 2);
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