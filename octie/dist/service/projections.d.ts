/**
 * Service-layer projections: convert live core objects into owned JSON-safe data.
 * Only leaf fields are read; no live TaskNode/TaskGraphStore instances escape.
 */
import type { TaskNode } from '../core/models/task-node.js';
import type { TaskSummary, TaskProjection } from './types.js';
/** 5-field compact summary used by list/find tools. */
export declare function toTaskSummary(task: TaskNode): TaskSummary;
/** Full task projection for get/create/update/approve results. */
export declare function toTaskProjection(task: TaskNode): TaskProjection;
//# sourceMappingURL=projections.d.ts.map