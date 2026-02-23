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

import { v4 as uuidv4 } from 'uuid';
import type {
  TaskNode as TaskNodeType,
  TaskStatus,
  TaskPriority,
  SuccessCriterion,
  Deliverable,
  C7Verification,
  FixItem,
} from '../../types/index.js';
import {
  ValidationError,
  AtomicTaskViolationError,
  ImmutabilityViolationError,
} from '../../types/index.js';

/**
 * Action verbs that indicate specific, executable tasks
 */
const ACTION_VERBS = [
  'implement',
  'create',
  'add',
  'fix',
  'remove',
  'update',
  'refactor',
  'write',
  'test',
  'document',
  'deploy',
  'configure',
  'setup',
  'design',
  'analyze',
  'optimize',
  'migrate',
  'integrate',
  'build',
  'install',
  'check',
  'verify',
  'validate',
  'extract',
  'generate',
  'parse',
  'compile',
  'debug',
  'resolve',
  'handle',
  'process',
  'transform',
  'convert',
  'compress',
  'encrypt',
  'decrypt',
  'sanitize',
  'normalize',
  'format',
  'render',
  'display',
  'calculate',
  'compute',
  'measure',
  'track',
  'monitor',
  'log',
  'cache',
  'store',
  'retrieve',
  'fetch',
  'load',
  'save',
  'export',
  'import',
  'sync',
  'merge',
  'split',
  'parse',
  'serialize',
  'deserialize',
  'encode',
  'decode',
  'hash',
  'sign',
  'verify',
  'authenticate',
  'authorize',
  'connect',
  'disconnect',
  'bind',
  'unbind',
  'attach',
  'detach',
  'mount',
  'unmount',
  'register',
  'unregister',
  'subscribe',
  'unsubscribe',
  'publish',
  'listen',
  'emit',
  'dispatch',
  'route',
  'forward',
  'redirect',
  'proxy',
  'mirror',
  'replicate',
  'shard',
  'partition',
  'index',
  'search',
  'query',
  'filter',
  'sort',
  'group',
  'aggregate',
  'reduce',
  'map',
  'flatMap',
  'collect',
  'stream',
  'buffer',
  'flush',
  'drain',
  'close',
  'open',
  'read',
  'write',
  'seek',
  'truncate',
  'append',
  'prepend',
  'insert',
  'delete',
  'erase',
  'clear',
  'reset',
  'rollback',
  'commit',
  'transact',
  'lock',
  'unlock',
  'acquire',
  'release',
  'wait',
  'notify',
  'signal',
  'interrupt',
  'cancel',
  'abort',
  'retry',
  'replay',
  'schedule',
  'queue',
  'enqueue',
  'dequeue',
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'slice',
  'copy',
  'clone',
  'deepClone',
  'merge',
  'patch',
  'diff',
  'compare',
  'match',
  'replace',
  'substitute',
  'translate',
  'localize',
  'format',
  'parse',
  'tokenize',
  'lex',
  'parse',
  'evaluate',
  'execute',
  'interpret',
  'compile',
  'link',
  'build',
  'assemble',
  'package',
  'distribute',
  'release',
  'version',
  'tag',
  'branch',
  'merge',
  'rebase',
  'cherry-pick',
  'stash',
  'apply',
  'checkout',
  'clone',
  'fork',
  'pull',
  'push',
  'fetch',
  'remote',
  'init',
  'status',
  'log',
  'diff',
  'show',
  'blame',
  'grep',
  'find',
  'locate',
  'search',
];

/**
 * Vague patterns that indicate non-specific tasks
 * Note: Action verbs like 'fix', 'update', 'handle', etc. are NOT here
 * because they are valid action verbs that make tasks specific when combined
 * with context (e.g., "Fix login bug" is specific, "Fix stuff" is vague)
 */
const VAGUE_PATTERNS = [
  'stuff',
  'things',
  'etc',
  'various',
  'some',
  'something',
  'work on',
  'deal with',
];

/**
 * Subjective words that indicate non-quantitative criteria
 */
