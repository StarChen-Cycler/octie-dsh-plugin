/**
 * Status Helper Functions
 *
 * Utilities for automatic status transitions in the graph-based task system.
 *
 * @module core/utils/status-helpers
 */

import type { TaskGraphStore } from '../graph/index.js';

/**
 * Recalculate status of all tasks that depend on a blocker
 *
 * When a blocker task's status changes (e.g., completed), this function
 * recalculates the status of all tasks that were blocked by it.
 *
 * This enables the "all blockers resolved → ready" automatic transition
 * from the status refactor spec (Rule 5).
 *
 * @param blockerId - The ID of the task whose status changed
 * @param graph - The task graph containing all tasks
 * @returns Array of task IDs that had their status recalculated
 */
export function recalculateDependentStatuses(
  blockerId: string,
  graph: TaskGraphStore
): string[] {
  const updatedTaskIds: string[] = [];

  // Find all tasks that have this blocker in their blockers array
  for (const task of graph.getAllTasks()) {
    if (task.blockers.includes(blockerId)) {
      const oldStatus = task.status;

      // Check if ALL blockers are now resolved (completed or deleted)
      const allBlockersResolved = areAllBlockersResolved(task.blockers, graph);

      if (allBlockersResolved) {
        // All blockers are resolved - delegate to canonical status calculation
        // with ignoreBlockers since blockers are all completed/deleted
        const newStatus = task.calculateStatus({ ignoreBlockers: true });

        if (newStatus !== task.status) {
          task.status = newStatus;
          task.recalculateStatus();
        }
      } else {
        // Still has active blockers - just recalculate normally
        task.recalculateStatus();
      }

      if (task.status !== oldStatus) {
        updatedTaskIds.push(task.id);
      }
    }
  }

  return updatedTaskIds;
}

/**
 * Check if all blockers for a task are resolved
 *
 * A blocker is considered resolved if:
 * - The blocker task has status 'completed', OR
 * - The blocker task no longer exists in the graph
 *
 * @param taskBlockers - Array of blocker task IDs
 * @param graph - The task graph to check blocker status
 * @returns True if all blockers are resolved or there are no blockers
 */
export function areAllBlockersResolved(
  taskBlockers: string[],
  graph: TaskGraphStore
): boolean {
  if (taskBlockers.length === 0) {
    return true;
  }

  for (const blockerId of taskBlockers) {
    const blockerTask = graph.getNode(blockerId);
    // If blocker doesn't exist or is not completed, task is still blocked
    if (blockerTask && blockerTask.status !== 'completed') {
      return false;
    }
  }

  return true;
}

/**
 * Get all tasks that are blocking a given task
 *
 * @param taskId - The task to get blockers for
 * @param graph - The task graph
 * @returns Array of blocker task nodes
 */
export function getActiveBlockers(
  taskId: string,
  graph: TaskGraphStore
): Array<{ id: string; title: string; status: string }> {
  const task = graph.getNode(taskId);
  if (!task || task.blockers.length === 0) {
    return [];
  }

  const blockers: Array<{ id: string; title: string; status: string }> = [];

  for (const blockerId of task.blockers) {
    const blockerTask = graph.getNode(blockerId);
    if (blockerTask && blockerTask.status !== 'completed') {
      blockers.push({
        id: blockerId,
        title: blockerTask.title,
        status: blockerTask.status,
      });
    }
  }

  return blockers;
}

/**
 * Get all tasks that this task is blocking
 *
 * @param taskId - The task to find dependents for
 * @param graph - The task graph
 * @returns Array of task nodes that are blocked by this task
 */
export function getTasksBlockedBy(
  taskId: string,
  graph: TaskGraphStore
): Array<{ id: string; title: string; status: string }> {
  const blockedTasks: Array<{ id: string; title: string; status: string }> = [];

  for (const task of graph.getAllTasks()) {
    if (task.blockers.includes(taskId)) {
      blockedTasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
      });
    }
  }

  return blockedTasks;
}
