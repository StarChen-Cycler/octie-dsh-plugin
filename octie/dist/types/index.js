/**
 * Core type definitions for Octie task management system
 *
 * This module defines all TypeScript interfaces and types used throughout the system.
 * @module types
 */
/**
 * Error code to HTTP status code mapping
 * Used by API error handler to return appropriate status codes
 */
export const ERROR_STATUS_MAP = {
    // Client errors (4xx)
    TASK_NOT_FOUND: 404,
    PROJECT_NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    ATOMIC_TASK_VIOLATION: 400,
    INVALID_ARGUMENT: 400,
    INVALID_TASK_ID: 400,
    CIRCULAR_DEPENDENCY: 400,
    DUPLICATE_TASK: 409,
    CONCURRENT_MODIFICATION: 409,
    // Server errors (5xx)
    FILE_OPERATION_ERROR: 500,
    STORAGE_ERROR: 500,
    INTERNAL_ERROR: 500,
};
/**
 * Error code to suggestion mapping
 * Provides actionable recovery steps for each error type
 */
export const ERROR_SUGGESTIONS = {
    TASK_NOT_FOUND: 'Use `octie list` to see all available tasks and their IDs.',
    PROJECT_NOT_FOUND: 'Run `octie init` to create a new project or use `--project <path>` to specify the project directory.',
    VALIDATION_ERROR: 'Check the input format and ensure all required fields are provided.',
    ATOMIC_TASK_VIOLATION: 'Split the task into smaller, focused tasks with specific deliverables.',
    INVALID_ARGUMENT: 'Check the command syntax with `octie <command> --help`.',
    INVALID_TASK_ID: 'Task IDs must be valid UUIDs. Use `octie list` to find the correct task ID.',
    CIRCULAR_DEPENDENCY: 'Remove one of the edges in the cycle using `octie update <id> --unblock <blocker_id>`.',
    DUPLICATE_TASK: 'Use `octie list --search <query>` to find existing similar tasks.',
    CONCURRENT_MODIFICATION: 'The project changed while this operation was running. Reload the project and retry the operation.',
    FILE_OPERATION_ERROR: 'Check file permissions and ensure the .octie directory is writable.',
    STORAGE_ERROR: 'Try restoring from backup with `octie import --file .octie/project.json.bak`.',
    INTERNAL_ERROR: 'Run with --verbose flag for more details or check the logs.',
};
/**
 * Custom error base class
 * All Octie-specific errors extend this class
 */
export class OctieError extends Error {
    code;
    /** Optional suggestion for how to resolve the error */
    suggestion;
    /** HTTP status code for API responses */
    statusCode;
    constructor(message, code, suggestion) {
        super(message);
        this.code = code;
        this.name = 'OctieError';
        this.suggestion = suggestion ?? ERROR_SUGGESTIONS[code];
        this.statusCode = ERROR_STATUS_MAP[code] ?? 500;
    }
}
/**
 * Error thrown when a task is not found
 */
export class TaskNotFoundError extends OctieError {
    constructor(taskId) {
        super(`Task with ID '${taskId}' not found`, 'TASK_NOT_FOUND', `Use \`octie list\` to see all available tasks. The ID '${taskId}' may be incorrect or the task may have been deleted.`);
        this.name = 'TaskNotFoundError';
    }
}
/**
 * Error thrown when a short UUID prefix matches multiple tasks
 */
export class AmbiguousIdError extends OctieError {
    constructor(prefix, matchingIds) {
        super(`ID prefix '${prefix}' matches multiple tasks: ${matchingIds.map(id => id.substring(0, 7)).join(', ')}. Please provide more characters.`, 'AMBIGUOUS_ID', `The ID prefix '${prefix}' is too short and matches ${matchingIds.length} tasks. Provide more characters (up to the full UUID) to uniquely identify a task.`);
        this.name = 'AmbiguousIdError';
    }
}
/**
 * Error thrown when a project is not found
 */
export class ProjectNotFoundError extends OctieError {
    constructor(path) {
        super(path ? `No Octie project found at '${path}'` : 'No Octie project found', 'PROJECT_NOT_FOUND', 'Run `octie init` to create a new project in the current directory, or use `--project <path>` to specify a different project directory.');
        this.name = 'ProjectNotFoundError';
    }
}
/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends OctieError {
    cycleNodes;
    constructor(cycleNodes) {
        super(`Circular dependency detected: ${cycleNodes.join(' -> ')}`, 'CIRCULAR_DEPENDENCY', `Break the cycle by removing one of the dependencies. Use \`octie update ${cycleNodes[0]} --unblock ${cycleNodes[cycleNodes.length - 1]}\` or restructure your task graph.`);
        this.cycleNodes = cycleNodes;
        this.name = 'CircularDependencyError';
    }
}
/**
 * Error thrown when file operations fail
 */
export class FileOperationError extends OctieError {
    filePath;
    constructor(message, filePath) {
        super(`${message}: ${filePath}`, 'FILE_OPERATION_ERROR', `Check file permissions and ensure the path is correct. If the file is corrupted, try restoring from backup: \`octie import --file .octie/project.json.bak\``);
        this.filePath = filePath;
        this.name = 'FileOperationError';
    }
}
/**
 * Error thrown when a project changed after a caller loaded it.
 * Callers must reload before applying their mutation again so no write is lost.
 */
export class ConcurrentModificationError extends OctieError {
    filePath;
    constructor(filePath) {
        super('Project changed since it was loaded', 'CONCURRENT_MODIFICATION', 'Reload the project and retry the operation so it applies to the latest task graph.');
        this.filePath = filePath;
        this.name = 'ConcurrentModificationError';
    }
}
/**
 * Error thrown when validation fails
 */
export class ValidationError extends OctieError {
    field;
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR', field ? `Check the '${field}' field and ensure it meets the requirements.` : 'Check the input format and ensure all required fields are provided.');
        this.field = field;
        this.name = 'ValidationError';
    }
}
/**
 * Error thrown when atomic task validation fails
 */
export class AtomicTaskViolationError extends ValidationError {
    violations;
    constructor(message, violations) {
        super(message, 'ATOMIC_TASK_VIOLATION');
        this.violations = violations;
        this.name = 'AtomicTaskViolationError';
        // Override suggestion with specific violations
        this.suggestion = `Task violates atomic task requirements:\n${violations.map(v => `  • ${v}`).join('\n')}\n\nSplit into smaller tasks or make the task more specific.`;
    }
}
/**
 * Error thrown when an invalid argument is provided
 */
export class InvalidArgumentError extends OctieError {
    constructor(message, suggestion) {
        super(message, 'INVALID_ARGUMENT', suggestion ?? 'Check the command syntax with `octie <command> --help`.');
        this.name = 'InvalidArgumentError';
    }
}
/**
 * Error thrown when a duplicate is detected
 */
export class DuplicateTaskError extends OctieError {
    constructor(identifier) {
        super(`Task already exists: ${identifier}`, 'DUPLICATE_TASK', 'Use `octie list --search <query>` to find the existing task, or use a different identifier.');
        this.name = 'DuplicateTaskError';
    }
}
/**
 * Error thrown when storage operations fail
 */
export class StorageError extends OctieError {
    constructor(message, suggestion) {
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
    itemId;
    /** Type of the item (success_criterion, deliverable, need_fix) */
    itemType;
    constructor(message, itemId, itemType) {
        super(message, itemType);
        this.name = 'ImmutabilityViolationError';
        this.itemId = itemId;
        this.itemType = itemType;
    }
}
//# sourceMappingURL=index.js.map