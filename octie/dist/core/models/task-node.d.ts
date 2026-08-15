/**
 * Task Node Model
 *
 * Implements the TaskNode class with:
 * - Required field validation
 * - Atomic task validation
 * - Auto-timestamp management (created_at, updated_at, completed_at)
 * - Status transition validation
 * - Success criteria and deliverable tracking
 *
 * @module core/models/task-node
 */
import type { TaskNode as TaskNodeType, TaskStatus, TaskPriority, SuccessCriterion, Deliverable, C7Verification, FixItem } from '../../types/index.js';
/**
 * Action verbs that indicate specific, executable tasks
 * Exported so CLI surfaces (rejection errors, policy help) can print the full list.
 */
export declare const ACTION_VERBS: string[];
/**
 * Validate atomic task requirements
 *
 * Atomic tasks MUST be:
 * - Specific (clear, focused purpose)
 * - Executable (can be completed in 2-8 hours typical, max 2 days)
 * - Verifiable (has quantitative success criteria)
 * - Independent (minimizes dependencies)
 *
 * @param taskData - Task data to validate
 * @throws {AtomicTaskViolationError} If task violates atomic requirements
 */
export declare function validateAtomicTask(taskData: {
    title: string;
    description: string;
    success_criteria: SuccessCriterion[];
    deliverables: Deliverable[];
}): void;
/**
 * Task Node Class
 *
 * Represents a single task in the graph with:
 * - Auto-managed timestamps (created_at, updated_at, completed_at)
 * - Required field validation at creation
 * - Atomic task validation
 * - Status transition validation
 * - Private setters to prevent manual timestamp manipulation
 */
