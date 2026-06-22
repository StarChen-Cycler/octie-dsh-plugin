/**
 * Graph manipulation operations
 *
 * Implements complex graph operations for task management:
 * - Cut nodes from graph while reconnecting edges
 * - Insert nodes between existing nodes
 * - Move subtrees to new parents
 * - Merge tasks together
 *
 * @module core/graph/operations
 */

import type { TaskGraphStore } from './index.js';
import type { MergeResult } from '../../types/index.js';
import { TaskNode } from '../models/task-node.js';
import { TaskNotFoundError, ValidationError } from '../../types/index.js';

/**
 * Cut a node from the graph, reconnecting its incoming edges to its outgoing edges
 *
 * Before: A -> B -> C
 * After:  A -> C (B removed)
 *
 * Algorithm:
 * 1. Get all incoming edges to the node
 * 2. Get all outgoing edges from the node
 * 3. For each incoming source, connect it to all outgoing targets
 * 4. Update target blockers to reference new sources instead of deleted node
 * 5. Remove the node from the graph
 *
 * Time Complexity: O(k * m) where k = incoming edges, m = outgoing edges
 *
 * @param graph - Task graph store
 * @param nodeId - Task ID to cut
 * @throws {TaskNotFoundError} If task not found
 *
 * @returns Array of directly affected target task IDs whose status should be recalculated
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C
 * const affected = cutNode(graph, 'B');
 * // Result: A -> C (B removed, A now points directly to C)
 * // Also: C.blockers updated from [B] to [A]
 * ```
 */
export function cutNode(graph: TaskGraphStore, nodeId: string): string[] {
  if (!graph.hasNode(nodeId)) {
    throw new TaskNotFoundError(nodeId);
  }

  // Get all incoming and outgoing edges before removing the node
  const incomingSources = graph.getIncomingEdges(nodeId);
  const outgoingTargets = graph.getOutgoingEdges(nodeId);

  // Reconnect: for each incoming source, connect to all outgoing targets
  for (const sourceId of incomingSources) {
    for (const targetId of outgoingTargets) {
      // Only add edge if it doesn't already exist
      if (!graph.hasEdge(sourceId, targetId)) {
        graph.addEdge(sourceId, targetId);
        // Update target's blockers array to include the new source
        const targetNode = graph.getNode(targetId);
        if (targetNode && !targetNode.blockers.includes(sourceId)) {
          targetNode.addBlocker(sourceId);
        }
      }
    }
  }

  // Remove deleted nodeId from all targets' blockers arrays
  for (const targetId of outgoingTargets) {
    const targetNode = graph.getNode(targetId);
    if (targetNode && targetNode.blockers.includes(nodeId)) {
      targetNode.removeBlocker(nodeId);
    }
  }

  // Remove the node (this also removes all its edges)
  graph.removeNode(nodeId);

  return outgoingTargets;
}

/**
 * Insert a node between two existing nodes
 *
 * Before: A -> C
 * After:  A -> B -> C
 *
 * Algorithm:
 * 1. Verify both nodes exist
 * 2. Verify edge exists from afterId to beforeId
 * 3. Remove the existing edge
 * 4. Add the new node to the graph
 * 5. Create edges: afterId -> newNodeId -> beforeId
 *
 * Time Complexity: O(1) for edge operations
 *
 * @param graph - Task graph store
 * @param newNode - Task node to insert
 * @param afterId - Source node ID (edge comes from here)
 * @param beforeId - Target node ID (edge goes to here)
 * @throws {TaskNotFoundError} If afterId or beforeId not found
 * @throws {ValidationError} If edge doesn't exist or would create duplicate
 *
 * @example
 * ```ts
 * // Graph: A -> C
 * const newNode = createTaskNode({ title: 'B', ... });
 * insertNodeBetween(graph, newNode, 'A', 'C');
 * // Result: A -> B -> C
 * ```
 */
export function insertNodeBetween(
  graph: TaskGraphStore,
  newNode: TaskNode,
  afterId: string,
  beforeId: string
): void {
  // Verify source and target nodes exist
  if (!graph.hasNode(afterId)) {
    throw new TaskNotFoundError(afterId);
  }
  if (!graph.hasNode(beforeId)) {
    throw new TaskNotFoundError(beforeId);
  }

  // Verify edge exists
  if (!graph.hasEdge(afterId, beforeId)) {
    throw new ValidationError(
      `Edge from '${afterId}' to '${beforeId}' does not exist`,
      'edges'
    );
  }

  // Add the new node to the graph first
  graph.addNode(newNode);

  // Remove the existing edge
  graph.removeEdge(afterId, beforeId);

  // Add new edges: afterId -> newNodeId -> beforeId
  graph.addEdge(afterId, newNode.id);
  graph.addEdge(newNode.id, beforeId);
}

