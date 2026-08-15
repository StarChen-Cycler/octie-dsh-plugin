/**
 * Markdown output formatters for tasks and projects
 */
import type { TaskGraphStore } from '../../core/graph/index.js';
import type { TaskProjection } from '../../service/types.js';
/**
 * Format a single task as markdown
 * Format: ## [ ] Title: Description
 */
export declare function formatTaskMarkdown(task: TaskProjection): string;
/**
 * Format entire project as markdown for AI consumption
 */
export declare function formatProjectMarkdown(graph: TaskGraphStore): string;
//# sourceMappingURL=markdown.d.ts.map