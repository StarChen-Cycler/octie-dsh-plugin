/**
 * Core type definitions for Octie task management system
 *
 * This module defines all TypeScript interfaces and types used throughout the system.
 * @module types
 */

/**
 * Task status enumeration
 * Represents the current state of a task in the workflow
 *
 * Status is DERIVED from task state, not set directly:
 * - ready: Task available for any agent to work
 * - in_progress: Work in progress (item checked or need_fix added)
 * - in_review: All items complete, awaiting review
 * - completed: Approved by reviewer (ONLY manual transition)
 * - blocked: Automatically set when blocker relationship exists
 */
export type TaskStatus = 'ready' | 'in_progress' | 'in_review' | 'completed' | 'blocked';

/**
 * Task priority enumeration
 * Indicates the importance and execution order priority
 */
export type TaskPriority = 'top' | 'second' | 'later';

/**
 * Edge type enumeration for graph relationships
 * Defines the nature of connections between tasks
 */
export type EdgeType = 'blocks';

/**
 * Success criterion for task completion validation
 * Each task must have at least one quantitative success criterion
 */
export interface SuccessCriterion {
  /** Unique identifier for the criterion */
  id: string;
  /** Description of the success criterion (must be quantitative/measurable) */
  text: string;
  /** Whether the criterion has been completed */
  completed: boolean;
  /** ISO 8601 timestamp when criterion was marked complete */
  completed_at?: string;
}

/**
 * Deliverable expected from task completion
 * Each task must have at least one specific deliverable
 */
export interface Deliverable {
  /** Unique identifier for the deliverable */
  id: string;
  /** Description of the deliverable */
  text: string;
  /** Whether the deliverable has been completed */
  completed: boolean;
  /** Optional file path linking to the actual deliverable file */
  file_path?: string;
}

/**
 * Fix item for blocking issues that must be resolved before review
 * Has equal importance to success_criteria and deliverables
 * All three must be complete before task can enter in_review status
 */
export interface FixItem {
  /** Unique identifier for the fix item */
  id: string;
  /** Description of what needs to be fixed */
  text: string;
  /** Whether the fix has been applied */
  completed: boolean;
  /** Optional file path indicating which file needs fixing */
  file_path?: string;
  /** ISO 8601 timestamp when item was added */
  added_at: string;
  /** Source of the fix item */
  source?: 'review' | 'runtime' | 'regression';
}

/**
 * C7 MCP library verification entry
 * Records external library best practice verifications
 */
export interface C7Verification {
  /** Context7 library ID (e.g., "/mongodb/docs") */
  library_id: string;
  /** ISO 8601 timestamp of verification */
  verified_at: string;
  /** Optional notes about the verification */
  notes?: string;
}

/**
 * Graph edge representing relationships between tasks
 */
export interface GraphEdge {
  /** Source task ID */
  from: string;
  /** Target task ID */
  to: string;
  /** Type of edge relationship */
  type: EdgeType;
}

/**
 * Complete task node data
 * Contains all task information excluding edges
 */
export interface TaskData {
  /** Unique identifier (UUID v4 format) */
  id: string;
  /** Short descriptive name (max 200 characters) */
  title: string;
  /** Detailed task explanation (markdown-supported, 50-10000 characters) */
  description: string;
  /** Current status of the task (derived from state, not set directly) */
  status: TaskStatus;
  /** Priority level for execution ordering */
  priority: TaskPriority;
  /** Array of quantitative completion criteria (min 1, max 10) */
  success_criteria: SuccessCriterion[];
  /** Array of specific expected outputs (min 1, max 5) */
  deliverables: Deliverable[];
  /** Blocking issues that must be resolved before review (equal importance to criteria/deliverables) */
  need_fix: FixItem[];
  /** Optional agent/session that owns this task (decoupled from status) */
  assignee: string | null;
  /** Task IDs that must complete before this task can start (creates graph edges) */
  blockers: string[];
  /** Explanatory text describing WHY this task depends on its blockers (twin to blockers) */
  dependencies: string;
  /** Child task IDs (sub-items) */
  sub_items: string[];
  /** File paths relevant to this task (relative to project root) */
  related_files: string[];
  /** Additional context or comments (markdown) */
  notes: string;
  /** C7 MCP library verification entries */
  c7_verified: C7Verification[];
  /** ISO 8601 timestamp - Auto-generated on creation, immutable */
  created_at: string;
  /** ISO 8601 timestamp - Auto-updated on any field change */
  updated_at: string;
  /** ISO 8601 timestamp or null - Auto-set when all criteria and deliverables complete */
  completed_at: string | null;
}

/**
 * Complete task node including edges
 * Main data structure for tasks in the graph
 */
export interface TaskNode extends TaskData {
  /** Outgoing edges (tasks that this task enables) */
  edges: string[];
}

