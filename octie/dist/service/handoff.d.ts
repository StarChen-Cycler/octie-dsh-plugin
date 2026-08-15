/**
 * Service: loose subproject handoffs.
 * Initializes the child project under .octie/subprojects/<name> and creates
 * the parent gate task, with full rollback when either step fails.
 */
import type { HandoffInput, TaskProjection } from './types.js';
export declare function createHandoff(projectPath: string, input: HandoffInput): Promise<TaskProjection>;
//# sourceMappingURL=handoff.d.ts.map