const SUBJECTIVE_WORDS = [
  'good',
  'better',
  'best',
  'proper',
  'nice',
  'clean',
  'fast',
  'slow',
  'efficient',
  'effective',
  'responsive',
  'user-friendly',
  'intuitive',
  'seamless',
  'smooth',
  'robust',
  'reliable',
  'scalable',
  'maintainable',
  'readable',
  'understandable',
  'clear',
  'simple',
  'easy',
  'flexible',
  'extensible',
  'modular',
  'well-structured',
  'well-organized',
  'well-designed',
];

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
export function validateAtomicTask(taskData: {
  title: string;
  description: string;
  success_criteria: SuccessCriterion[];
  deliverables: Deliverable[];
}): void {
  const violations: string[] = [];
  const titleLower = taskData.title.toLowerCase().trim();

  // Check title specificity
  // Skip action verb check for Unicode titles (non-ASCII characters)
  // as they may be valid in other languages (Chinese, Japanese, etc.)
  const isUnicodeTitle = /[^\x00-\x7F]/.test(taskData.title);
  const hasActionVerb = !isUnicodeTitle && ACTION_VERBS.some(verb =>
    titleLower.includes(verb.toLowerCase())
  );

  if (!isUnicodeTitle && !hasActionVerb) {
    violations.push(
      'Title should contain an action verb (implement, create, fix, add, write, test, etc.)'
    );
  }

  // Check for vague titles (vague words anywhere in title)
  // Skip vague check for Unicode titles (non-ASCII characters)
  const isVague = !isUnicodeTitle && VAGUE_PATTERNS.some(pattern => {
    const patternLower = pattern.toLowerCase();
    // Match if title is exactly the pattern, starts with it, or contains it as a word
    return titleLower === patternLower ||
           titleLower.startsWith(patternLower + ' ') ||
           titleLower.includes(' ' + patternLower);
  });

  if (!isUnicodeTitle && isVague) {
    violations.push(
      'Title is too vague. Be specific about what the task does. Avoid words like "stuff", "things", "various", "etc", "fix", "update", "work on"'
    );
  }

  // Check title isn't just a generic verb
  // Skip length check for Unicode titles (non-ASCII characters)
  if (!isUnicodeTitle && titleLower.length < 10) {
    violations.push(
      'Title is too short. Provide more context about what will be done (e.g., "Implement login endpoint" instead of just "Implement")'
    );
  }

  // Check description length
  if (taskData.description.trim().length < 50) {
    violations.push(
      'Description is too short (min 50 characters). Provide more detail about what this task does and how it will be accomplished.'
    );
  }

  if (taskData.description.trim().length > 10000) {
    violations.push(
      'Description is too long (max 10000 characters). Consider splitting into smaller tasks.'
    );
  }

  // Check success criteria count
  if (taskData.success_criteria.length > 10) {
    violations.push(
      `Too many success criteria (${taskData.success_criteria.length} > 10). This suggests the task is too large and should be split into smaller, focused tasks.`
    );
  }

  // Check deliverables count
  if (taskData.deliverables.length > 5) {
    violations.push(
      `Too many deliverables (${taskData.deliverables.length} > 5). This suggests the task is too large and should be split into smaller, focused tasks.`
    );
  }

  // Check if criteria are quantitative
  const hasVagueCriteria = taskData.success_criteria.some(criterion => {
    const textLower = criterion.text.toLowerCase();
    return SUBJECTIVE_WORDS.some(word => textLower.includes(word));
  });

  if (hasVagueCriteria) {
    violations.push(
      'Success criteria must be quantitative and measurable. Avoid subjective terms like "good", "better", "proper", "clean", "fast", "efficient", "responsive". Instead use specific metrics: "returns 200 status", "completes in < 100ms", "passes all unit tests", "has 100% code coverage".'
    );
  }

  // Check criteria aren't empty or just whitespace
  const hasEmptyCriterion = taskData.success_criteria.some(
    c => c.text.trim().length === 0
  );

  if (hasEmptyCriterion) {
    violations.push('Success criteria cannot be empty or whitespace.');
  }

  // Check deliverables aren't empty or just whitespace
  const hasEmptyDeliverable = taskData.deliverables.some(
    d => d.text.trim().length === 0
  );

  if (hasEmptyDeliverable) {
    violations.push('Deliverables cannot be empty or whitespace.');
  }

  // Check that all criteria and deliverables start with a verb or are specific
  const hasVagueCriterion = taskData.success_criteria.some(c => {
    const textLower = c.text.toLowerCase().trim();
    return VAGUE_PATTERNS.some(pattern => textLower.startsWith(pattern));
  });

  if (hasVagueCriterion) {
    violations.push(
      'Success criteria must be specific. Avoid vague phrases like "works properly", "is correct", "functions as expected". Use specific outcomes: "endpoint returns 200 with valid JWT", "password is hashed with bcrypt", "test coverage is 100%".'
    );
  }

  // Check that deliverables are specific files or outputs
  const hasVagueDeliverable = taskData.deliverables.some(d => {
    const textLower = d.text.toLowerCase().trim();
    // Allow file paths or specific outputs
    return (
      !textLower.includes('.') &&
      !textLower.includes('file') &&
      !textLower.includes('test') &&
      !textLower.includes('component') &&
      !textLower.includes('module') &&
      !textLower.includes('class') &&
      !textLower.includes('function') &&
      !textLower.includes('endpoint') &&
      !textLower.includes('api') &&
      !textLower.includes('service') &&
      textLower.split(' ').length < 3
    );
  });

  if (hasVagueDeliverable) {
    violations.push(
      'Deliverables must be specific. Include file paths (e.g., "src/auth/login.ts") or specific outputs (e.g., "POST /auth/login endpoint"). Avoid vague terms like "code", "implementation", "feature".'
    );
  }

  if (violations.length > 0) {
    throw new AtomicTaskViolationError(
      `Task "${taskData.title}" violates atomic task requirements.`,
      violations
    );
  }
}