/**
 * Task graph structure
 * Represents the complete task dependency graph
 */
export interface TaskGraph {
  /** Map of task ID to task node */
  nodes: Map<string, TaskNode>;
  /** Map of task ID to outgoing edges */
  outgoingEdges: Map<string, Set<string>>;
  /** Map of task ID to incoming edges */
  incomingEdges: Map<string, Set<string>>;
  /** Graph metadata */
  metadata: ProjectMetadata;
}

/**
 * Project metadata
 * Contains information about the project itself
 */
export interface ProjectMetadata {
  /** Project name */
  project_name: string;
  /** Project version */
  version: string;
  /** ISO 8601 timestamp when project was created */
  created_at: string;
  /** ISO 8601 timestamp when project was last updated */
  updated_at: string;
  /** Optional project description */
  description?: string;
}

/**
 * Project file structure for serialization
 * Format used when saving project to JSON file
 */
export interface ProjectFile {
  /** All tasks indexed by ID */
  tasks: Record<string, TaskNode>;
  /** Graph edges for serialization */
  edges: GraphEdge[];
  /** Project metadata */
  metadata: ProjectMetadata;
  /** Optional indexes for fast lookup */
  indexes?: ProjectIndexes;
  /** JSON schema reference */
  $schema?: string;
  /** File format version */
  version?: string;
  /** File format identifier */
  format?: string;
  /** Index signature for additional properties */
  [key: string]: unknown;
}

/**
 * Project indexes for efficient queries
 * Built and maintained by the IndexManager
 */
export interface ProjectIndexes {
  /** Tasks grouped by status */
  byStatus: Record<TaskStatus, string[]>;
  /** Tasks grouped by priority */
  byPriority: Record<TaskPriority, string[]>;
  /** Tasks with no incoming edges (starting points) */
  rootTasks: string[];
  /** Tasks with no edges (isolated) */
  orphanTasks: string[];
  /** Full-text search index (term -> task IDs) */
  searchText: Record<string, string[]>;
  /** File reference index (file path -> task IDs) */
  files: Record<string, string[]>;
}

/**
 * Snapshot graph health summary
 * Stored alongside immutable history entries for audit/debug visibility.
 */
export interface SnapshotGraphHealth {
  /** Total tasks in the graph */
  task_count: number;
  /** Total edges in the graph */
  edge_count: number;
  /** Tasks with no edges */
  orphan_count: number;
  /** Tasks with no incoming edges */
  root_count: number;
  /** Whether the graph contains a cycle */
  has_cycle: boolean;
}

/**
 * Immutable snapshot metadata entry recorded in history.ndjson.
 */
export interface SnapshotHistoryEntry extends SnapshotGraphHealth {
  /** Immutable snapshot ID */
  snapshot_id: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** Why the snapshot was created */
  reason: string;
  /** Command or subsystem that triggered the snapshot */
  source_command: string;
  /** SHA-256 hash of the live project.json contents */
  live_file_hash: string;
  /** Relative path to the immutable snapshot file */
  snapshot_file: string;
  /** Target snapshot if this snapshot was created before a restore */
  restored_from_snapshot_id?: string;
}

/**
 * Error code to HTTP status code mapping
 * Used by API error handler to return appropriate status codes
 */
