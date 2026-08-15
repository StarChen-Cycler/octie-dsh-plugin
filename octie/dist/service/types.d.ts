/**
 * Public service-layer types: JSON-safe input/output contracts.
 * These types never expose live TaskNode / TaskGraphStore instances —
 * consumers receive owned projections built from leaf fields only.
 */
import type { TaskStatus, TaskPriority } from '../types/index.js';
export interface CriterionProjection {
    id: string;
    text: string;
    completed: boolean;
    completed_at?: string | null;
    evidence?: string;
}
export interface DeliverableProjection {
    id: string;
    text: string;
    completed: boolean;
    file_path?: string;
}
export interface NeedFixProjection {
    id: string;
    text: string;
    source?: 'review' | 'runtime' | 'regression';
    file_path?: string;
    completed: boolean;
}
export interface TaskSummary {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    blockers: string[];
}
export interface C7VerificationProjection {
    library_id: string;
    verified_at: string;
    notes?: string;
}
export interface TaskProjection extends TaskSummary {
    description: string;
    success_criteria: CriterionProjection[];
    deliverables: DeliverableProjection[];
    need_fix: NeedFixProjection[];
    c7_verified: C7VerificationProjection[];
    assignee: string | null;
    edges: string[];
    sub_items: string[];
    related_files: string[];
    notes: string;
    dependencies: string;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}
export interface ProjectHandle {
    path: string;
    name: string;
}
export interface CreateTaskInput {
    title: string;
    description: string;
    successCriteria: string[];
    deliverables: string[];
    priority?: TaskPriority;
    blockers?: string[];
    dependencyExplanation?: string;
    relatedFiles?: string[];
    notes?: string;
    c7Verified?: string[];
}
export interface ListFilter {
    status?: TaskStatus;
    priority?: TaskPriority;
}
export interface FindFilter extends ListFilter {
    title?: string;
    search?: string;
    hasFile?: string;
    verified?: string;
    withoutBlockers?: boolean;
    orphans?: boolean;
    leaves?: boolean;
}
export interface UpdateTaskPatch {
    priority?: TaskPriority;
    addDeliverables?: string[];
    completeDeliverables?: string[];
    removeDeliverables?: string[];
    addSuccessCriteria?: string[];
    completeCriteria?: string[];
    removeCriteria?: string[];
    evidence?: string;
    addNeedFix?: Array<{
        text: string;
        source?: 'review' | 'runtime' | 'regression';
        file?: string;
    }>;
    completeNeedFix?: string[];
    blockers?: {
        id: string;
        explanation: string;
    };
    unblock?: string;
    clearDependencies?: boolean;
    dependencies?: string;
    addRelatedFiles?: string[];
    removeRelatedFiles?: string[];
    c7Verified?: string[];
    removeC7Verified?: string[];
    notes?: string | string[];
    notesFile?: string;
}
export interface WireOpts {
    after: string;
    before: string;
    depOnAfter: string;
    depOnBefore: string;
}
export interface GraphStats {
    taskCount: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    roots: string[];
    orphans: string[];
    cycles: string[][];
    hasCycle: boolean;
    topologicalOrder: string[];
    connectedComponents: number;
}
export interface GraphValidation {
    valid: boolean;
    cycles: string[][];
    invalidReferences: Array<{
        taskId: string;
        invalidBlockerId: string;
    }>;
}
export interface HandoffInput {
    subprojectName: string;
    title: string;
    description: string;
    successCriteria: string[];
    deliverables: string[];
    priority?: TaskPriority;
}
export interface ChangeEvent {
    kind: 'task-created' | 'task-updated' | 'task-approved' | 'graph-changed' | 'snapshot-restored';
    taskId?: string;
    title?: string;
    reason?: string;
}
//# sourceMappingURL=types.d.ts.map