/**
 * Move a subtree to a new parent
 *
 * Moves a task (and all its descendants) to be under a new parent.
 * This is useful for reorganizing task hierarchies.
 *
 * Before:
 *   A -> X
 *   B -> Y
 * After moveSubtree(graph, 'Y', 'A'):
 *   A -> X -> Y
 *   B
 *
 * Algorithm:
 * 1. Get all current parents of the subtree root
 * 2. Remove edges from all current parents
 * 3. Add edge from new parent to subtree root
 *
 * Time Complexity: O(k) where k = number of current parents
 *
 * @param graph - Task graph store
 * @param subtreeRootId - Root of the subtree to move
 * @param newParentId - New parent task ID
 * @throws {TaskNotFoundError} If subtreeRootId or newParentId not found
 * @throws {ValidationError} If edge already exists or would create self-loop
 *
 * @example
 * ```ts
 * // Graph: A -> X, B -> Y
 * moveSubtree(graph, 'Y', 'X');
 * // Result: A -> X -> Y, B
 * ```
 */
export function moveSubtree(
  graph: TaskGraphStore,
  subtreeRootId: string,
  newParentId: string
): void {
  // Verify both nodes exist
  if (!graph.hasNode(subtreeRootId)) {
    throw new TaskNotFoundError(subtreeRootId);
  }
  if (!graph.hasNode(newParentId)) {
    throw new TaskNotFoundError(newParentId);
  }

  // Prevent self-loops
  if (subtreeRootId === newParentId) {
    throw new ValidationError(
      'Cannot move subtree to be its own parent',
      'subtreeRootId'
    );
  }

  // Check if edge already exists
  if (graph.hasEdge(newParentId, subtreeRootId)) {
    throw new ValidationError(
      `Edge from '${newParentId}' to '${subtreeRootId}' already exists`,
      'edges'
    );
  }

  // Get all current parents (nodes that point to subtreeRootId)
  const currentParents = graph.getIncomingEdges(subtreeRootId);

  // Remove from all current parents
  for (const parentId of currentParents) {
    graph.removeEdge(parentId, subtreeRootId);
  }

  // Add to new parent
  graph.addEdge(newParentId, subtreeRootId);
}

/**
 * Merge two tasks into one
 *
 * Combines the source task into the target task by:
 * 1. Merging all properties (description, success_criteria, deliverables, etc.)
 * 2. Reconnecting all edges from source to point to target
 * 3. Removing the source task
 *
 * Before:
 *   A -> source -> C
 *   B -> target -> D
 * After mergeTasks(graph, 'source', 'target'):
 *   A -> target -> C, D
 *   B -> target -> C, D
 *   (source is removed)
 *
 * Algorithm:
 * 1. Get source and target tasks
 * 2. Merge target properties with source properties
 * 3. Get all incoming edges to source (except target)
 * 4. Get all outgoing edges from source (except target)
 * 5. Reconnect edges: incoming -> target, target -> outgoing
 * 6. Remove source node
 * 7. Return merge result
 *
 * Time Complexity: O(k + m) where k = incoming edges, m = outgoing edges
 *
 * @param graph - Task graph store
 * @param sourceId - Source task ID (will be removed)
 * @param targetId - Target task ID (will be kept and merged into)
 * @returns Merge result with merged task and affected task IDs
 * @throws {TaskNotFoundError} If source or target not found
 * @throws {ValidationError} If source and target are the same
 *
 * @example
 * ```ts
 * const result = mergeTasks(graph, 'task-001', 'task-002');
 * console.log('Merged task:', result.task.id);
 * console.log('Removed tasks:', result.removedTasks);
 * ```
 */