export const ERROR_STATUS_MAP: Record<string, number> = {
  // Client errors (4xx)
  TASK_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  ATOMIC_TASK_VIOLATION: 400,
  INVALID_ARGUMENT: 400,
  INVALID_TASK_ID: 400,
  CIRCULAR_DEPENDENCY: 400,
  DUPLICATE_TASK: 409,
  // Server errors (5xx)
  FILE_OPERATION_ERROR: 500,
  STORAGE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

/**
 * Error code to suggestion mapping
 * Provides actionable recovery steps for each error type
 */
export const ERROR_SUGGESTIONS: Record<string, string> = {
  TASK_NOT_FOUND: 'Use `octie list` to see all available tasks and their IDs.',
  PROJECT_NOT_FOUND: 'Run `octie init` to create a new project or use `--project <path>` to specify the project directory.',
  VALIDATION_ERROR: 'Check the input format and ensure all required fields are provided.',
  ATOMIC_TASK_VIOLATION: 'Split the task into smaller, focused tasks with specific deliverables.',
  INVALID_ARGUMENT: 'Check the command syntax with `octie <command> --help`.',
  INVALID_TASK_ID: 'Task IDs must be valid UUIDs. Use `octie list` to find the correct task ID.',
  CIRCULAR_DEPENDENCY: 'Remove one of the edges in the cycle using `octie update <id> --unblock <blocker_id>`.',
  DUPLICATE_TASK: 'Use `octie list --search <query>` to find existing similar tasks.',
  FILE_OPERATION_ERROR: 'Check file permissions and ensure the .octie directory is writable.',
  STORAGE_ERROR: 'Try restoring from backup with `octie import --file .octie/project.json.bak`.',
  INTERNAL_ERROR: 'Run with --verbose flag for more details or check the logs.',
};

/**
 * Custom error base class
 * All Octie-specific errors extend this class
 */
export class OctieError extends Error {
  /** Optional suggestion for how to resolve the error */
  public readonly suggestion?: string;
  /** HTTP status code for API responses */
  public readonly statusCode: number;

  constructor(message: string, public code: string, suggestion?: string) {
    super(message);
    this.name = 'OctieError';
    this.suggestion = suggestion ?? ERROR_SUGGESTIONS[code];
    this.statusCode = ERROR_STATUS_MAP[code] ?? 500;
  }
}

/**
 * Error thrown when a task is not found
 */
export class TaskNotFoundError extends OctieError {
  constructor(taskId: string) {
    super(
      `Task with ID '${taskId}' not found`,
      'TASK_NOT_FOUND',
      `Use \`octie list\` to see all available tasks. The ID '${taskId}' may be incorrect or the task may have been deleted.`
    );
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Error thrown when a short UUID prefix matches multiple tasks
 */
export class AmbiguousIdError extends OctieError {
  constructor(prefix: string, matchingIds: string[]) {
    super(
      `ID prefix '${prefix}' matches multiple tasks: ${matchingIds.map(id => id.substring(0, 7)).join(', ')}. Please provide more characters.`,
      'AMBIGUOUS_ID',
      `The ID prefix '${prefix}' is too short and matches ${matchingIds.length} tasks. Provide more characters (up to the full UUID) to uniquely identify a task.`
    );
    this.name = 'AmbiguousIdError';
  }
}

/**
 * Error thrown when a project is not found
 */
export class ProjectNotFoundError extends OctieError {
  constructor(path?: string) {
    super(
      path ? `No Octie project found at '${path}'` : 'No Octie project found',
      'PROJECT_NOT_FOUND',
      'Run `octie init` to create a new project in the current directory, or use `--project <path>` to specify a different project directory.'
    );
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends OctieError {
  constructor(public cycleNodes: string[]) {
    super(
      `Circular dependency detected: ${cycleNodes.join(' -> ')}`,
      'CIRCULAR_DEPENDENCY',
      `Break the cycle by removing one of the dependencies. Use \`octie update ${cycleNodes[0]} --unblock ${cycleNodes[cycleNodes.length - 1]}\` or restructure your task graph.`
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileOperationError extends OctieError {
  constructor(message: string, public filePath: string) {
    super(
      `${message}: ${filePath}`,
      'FILE_OPERATION_ERROR',
      `Check file permissions and ensure the path is correct. If the file is corrupted, try restoring from backup: \`octie import --file .octie/project.json.bak\``
    );
    this.name = 'FileOperationError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends OctieError {
  constructor(message: string, public field?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      field ? `Check the '${field}' field and ensure it meets the requirements.` : 'Check the input format and ensure all required fields are provided.'
    );
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when atomic task validation fails
 */
export class AtomicTaskViolationError extends ValidationError {
  constructor(message: string, public violations: string[]) {
    super(
      message,
      'ATOMIC_TASK_VIOLATION'
    );
    this.name = 'AtomicTaskViolationError';
    // Override suggestion with specific violations
    (this as any).suggestion = `Task violates atomic task requirements:\n${violations.map(v => `  • ${v}`).join('\n')}\n\nSplit into smaller tasks or make the task more specific.`;
  }
}

/**
 * Error thrown when an invalid argument is provided
 */
export class InvalidArgumentError extends OctieError {
  constructor(message: string, suggestion?: string) {
    super(message, 'INVALID_ARGUMENT', suggestion ?? 'Check the command syntax with `octie <command> --help`.');
    this.name = 'InvalidArgumentError';
  }
}

/**
 * Error thrown when a duplicate is detected
 */
export class DuplicateTaskError extends OctieError {
  constructor(identifier: string) {
    super(
      `Task already exists: ${identifier}`,
      'DUPLICATE_TASK',
      'Use `octie list --search <query>` to find the existing task, or use a different identifier.'
    );
    this.name = 'DuplicateTaskError';
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends OctieError {
  constructor(message: string, suggestion?: string) {
    super(message, 'STORAGE_ERROR', suggestion ?? 'Try restoring from backup or re-initialize the project.');
    this.name = 'StorageError';
  }
}

/**
 * Immutability violation error
 * Thrown when attempting to modify completed items that are immutable
 *
 * Per the status refactor spec:
 * - success_criteria items: Cannot be unchecked or deleted once completed
 * - deliverables items: Cannot be unchecked or deleted once completed
 * - need_fix items: Cannot be deleted or unmarked once completed
 */
export class ImmutabilityViolationError extends ValidationError {
  /** ID of the item that cannot be modified */
  readonly itemId: string;
  /** Type of the item (success_criterion, deliverable, need_fix) */
  readonly itemType: string;

  constructor(message: string, itemId: string, itemType: string) {
    super(message, itemType);
    this.name = 'ImmutabilityViolationError';
    this.itemId = itemId;
    this.itemType = itemType;
  }
}

/**
 * Topological sort result
 * Returned by graph topological sort operations
 */
export interface TopologicalSortResult {
  /** Linearly ordered task IDs */
  sorted: string[];
  /** Whether a cycle was detected */
  hasCycle: boolean;
  /** Nodes involved in cycle (if detected) */
  cycleNodes: string[];
}

/**
 * Cycle detection result
 * Returned by graph cycle detection operations
 */
export interface CycleDetectionResult {
  /** Whether cycles exist in the graph */
  hasCycle: boolean;
  /** Array of cycles (each cycle is an array of task IDs) */
  cycles: string[][];
}

/**
 * Task filter options
 * Used for querying and filtering tasks
 */
export interface TaskFilterOptions {
  /** Filter by status */
  status?: TaskStatus;
  /** Filter by priority */
  priority?: TaskPriority;
  /** Filter by related file */
  relatedFile?: string;
  /** Full-text search query */
  searchQuery?: string;
  /** Include completed tasks */
  includeCompleted?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Task creation options
 * Parameters for creating a new task
 */
export interface TaskCreateOptions {
  /** Task title (required, 1-200 chars) */
  title: string;
  /** Task description (required, 50-10000 chars) */
  description: string;
  /** Success criteria (required, min 1, max 10) */
  successCriteria: string[];
  /** Deliverables (required, min 1, max 5) */
  deliverables: string[];
  /** Task priority (default: 'second') */
  priority?: TaskPriority;
  /** Blocking task IDs */
  blockers?: string[];
  /** Dependency task IDs */
  dependencies?: string[];
  /** Related file paths */
  relatedFiles?: string[];
  /** Additional notes */
  notes?: string;
  /** C7 verification entries */
  c7Verified?: C7Verification[];
}

/**
 * Task update options
 * Parameters for updating an existing task
 */
export interface TaskUpdateOptions {
  /** New status */
  status?: TaskStatus;
  /** New priority */
  priority?: TaskPriority;
  /** Success criterion to mark complete */
  completeCriterion?: string;
  /** Deliverable to mark complete */
  completeDeliverable?: string;
  /** Success criterion to add */
  addSuccessCriterion?: string;
  /** Deliverable to add */
  addDeliverable?: string;
  /** Task ID to block this task */
  block?: string;
  /** Task ID to unblock */
  unblock?: string;
  /** Task ID to depend on */
  addDependency?: string;
  /** Notes to append */
  notes?: string;
}

/**
 * Merge result
 * Returned by task merge operations
 */
export interface MergeResult {
  /** Merged task node */
  task: TaskNode;
  /** Tasks that were removed */
  removedTasks: string[];
  /** Tasks that were updated (reconnected) */
  updatedTasks: string[];
}

/**
 * Graph statistics
 * Aggregated information about the task graph
 */
export interface GraphStatistics {
  /** Total number of tasks */
  totalTasks: number;
  /** Tasks by status */
  tasksByStatus: Record<TaskStatus, number>;
  /** Tasks by priority */
  tasksByPriority: Record<TaskPriority, number>;
  /** Number of edges */
  totalEdges: number;
  /** Number of root tasks */
  rootTasks: number;
  /** Number of orphan tasks */
  orphanTasks: number;
  /** Whether graph has cycles */
  hasCycles: boolean;
  /** Longest path length (critical path) */
  criticalPathLength: number;
}

/**
 * Web server configuration options
 */
export interface ServerOptions {
  /** Port to run server on (default: 3000) */
  port?: number;
  /** Host to bind to (default: 'localhost') */
  host?: string;
  /** Open browser automatically (default: false) */
  open?: boolean;
  /** Enable CORS (default: true) */
  cors?: boolean;
  /** Enable request logging (default: true) */
  logging?: boolean;
}

/**
 * API response wrapper
 * Standard response format for all API endpoints
 */
export interface ApiResponse<T = unknown> {
  /** Indicates success of the request */
  success: boolean;
  /** Response data on success */
  data?: T;
  /** Error details on failure */
  error?: {
    /** Error code for programmatic handling */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: unknown;
  };
  /** ISO 8601 timestamp of response */
  timestamp: string;
}

/**
 * API error response
 * Returned when an API request fails
 */
export interface ApiErrorResponse {
  /** Indicates failure */
  success: false;
  /** Error details */
  error: {
    /** Error code for programmatic handling */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: unknown;
  };
  /** ISO 8601 timestamp of response */
  timestamp: string;
}