export declare class TaskNode implements TaskNodeType {
    readonly id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    success_criteria: SuccessCriterion[];
    deliverables: Deliverable[];
    /** Blocking issues that must be resolved before review (equal importance to criteria/deliverables) */
    need_fix: FixItem[];
    /** Optional agent/session that owns this task (decoupled from status) */
    assignee: string | null;
    blockers: string[];
    /** Explanatory text describing WHY this task depends on its blockers */
    dependencies: string;
    sub_items: string[];
    related_files: string[];
    notes: string;
    c7_verified: C7Verification[];
    private _created_at;
    private _updated_at;
    private _completed_at;
    edges: string[];
    /**
     * Get the creation timestamp (immutable)
     */
    get created_at(): string;
    /**
     * Get the last update timestamp (auto-managed)
     */
    get updated_at(): string;
    /**
     * Get the completion timestamp (auto-managed, null if not complete)
     */
    get completed_at(): string | null;
    /**
     * Create a new TaskNode
     *
     * @param data - Task data (title, description, success_criteria, deliverables are REQUIRED)
     * @param _skipAtomicValidation - Private: skip atomic validation (used only by fromJSON for deserialization)
     * @throws {ValidationError} If required fields are missing or invalid
     * @throws {AtomicTaskViolationError} If task violates atomic requirements
     */
    constructor(data: {
        title?: string;
        description?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        success_criteria?: SuccessCriterion[];
        deliverables?: Deliverable[];
        need_fix?: FixItem[];
        assignee?: string | null;
        blockers?: string[];
        /** Explanatory text describing WHY this task depends on its blockers */
        dependencies?: string;
        sub_items?: string[];
        related_files?: string[];
        notes?: string;
        c7_verified?: C7Verification[];
        id?: string;
        edges?: string[];
        created_at?: string;
        updated_at?: string;
        completed_at?: string | null;
        _skipAtomicValidation?: boolean;
    });
    /**
     * Update the task title
     * @param title - New title
     */
    setTitle(title: string): void;
    /**
     * Update the task description
     * @param description - New description
     */
    setDescription(description: string): void;
    /**
     * Update the task status
     * @param status - New status
     */
    setStatus(status: TaskStatus): void;
    /**
     * Update the task priority
     * @param priority - New priority
     */
    setPriority(priority: TaskPriority): void;
    /**
     * Add a success criterion
     * @param criterion - Success criterion to add
     */
    addSuccessCriterion(criterion: SuccessCriterion): void;
    /**
     * Mark a success criterion as complete
     * @param criterionId - ID of the criterion to mark complete
     * @param evidence - Optional evidence recorded at completion (e.g. benchmark numbers)
     */
    completeCriterion(criterionId: string, evidence?: string): void;
    /**
     * Unmark a success criterion as complete
     * @param criterionId - ID of the criterion to unmark
     * @throws {ImmutabilityViolationError} If criterion is already completed (immutable)
     */
    uncompleteCriterion(criterionId: string): void;
    /**
     * Add a deliverable
     * @param deliverable - Deliverable to add
     */
    addDeliverable(deliverable: Deliverable): void;
    /**
     * Mark a deliverable as complete
     * @param deliverableId - ID of the deliverable to mark complete
     */
    completeDeliverable(deliverableId: string): void;
    /**
     * Unmark a deliverable as complete
     * @param deliverableId - ID of the deliverable to unmark
     * @throws {ImmutabilityViolationError} If deliverable is already completed (immutable)
     */
    uncompleteDeliverable(deliverableId: string): void;
    /**
     * Add a need_fix item
     * Need_fix items are blocking issues that must be resolved before review
     * @param text - Description of what needs to be fixed
     * @param options - Optional file_path and source
     */
    addNeedFix(text: string, options?: {
        file_path?: string;
        source?: FixItem['source'];
    }): void;
    /**
     * Mark a need_fix item as complete
     * @param fixId - ID of the need_fix item to mark complete
     */
    completeNeedFix(fixId: string): void;
    /**
     * Set the assignee for this task
     * Assignee is decoupled from status - just a placeholder for future team management
     * @param agentId - Agent/session ID, or null to clear
     */
    setAssignee(agentId: string | null): void;
    /**
     * Add a blocker task ID
     * @param blockerId - Task ID that blocks this task
     */
    addBlocker(blockerId: string): void;
    /**
     * Remove a blocker task ID
     * @param blockerId - Task ID to remove from blockers
     */
    removeBlocker(blockerId: string): void;
    /**
     * Set the dependencies explanation text (twin to blockers)
     * @param explanation - Explanatory text describing WHY this task depends on its blockers
     */
    setDependencies(explanation: string): void;
    /**
     * Clear the dependencies explanation text
     * Typically called when removing the last blocker
     */
    clearDependencies(): void;
    /**
     * Remove a success criterion
     * @param criterionId - ID of the criterion to remove
     * @throws {ValidationError} If criterion not found or removal would leave no criteria
     * @throws {ImmutabilityViolationError} If criterion is completed (immutable)
     */
    removeSuccessCriterion(criterionId: string): void;
    /**
     * Remove a deliverable
     * @param deliverableId - ID of the deliverable to remove
     * @throws {ValidationError} If deliverable not found or removal would leave no deliverables
     * @throws {ImmutabilityViolationError} If deliverable is completed (immutable)
     */
    removeDeliverable(deliverableId: string): void;
    /**
     * Remove a related file path
     * @param filePath - File path to remove
     */
    removeRelatedFile(filePath: string): void;
    /**
     * Remove a C7 verification entry
     * @param libraryId - Library ID to remove from C7 verifications
     */
    removeC7Verification(libraryId: string): void;
    /**
     * Add a related file path
     * @param filePath - File path relative to project root
     */
    addRelatedFile(filePath: string): void;
    /**
     * Append notes
     * @param notes - Notes to append
     */
    appendNotes(notes: string): void;
    /**
     * Add C7 verification
     * @param verification - C7 verification entry
     */
    addC7Verification(verification: C7Verification): void;
    /**
     * Add an outgoing edge
     * @param taskId - Task ID this task points to
     */
    addEdge(taskId: string): void;
    /**
     * Remove an outgoing edge
     * @param taskId - Task ID to remove from edges
     */
    removeEdge(taskId: string): void;
    /**
     * Add a sub-item task ID
     * @param subItemId - Child task ID
     */
    addSubItem(subItemId: string): void;
    /**
     * Remove a sub-item task ID
     * @param subItemId - Child task ID to remove
     */
    removeSubItem(subItemId: string): void;
    /**
     * Check if the task is complete (ready for review)
     * All three must be complete: success_criteria, deliverables, and need_fix
     * @returns True if all success criteria, deliverables, and need_fix items are complete
     * @private
     */
    private _isComplete;
    /**
     * Update completed_at timestamp and status based on completion state
     * Called automatically after any change to success_criteria, deliverables, or need_fix
     * @private
     */
    private _checkCompletion;
    /**
     * Update the updated_at timestamp
     * Called automatically after any field change
     * @private
     */
    private _touch;
    /**
     * Calculate the derived status based on task state
     *
     * Status is DERIVED from state, not set directly:
     * Priority order: in_review > blocked > in_progress > ready
     *
     * Rules:
     * 1. All criteria + deliverables + need_fix complete → 'in_review' (highest priority)
     * 2. Has blockers (and work NOT complete) → 'blocked'
     * 3. Any item checked OR need_fix exists → 'in_progress'
     * 4. Default → 'ready'
     *
     * NOTE: Blockers only prevent work from starting, not completion. When all
     * items are complete, status is 'in_review' regardless of blockers.
     *
     * NOTE: This is a pure calculation function. It does NOT modify status.
     * Use recalculateStatus() to apply the calculated status.
     *
     * @returns The calculated status based on current task state
     */
    calculateStatus(options?: {
        ignoreBlockers?: boolean;
    }): TaskStatus;
    /**
     * Recalculate and update status based on task state
     * This is the main method to call when task state changes
     *
     * Special cases:
     * - completed tasks with new need_fix items → in_progress (regression)
     * - completed tasks with new blockers → blocked (regression)
     * - Otherwise, completed status is preserved (requires manual approve())
     *
     * @returns The new status (may be same as current)
     */
    recalculateStatus(): TaskStatus;
    /**
     * Approve a task that is in review
     * This is the ONLY manual status transition in the new system
     *
     * @throws {ValidationError} If task is not in 'in_review' status
     */
    approve(): void;
    /**
     * Serialize the task node to plain object
     * Useful for JSON serialization
     */
    toJSON(): TaskNodeType;
    /**
     * Create a TaskNode from plain object
     * Useful for JSON deserialization
     * Skips atomic validation since task was already validated when created
     */
    static fromJSON(data: TaskNodeType): TaskNode;
}
//# sourceMappingURL=task-node.d.ts.map