export function mergeTasks(
  graph: TaskGraphStore,
  sourceId: string,
  targetId: string
): MergeResult {
  // Verify both tasks exist
  const source = graph.getNode(sourceId);
  const target = graph.getNode(targetId);

  if (!source) {
    throw new TaskNotFoundError(sourceId);
  }
  if (!target) {
    throw new TaskNotFoundError(targetId);
  }

  // Cannot merge a task with itself
  if (sourceId === targetId) {
    throw new ValidationError(
      'Cannot merge a task with itself',
      'sourceId'
    );
  }

  // Merge properties into target task
  // Merge descriptions with separator
  const newDescription = target.description
    ? `${target.description}\n\n--- Merged from "${source.title}" ---\n${source.description}`
    : source.description;
  target.setDescription(newDescription);

  // Merge success criteria (avoiding duplicates by ID)
  for (const sc of source.success_criteria) {
    if (!target.success_criteria.some(tsc => tsc.id === sc.id)) {
      target.addSuccessCriterion(sc);
    }
  }

  // Merge deliverables (avoiding duplicates by ID)
  for (const d of source.deliverables) {
    if (!target.deliverables.some(td => td.id === d.id)) {
      target.addDeliverable(d);
    }
  }

  // Merge related files (avoiding duplicates)
  for (const file of source.related_files) {
    target.addRelatedFile(file);
  }

  // Merge notes with separator
  const newNotes = target.notes
    ? `${target.notes}\n\nMerged notes from "${source.title}":\n${source.notes}`
    : source.notes;
  target.appendNotes(newNotes);

  // Merge C7 verifications
  for (const cv of source.c7_verified) {
    target.addC7Verification(cv);
  }

  // Remove source from target's blockers (source is being merged/removed)
  if (target.blockers.includes(sourceId)) {
    target.removeBlocker(sourceId);
  }

  // Merge blockers (avoiding duplicates, self-references, and non-existent tasks)
  for (const blockerId of source.blockers) {
    // Skip if: self-reference, already a blocker, or blocker task no longer exists
    if (blockerId !== targetId && !target.blockers.includes(blockerId) && graph.hasNode(blockerId)) {
      target.addBlocker(blockerId);
    }
  }

  // Merge dependencies explanation text (combine both)
  if (source.dependencies) {
    if (target.dependencies) {
      target.setDependencies(`${target.dependencies}\n${source.dependencies}`);
    } else {
      target.setDependencies(source.dependencies);
    }
  }

  // Track which tasks were affected by reconnection
  const reconnectSources: string[] = [];
  const reconnectTargets: string[] = [];

  // Get source's incoming edges (tasks pointing to source)
  const sourceIncoming = graph.getIncomingEdges(sourceId);
  // Get source's outgoing edges (tasks source points to)
  const sourceOutgoing = graph.getOutgoingEdges(sourceId);

  // Reconnect incoming edges (except target and self-loops)
  for (const fromId of sourceIncoming) {
    if (fromId !== targetId && !graph.hasEdge(fromId, targetId)) {
      graph.addEdge(fromId, targetId);
      reconnectSources.push(fromId);
    }
  }

  // Reconnect outgoing edges (except target and self-loops)
  for (const toId of sourceOutgoing) {
    if (toId !== targetId && !graph.hasEdge(targetId, toId)) {
      graph.addEdge(targetId, toId);
      reconnectTargets.push(toId);
    }
  }

  // Update the target task in the graph with merged data
  graph.updateNode(target);

  // Clean up source from all dependent tasks' blockers before removing source
  for (const task of graph.getAllTasks()) {
    if (task.blockers.includes(sourceId)) {
      task.removeBlocker(sourceId);
    }
  }

  // Remove the source task
  graph.removeNode(sourceId);

  const propagationResult = graph.propagateStatus(targetId);

  // Collect all affected task IDs
  const allAffected = new Set([
    ...reconnectSources,
    ...reconnectTargets,
    targetId,
    ...propagationResult.updatedTasks,
  ]);

  return {
    task: target,
    removedTasks: [sourceId],
    updatedTasks: Array.from(allAffected)
  };
}

/**
 * Get all descendants of a node (transitive closure via outgoing edges)
 *
 * Returns all tasks reachable from the given node.
 *
 * @param graph - Task graph store
 * @param nodeId - Starting task ID
 * @returns Set of descendant task IDs (including the starting node)
 * @throws {TaskNotFoundError} If node not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C, A -> D
 * const descendants = getDescendants(graph, 'A');
 * // Returns: ['A', 'B', 'C', 'D']
 * ```
 */
export function getDescendants(graph: TaskGraphStore, nodeId: string): Set<string> {
  if (!graph.hasNode(nodeId)) {
    throw new TaskNotFoundError(nodeId);
  }

  const descendants = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (descendants.has(current)) {
      continue;
    }

    descendants.add(current);

    // Add all children to the stack
    const children = graph.getOutgoingEdges(current);
    for (const child of children) {
      if (!descendants.has(child)) {
        stack.push(child);
      }
    }
  }

  return descendants;
}

/**
 * Get all ancestors of a node (transitive closure via incoming edges)
 *
 * Returns all tasks that can reach the given node.
 *
 * @param graph - Task graph store
 * @param nodeId - Starting task ID
 * @returns Set of ancestor task IDs (including the starting node)
 * @throws {TaskNotFoundError} If node not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C
 * const ancestors = getAncestors(graph, 'C');
 * // Returns: ['C', 'B', 'A']
 * ```
 */
