/**
 * Table output formatters for tasks
 */
import type { TaskProjection } from '../../service/types.js';
/**
 * Format a single task as a detailed table view
 * @param task - The task to format
 * @param fields - Optional list of field names to include (null = all)
 */
export declare function formatTaskDetailTable(task: TaskProjection, fields?: string[] | null): string;
//# sourceMappingURL=table.d.ts.map