/**
 * Valid status transitions for the new status model
 *
 * Most transitions are AUTOMATIC via calculateStatus():
 * - ready → in_progress (when item checked or need_fix added)
 * - in_progress → in_review (when all criteria + deliverables + need_fix complete)
 * - ANY → blocked (when blocker added)
 * - blocked → ready (when all blockers resolved)
 * - in_review → in_progress (when need_fix added)
 * - completed → in_progress (when need_fix added - regression)
 *
 * MANUAL TRANSITIONS:
 * - in_review → completed (reviewer approval via approve() method)
 * - in_progress → completed (backward compatibility, prefer approve() for new code)
 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  ready: ['in_progress', 'blocked'],
  in_progress: ['in_review', 'completed', 'blocked'],
  in_review: ['completed', 'in_progress', 'blocked'],
  completed: ['in_progress', 'blocked'],
  blocked: ['ready'],
};

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
export class TaskNode implements TaskNodeType {
  // Public readonly properties (identity)
  readonly id: string;

  // Public properties (can be modified through methods)
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

  // Auto-managed timestamps (private with public getters)
  private _created_at: string;
  private _updated_at: string;
  private _completed_at: string | null;

  // Graph edges (outgoing)
  edges: string[];

  /**
   * Get the creation timestamp (immutable)
   */
  get created_at(): string {
    return this._created_at;
  }

  /**
   * Get the last update timestamp (auto-managed)
   */
  get updated_at(): string {
    return this._updated_at;
  }

  /**
   * Get the completion timestamp (auto-managed, null if not complete)
   */
  get completed_at(): string | null {
    return this._completed_at;
  }

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
    _skipAtomicValidation?: boolean; // Private: only for fromJSON deserialization
  }) {
    // Validate required fields
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError(
        'Title is required and cannot be empty or whitespace.',
        'title'
      );
    }

    if (data.title.length > 200) {
      throw new ValidationError(
        'Title must be 200 characters or less.',
        'title'
      );
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError(
        'Description is required and cannot be empty or whitespace.',
        'description'
      );
    }

    if (data.description.length < 50) {
      throw new ValidationError(
        'Description must be at least 50 characters.',
        'description'
      );
    }

    if (data.description.length > 10000) {
      throw new ValidationError(
        'Description must be 10000 characters or less.',
        'description'
      );
    }

    if (!data.success_criteria || data.success_criteria.length === 0) {
      throw new ValidationError(
        'At least one success criterion is required.',
        'success_criteria'
      );
    }

    if (data.success_criteria.length > 10) {
      throw new ValidationError(
        'Too many success criteria (max 10). Split into smaller tasks.',
        'success_criteria'
      );
    }

    if (!data.deliverables || data.deliverables.length === 0) {
      throw new ValidationError(
        'At least one deliverable is required.',
        'deliverables'
      );
    }

    if (data.deliverables.length > 10) {
      throw new ValidationError(
        'Too many deliverables (max 10). Split into smaller tasks.',
        'deliverables'
      );
    }

    // Validate atomic task requirements (skip for deserialization)
    if (!data._skipAtomicValidation) {
      validateAtomicTask({
        title: data.title,
        description: data.description,
        success_criteria: data.success_criteria,
        deliverables: data.deliverables,
      });
    }

    // Set basic properties
    this.id = data.id || uuidv4();
    this.title = data.title.trim();
    this.description = data.description.trim();
    this.status = data.status || 'ready';
    this.priority = data.priority || 'second';
    this.success_criteria = [...(data.success_criteria || [])];
    this.deliverables = [...(data.deliverables || [])];
    this.need_fix = [...(data.need_fix || [])];
    this.assignee = data.assignee ?? null;
    this.blockers = [...(data.blockers || [])];
    this.dependencies = data.dependencies || '';
    this.sub_items = [...(data.sub_items || [])];
    this.related_files = [...(data.related_files || [])];
    this.notes = (data.notes || '').trim();
    this.c7_verified = [...(data.c7_verified || [])];
    this.edges = [...(data.edges || [])];

    // Set timestamps (auto-managed, cannot be set via constructor)
    const now = new Date().toISOString();
    this._created_at = now; // Always set on creation
    this._updated_at = now; // Initially same as created_at
    this._completed_at = null; // Will be set by _checkCompletion()

    // Calculate status based on blockers and work state (if not explicitly provided)
    // This ensures tasks created with blockers get 'blocked' status
    if (!data.status) {
      this.status = this.calculateStatus();
    }

    // Check if task is already complete (for loaded tasks)
    this._checkCompletion();
  }

  /**
   * Update the task title
   * @param title - New title
   */
  setTitle(title: string): void {
    if (title.trim().length === 0) {
      throw new ValidationError('Title cannot be empty or whitespace.', 'title');
    }
    if (title.length > 200) {
      throw new ValidationError('Title must be 200 characters or less.', 'title');
    }
    this.title = title.trim();
    this._touch();
  }

  /**
   * Update the task description
   * @param description - New description
   */
  setDescription(description: string): void {
    if (description.trim().length < 50) {
      throw new ValidationError('Description must be at least 50 characters.', 'description');
    }
    if (description.length > 10000) {
      throw new ValidationError('Description must be 10000 characters or less.', 'description');
    }
    this.description = description.trim();
    this._touch();
  }

  /**
   * Update the task status
   * @param status - New status
   */
  setStatus(status: TaskStatus): void {
    // Allow setting to same status (no-op)
    if (status === this.status) {
      return;
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[this.status];
    if (!allowedTransitions.includes(status)) {
      throw new ValidationError(
        `Invalid status transition from '${this.status}' to '${status}'. Allowed: ${allowedTransitions.join(', ')}`,
        'status'
      );
    }

    // When manually setting to completed, check all criteria are met FIRST
    if (status === 'completed') {
      const allComplete = this._isComplete();
      if (!allComplete) {
        throw new ValidationError(
          'Cannot mark task as completed until all success criteria and deliverables are complete.',
          'status'
        );
      }
    }

    // Now set the status
    this.status = status;
    this._touch();
  }

  /**
   * Update the task priority
   * @param priority - New priority
   */
  setPriority(priority: TaskPriority): void {
    this.priority = priority;
    this._touch();
  }

  /**
   * Add a success criterion
   * @param criterion - Success criterion to add
   */
  addSuccessCriterion(criterion: SuccessCriterion): void {
    if (this.success_criteria.length >= 10) {
      throw new ValidationError(
        'Too many success criteria (max 10). Split into smaller tasks.',
        'success_criteria'
      );
    }
    this.success_criteria.push(criterion);
    this._touch();
    this._checkCompletion();
  }

  /**
   * Mark a success criterion as complete
   * @param criterionId - ID of the criterion to mark complete
   */
  completeCriterion(criterionId: string): void {
    const criterion = this.success_criteria.find(c => c.id === criterionId);
    if (!criterion) {
      throw new ValidationError(`Success criterion with ID '${criterionId}' not found.`, 'success_criteria');
    }
    criterion.completed = true;
    criterion.completed_at = new Date().toISOString();
    this._touch();
    this._checkCompletion();
    this.recalculateStatus(); // Auto-transition status based on state
  }

  /**
   * Unmark a success criterion as complete
   * @param criterionId - ID of the criterion to unmark
   * @throws {ImmutabilityViolationError} If criterion is already completed (immutable)
   */
  uncompleteCriterion(criterionId: string): void {
    const criterion = this.success_criteria.find(c => c.id === criterionId);
    if (!criterion) {
      throw new ValidationError(`Success criterion with ID '${criterionId}' not found.`, 'success_criteria');
    }
    // Immutability check: cannot uncheck completed items
    if (criterion.completed) {
      throw new ImmutabilityViolationError(
        `Cannot uncheck completed success criterion '${criterion.text.substring(0, 50)}...'. Completed items are immutable.`,
        criterionId,
        'success_criterion'
      );
    }
    criterion.completed = false;
    delete criterion.completed_at;
    this._touch();
    this._checkCompletion();
  }

  /**
   * Add a deliverable
   * @param deliverable - Deliverable to add
   */
  addDeliverable(deliverable: Deliverable): void {
    if (this.deliverables.length >= 10) {
      throw new ValidationError(
        'Too many deliverables (max 10). Split into smaller tasks.',
        'deliverables'
      );
    }
    this.deliverables.push(deliverable);
    this._touch();
    this._checkCompletion();
  }

  /**
   * Mark a deliverable as complete
   * @param deliverableId - ID of the deliverable to mark complete
   */
  completeDeliverable(deliverableId: string): void {
    const deliverable = this.deliverables.find(d => d.id === deliverableId);
    if (!deliverable) {
      throw new ValidationError(`Deliverable with ID '${deliverableId}' not found.`, 'deliverables');
    }
    deliverable.completed = true;
    this._touch();
    this._checkCompletion();
    this.recalculateStatus(); // Auto-transition status based on state
  }

  /**
   * Unmark a deliverable as complete
   * @param deliverableId - ID of the deliverable to unmark
   * @throws {ImmutabilityViolationError} If deliverable is already completed (immutable)
   */
  uncompleteDeliverable(deliverableId: string): void {
    const deliverable = this.deliverables.find(d => d.id === deliverableId);
    if (!deliverable) {
      throw new ValidationError(`Deliverable with ID '${deliverableId}' not found.`, 'deliverables');
    }
    // Immutability check: cannot uncheck completed items
    if (deliverable.completed) {
      throw new ImmutabilityViolationError(
        `Cannot uncheck completed deliverable '${deliverable.text.substring(0, 50)}...'. Completed items are immutable.`,
        deliverableId,
        'deliverable'
      );
    }
    deliverable.completed = false;
    this._touch();
    this._checkCompletion();
  }

  /**
   * Add a need_fix item
   * Need_fix items are blocking issues that must be resolved before review
   * @param text - Description of what needs to be fixed
   * @param options - Optional file_path and source
   */
  addNeedFix(text: string, options?: { file_path?: string; source?: FixItem['source'] }): void {
    const fixItem: FixItem = {
      id: uuidv4(),
      text: text.trim(),
      completed: false,
      file_path: options?.file_path,
      added_at: new Date().toISOString(),
      source: options?.source,
    };
    this.need_fix.push(fixItem);
    this._touch();
    this._checkCompletion();
    this.recalculateStatus(); // Auto-transition status based on state
  }

  /**
   * Mark a need_fix item as complete
   * @param fixId - ID of the need_fix item to mark complete
   */
  completeNeedFix(fixId: string): void {
    const fixItem = this.need_fix.find(f => f.id === fixId);
    if (!fixItem) {
      throw new ValidationError(`Need_fix item with ID '${fixId}' not found.`, 'need_fix');
    }
    fixItem.completed = true;
    this._touch();
    this._checkCompletion();
    this.recalculateStatus(); // Auto-transition status based on state
  }

  /**
   * Set the assignee for this task
   * Assignee is decoupled from status - just a placeholder for future team management
   * @param agentId - Agent/session ID, or null to clear
   */
  setAssignee(agentId: string | null): void {
    this.assignee = agentId;
    this._touch();
  }

  /**
   * Add a blocker task ID
   * @param blockerId - Task ID that blocks this task
   */
  addBlocker(blockerId: string): void {
    if (!this.blockers.includes(blockerId)) {
      this.blockers.push(blockerId);
      this._touch();
      this.recalculateStatus(); // Auto-transition to blocked (Rule 4)
    }
  }

  /**
   * Remove a blocker task ID
   * @param blockerId - Task ID to remove from blockers
   */
  removeBlocker(blockerId: string): void {
    const index = this.blockers.indexOf(blockerId);
    if (index > -1) {
      this.blockers.splice(index, 1);
      this._touch();
      this.recalculateStatus(); // Auto-transition when all blockers resolved (Rule 5)
    }
  }

  /**
   * Set the dependencies explanation text (twin to blockers)
   * @param explanation - Explanatory text describing WHY this task depends on its blockers
   */
  setDependencies(explanation: string): void {
    this.dependencies = explanation.trim();
    this._touch();
  }

  /**
   * Clear the dependencies explanation text
   * Typically called when removing the last blocker
   */
  clearDependencies(): void {
    this.dependencies = '';
    this._touch();
  }

  /**
   * Remove a success criterion
   * @param criterionId - ID of the criterion to remove
   * @throws {ValidationError} If criterion not found or removal would leave no criteria
   * @throws {ImmutabilityViolationError} If criterion is completed (immutable)
   */
  removeSuccessCriterion(criterionId: string): void {
    const index = this.success_criteria.findIndex(c => c.id === criterionId);
    if (index === -1) {
      throw new ValidationError(`Success criterion with ID '${criterionId}' not found.`, 'success_criteria');
    }
    // Immutability check: cannot remove completed items
    const criterion = this.success_criteria[index]!;
    if (criterion.completed) {
      throw new ImmutabilityViolationError(
        `Cannot remove completed success criterion '${criterion.text.substring(0, 50)}...'. Completed items are immutable.`,
        criterionId,
        'success_criterion'
      );
    }
    if (this.success_criteria.length <= 1) {
      throw new ValidationError(
        'Cannot remove the last success criterion. At least one is required.',
        'success_criteria'
      );
    }
    this.success_criteria.splice(index, 1);
    this._touch();
    this._checkCompletion();
  }

  /**
   * Remove a deliverable
   * @param deliverableId - ID of the deliverable to remove
   * @throws {ValidationError} If deliverable not found or removal would leave no deliverables
   * @throws {ImmutabilityViolationError} If deliverable is completed (immutable)
   */
  removeDeliverable(deliverableId: string): void {
    const index = this.deliverables.findIndex(d => d.id === deliverableId);
    if (index === -1) {
      throw new ValidationError(`Deliverable with ID '${deliverableId}' not found.`, 'deliverables');
    }
    // Immutability check: cannot remove completed items
    const deliverable = this.deliverables[index]!;
    if (deliverable.completed) {
      throw new ImmutabilityViolationError(
        `Cannot remove completed deliverable '${deliverable.text.substring(0, 50)}...'. Completed items are immutable.`,
        deliverableId,
        'deliverable'
      );
    }
    if (this.deliverables.length <= 1) {
      throw new ValidationError(
        'Cannot remove the last deliverable. At least one is required.',
        'deliverables'
      );
    }
    this.deliverables.splice(index, 1);
    this._touch();
    this._checkCompletion();
  }

  /**
   * Remove a related file path
   * @param filePath - File path to remove
   */
  removeRelatedFile(filePath: string): void {
    const index = this.related_files.indexOf(filePath);
    if (index > -1) {
      this.related_files.splice(index, 1);
      this._touch();
    }
  }

  /**
   * Remove a C7 verification entry
   * @param libraryId - Library ID to remove from C7 verifications
   */
  removeC7Verification(libraryId: string): void {
    const index = this.c7_verified.findIndex(v => v.library_id === libraryId);
    if (index > -1) {
      this.c7_verified.splice(index, 1);
      this._touch();
    }
  }

  /**
   * Add a related file path
   * @param filePath - File path relative to project root
   */
  addRelatedFile(filePath: string): void {
    if (!this.related_files.includes(filePath)) {
      this.related_files.push(filePath);
      this._touch();
    }
  }

  /**
   * Append notes
   * @param notes - Notes to append
   */
  appendNotes(notes: string): void {
    if (notes.trim().length > 0) {
      if (this.notes.length > 0) {
        this.notes += '\n\n';
      }
      this.notes += notes.trim();
      this._touch();
    }
  }

  /**
   * Add C7 verification
   * @param verification - C7 verification entry
   */
  addC7Verification(verification: C7Verification): void {
    this.c7_verified.push(verification);
    this._touch();
  }

  /**
   * Add an outgoing edge
   * @param taskId - Task ID this task points to
   */
  addEdge(taskId: string): void {
    if (!this.edges.includes(taskId)) {
      this.edges.push(taskId);
      this._touch();
    }
  }

  /**
   * Remove an outgoing edge
   * @param taskId - Task ID to remove from edges
   */
  removeEdge(taskId: string): void {
    const index = this.edges.indexOf(taskId);
    if (index > -1) {
      this.edges.splice(index, 1);
      this._touch();
    }
  }

  /**
   * Add a sub-item task ID
   * @param subItemId - Child task ID
   */
  addSubItem(subItemId: string): void {
    if (!this.sub_items.includes(subItemId)) {
      this.sub_items.push(subItemId);
      this._touch();
    }
  }

  /**
   * Remove a sub-item task ID
   * @param subItemId - Child task ID to remove
   */
  removeSubItem(subItemId: string): void {
    const index = this.sub_items.indexOf(subItemId);
    if (index > -1) {
      this.sub_items.splice(index, 1);
      this._touch();
    }
  }

  /**
   * Check if the task is complete (ready for review)
   * All three must be complete: success_criteria, deliverables, and need_fix
   * @returns True if all success criteria, deliverables, and need_fix items are complete
   * @private
   */
  private _isComplete(): boolean {
    const allCriteriaComplete = this.success_criteria.every(c => c.completed);
    const allDeliverablesComplete = this.deliverables.every(d => d.completed);
    const allNeedFixComplete = this.need_fix.every(f => f.completed);
    return allCriteriaComplete && allDeliverablesComplete && allNeedFixComplete;
  }

  /**
   * Update completed_at timestamp and status based on completion state
   * Called automatically after any change to success_criteria, deliverables, or need_fix
   * @private
   */
  private _checkCompletion(): void {
    const isComplete = this._isComplete();

    if (isComplete && !this._completed_at) {
      // All complete and not yet set - set the timestamp
      this._completed_at = new Date().toISOString();
    } else if (!isComplete && this._completed_at) {
      // Not all complete but timestamp is set - clear it
      this._completed_at = null;

      // Auto-reset status from 'completed' or 'in_review' to 'in_progress' when task becomes incomplete
      // This happens when a new criterion/deliverable/need_fix is added
      if (this.status === 'completed' || this.status === 'in_review') {
        this.status = 'in_progress';
      }
    }
  }

  /**
   * Update the updated_at timestamp
   * Called automatically after any field change
   * @private
   */
  private _touch(): void {
    this._updated_at = new Date().toISOString();
  }

  /**
   * Calculate the derived status based on task state
   *
   * Status is DERIVED from state, not set directly:
   * Priority order: blocked > in_review > in_progress > ready
   *
   * Rules:
   * 1. Has unresolved blockers → 'blocked'
   * 2. All criteria + deliverables + need_fix complete → 'in_review'
   * 3. Any item checked OR need_fix exists → 'in_progress'
   * 4. Default → 'ready'
   *
   * NOTE: This is a pure calculation function. It does NOT modify status.
   * Use recalculateStatus() to apply the calculated status.
   *
   * @returns The calculated status based on current task state
   */
  calculateStatus(): TaskStatus {
    // Rule 1: Check if blocked (highest priority)
    // Note: This only checks if blockers exist, not if they're resolved
    // The caller (graph) is responsible for checking blocker status
    if (this.blockers.length > 0) {
      return 'blocked';
    }

    // Rule 2: Check if ready for review (all items complete)
    const allCriteriaComplete = this.success_criteria.every(c => c.completed);
    const allDeliverablesComplete = this.deliverables.every(d => d.completed);
    const allNeedFixComplete = this.need_fix.every(f => f.completed);
    const allComplete = allCriteriaComplete && allDeliverablesComplete && allNeedFixComplete;

    if (allComplete) {
      return 'in_review';
    }

    // Rule 3: Check if work has started
    const anyCriteriaChecked = this.success_criteria.some(c => c.completed);
    const anyDeliverableChecked = this.deliverables.some(d => d.completed);
    const hasNeedFix = this.need_fix.length > 0;

    if (anyCriteriaChecked || anyDeliverableChecked || hasNeedFix) {
      return 'in_progress';
    }

    // Rule 4: Default - ready for work
    return 'ready';
  }

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
  recalculateStatus(): TaskStatus {
    const newStatus = this.calculateStatus();

    // Special handling for completed tasks
    if (this.status === 'completed') {
      // Regression: need_fix added or blocker added → leave completed state
      if (newStatus === 'in_progress' || newStatus === 'blocked') {
        this.status = newStatus;
        this._touch();
      }
      // Otherwise stay completed (no change)
      return this.status;
    }

    // For non-completed tasks, always update to calculated status
    if (newStatus !== this.status) {
      this.status = newStatus;
      this._touch();
    }

    return this.status;
  }

  /**
   * Approve a task that is in review
   * This is the ONLY manual status transition in the new system
   *
   * @throws {ValidationError} If task is not in 'in_review' status
   */
  approve(): void {
    if (this.status !== 'in_review') {
      throw new ValidationError(
        `Cannot approve task in '${this.status}' status. Task must be in 'in_review' status.`,
        'status'
      );
    }
    this.status = 'completed';
    this._touch();
  }

  /**
   * Serialize the task node to plain object
   * Useful for JSON serialization
   */
  toJSON(): TaskNodeType {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      success_criteria: this.success_criteria,
      deliverables: this.deliverables,
      need_fix: this.need_fix,
      assignee: this.assignee,
      blockers: this.blockers,
      dependencies: this.dependencies,
      sub_items: this.sub_items,
      related_files: this.related_files,
      notes: this.notes,
      c7_verified: this.c7_verified,
      created_at: this._created_at,
      updated_at: this._updated_at,
      completed_at: this._completed_at,
      edges: this.edges,
    };
  }

  /**
   * Create a TaskNode from plain object
   * Useful for JSON deserialization
   * Skips atomic validation since task was already validated when created
   */
  static fromJSON(data: TaskNodeType): TaskNode {
    // Migrate old statuses to new ones (handle legacy data with old status values)
    const statusStr = data.status as string;
    let migratedStatus: TaskStatus = data.status;
    if (statusStr === 'not_started' || statusStr === 'pending') {
      migratedStatus = 'ready';
    }

    const node = new TaskNode({
      id: data.id,
      title: data.title,
      description: data.description,
      status: migratedStatus,
      priority: data.priority,
      success_criteria: data.success_criteria,
      deliverables: data.deliverables,
      need_fix: data.need_fix || [], // Default to empty array for legacy data
      assignee: data.assignee ?? null, // Default to null for legacy data
      blockers: data.blockers,
      dependencies: data.dependencies,
      sub_items: data.sub_items,
      related_files: data.related_files,
      notes: data.notes,
      c7_verified: data.c7_verified,
      edges: data.edges,
      _skipAtomicValidation: true, // Skip validation for deserialized tasks
    });

    // Preserve timestamps from loaded data
    node._created_at = data.created_at;
    node._updated_at = data.updated_at;
    node._completed_at = data.completed_at;

    return node;
  }
}
