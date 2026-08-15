/**
 * Service-layer projections: convert live core objects into owned JSON-safe data.
 * Only leaf fields are read; no live TaskNode/TaskGraphStore instances escape.
 */
function projectCriterion(c) {
    return {
        id: c.id,
        text: c.text,
        completed: c.completed,
        completed_at: c.completed_at ?? null,
        ...(c.evidence ? { evidence: c.evidence } : {}),
    };
}
function projectDeliverable(d) {
    return {
        id: d.id,
        text: d.text,
        completed: d.completed,
        ...(d.file_path ? { file_path: d.file_path } : {}),
    };
}
function projectNeedFix(f) {
    return {
        id: f.id,
        text: f.text,
        ...(f.source ? { source: f.source } : {}),
        ...(f.file_path ? { file_path: f.file_path } : {}),
        completed: f.completed,
    };
}
/** 5-field compact summary used by list/find tools. */
export function toTaskSummary(task) {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        blockers: [...task.blockers],
    };
}
/** Full task projection for get/create/update/approve results. */
export function toTaskProjection(task) {
    return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        success_criteria: task.success_criteria.map(projectCriterion),
        deliverables: task.deliverables.map(projectDeliverable),
        need_fix: task.need_fix.map(projectNeedFix),
        c7_verified: task.c7_verified.map(c7 => ({
            library_id: c7.library_id,
            verified_at: c7.verified_at,
            ...(c7.notes !== undefined ? { notes: c7.notes } : {}),
        })),
        assignee: task.assignee ?? null,
        edges: [...(task.edges ?? [])],
        blockers: [...task.blockers],
        dependencies: task.dependencies ?? '',
        sub_items: [...task.sub_items],
        related_files: [...task.related_files],
        notes: task.notes ?? '',
        created_at: task.created_at ?? '',
        updated_at: task.updated_at ?? '',
        completed_at: task.completed_at ?? null,
    };
}
//# sourceMappingURL=projections.js.map