export function getAncestors(graph: TaskGraphStore, nodeId: string): Set<string> {
  if (!graph.hasNode(nodeId)) {
    throw new TaskNotFoundError(nodeId);
  }

  const ancestors = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (ancestors.has(current)) {
      continue;
    }

    ancestors.add(current);

    // Add all parents to the stack
    const parents = graph.getIncomingEdges(current);
    for (const parent of parents) {
      if (!ancestors.has(parent)) {
        stack.push(parent);
      }
    }
  }

  return ancestors;
}

/**
 * Validate that moving a subtree won't create a cycle
 *
 * Checks if adding an edge from newParentId to subtreeRootId would create a cycle.
 * This is important for moveSubtree operations.
 *
 * @param graph - Task graph store
 * @param subtreeRootId - Root of the subtree to move
 * @param newParentId - Potential new parent task ID
 * @returns true if move is safe (won't create cycle), false otherwise
 * @throws {TaskNotFoundError} If either task not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C
 * if (isValidSubtreeMove(graph, 'C', 'A')) {
 *   // This would create a cycle (A -> B -> C -> A)
 *   // Don't allow the move
 * }
 * ```
 */
export function isValidSubtreeMove(
  graph: TaskGraphStore,
  subtreeRootId: string,
  newParentId: string
): boolean {
  if (!graph.hasNode(subtreeRootId)) {
    throw new TaskNotFoundError(subtreeRootId);
  }
  if (!graph.hasNode(newParentId)) {
    throw new TaskNotFoundError(newParentId);
  }

  // Check if newParentId is in the descendants of subtreeRootId
  // If so, adding edge subtreeRootId -> newParentId would create a cycle
  const descendants = getDescendants(graph, subtreeRootId);
  return !descendants.has(newParentId);
}

/**
 * Cascade delete a node and all its dependent tasks
 *
 * Deletes the specified node and all tasks that depend on it (directly or transitively).
 * Tasks are deleted in reverse order (leaves first) to maintain graph integrity.
 *
 * Before:
 *   A -> B -> C -> D
 * After cascadeDelete(graph, 'B'):
 *   A (B, C, D removed)
 *
 * Algorithm:
 * 1. Get all descendants of the node (tasks that depend on it transitively)
 * 2. Iteratively find and delete leaf nodes (no outgoing edges) first
 * 3. Continue until all descendants are deleted
 *
 * Time Complexity: O(k * m) where k = descendants, m = average edges
 *
 * @param graph - Task graph store
 * @param nodeId - Task ID to cascade delete
 * @returns Array of deleted task IDs (in order of deletion)
 * @throws {TaskNotFoundError} If node not found
 *
 * @example
 * ```ts
 * // Graph: A -> B -> C -> D
 * const deleted = cascadeDelete(graph, 'B');
 * // Returns: ['D', 'C', 'B'] (deleted in this order)
 * // Result: Only A remains
 * ```
 */
export function cascadeDelete(graph: TaskGraphStore, nodeId: string): string[] {
  if (!graph.hasNode(nodeId)) {
    throw new TaskNotFoundError(nodeId);
  }

  const deletedIds: string[] = [];

  // Get all tasks that depend on this node (directly or transitively)
  const descendants = getDescendants(graph, nodeId);

  // Remove the original node from descendants set for processing
  // We'll delete it last (or as part of the iterative process)
  const toDelete = new Set(descendants);

  // Iteratively delete leaf nodes (nodes with no outgoing edges in remaining set)
  while (toDelete.size > 0) {
    let deletedThisRound = false;

    for (const id of toDelete) {
      // Check if this node is a leaf (no outgoing edges to other nodes in toDelete)
      const outgoing = graph.getOutgoingEdges(id);
      const hasDependentsInSet = outgoing.some(depId => toDelete.has(depId));

      if (!hasDependentsInSet) {
        // This is a leaf in our deletion set, safe to delete
        graph.removeNode(id);
        deletedIds.push(id);
        toDelete.delete(id);
        deletedThisRound = true;
        break; // Restart loop after each deletion
      }
    }

    // Safety check to prevent infinite loop
    if (!deletedThisRound && toDelete.size > 0) {
      // This shouldn't happen in a valid DAG, but handle gracefully
      // Force delete remaining nodes
      for (const id of toDelete) {
        graph.removeNode(id);
        deletedIds.push(id);
      }
      break;
    }
  }

  return deletedIds;
}
