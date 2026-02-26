/**
 * Task Graph data structure
 *
 * Implements a directed graph using adjacency lists for O(1) node lookup
 * and O(k) edge traversal where k is the number of edges.
 *
 * Graph Structure:
 * - nodes: Map<taskId, TaskNode> for O(1) node lookup
 * - outgoingEdges: Map<taskId, Set<targetTaskIds>> for forward traversal
 * - incomingEdges: Map<taskId, Set<sourceTaskIds>> for reverse traversal
 *
 * @module core/graph
 */

import type { TaskGraph, ProjectMetadata, TaskStatus } from '../../types/index.js';
import { TaskNotFoundError, ValidationError, AmbiguousIdError } from '../../types/index.js';
import { TaskNode } from '../models/task-node.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * TaskGraphStore class
 *
 * Manages the task graph data structure with efficient lookup and traversal.
 * Uses Map and Set for optimal performance:
 * - O(1) node lookup by ID
 * - O(k) edge traversal where k = edge count
 * - O(1) edge existence checking
 */
export class TaskGraphStore {
  /** Primary node storage (hash map for O(1) lookup) */
  private _nodes: Map<string, TaskNode>;

  /** Outgoing edges: node -> nodes it points to */
  private _outgoingEdges: Map<string, Set<string>>;

  /** Incoming edges: node -> nodes pointing to it */
  private _incomingEdges: Map<string, Set<string>>;

  /** Graph metadata */
  private _metadata: ProjectMetadata;

  /**
   * Create a new TaskGraphStore
   * @param metadata - Optional project metadata
   */
  constructor(metadata?: ProjectMetadata) {
    this._nodes = new Map();
    this._outgoingEdges = new Map();
    this._incomingEdges = new Map();
    this._metadata = metadata || {
      project_name: 'Untitled Project',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get the number of tasks in the graph
   */
  get size(): number {
    return this._nodes.size;
  }

  /**
   * Get the graph metadata
   */
  get metadata(): ProjectMetadata {
    return { ...this._metadata };
  }

  /**
   * Update graph metadata
   * @param metadata - New metadata values (partial update)
   */
  setMetadata(metadata: Partial<ProjectMetadata>): void {
    this._metadata = {
      ...this._metadata,
      ...metadata,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get a task node by ID
   * @param id - Task ID to look up
   * @returns Task node or undefined if not found
   * @complexity O(1)
   */
  getNode(id: string): TaskNode | undefined {
    return this._nodes.get(id);
  }

  /**
   * Get a task node by ID or throw error
   * @param id - Task ID to look up
   * @returns Task node
   * @throws {TaskNotFoundError} If task not found
   * @complexity O(1)
   */
  getNodeOrThrow(id: string): TaskNode {
    const node = this._nodes.get(id);
    if (!node) {
      throw new TaskNotFoundError(id);
    }
    return node;
  }

  /**
   * Check if a task exists
   * @param id - Task ID to check
   * @returns True if task exists
   * @complexity O(1)
   */
  hasNode(id: string): boolean {
    return this._nodes.has(id);
  }

  /**
   * Get a task node by short UUID prefix (first 7-8 characters)
   * @param prefix - Short UUID prefix to look up
   * @returns Task node or undefined if not found
   * @throws {AmbiguousIdError} If multiple tasks match the prefix
   * @complexity O(n) where n is the number of tasks
   */
  getNodeByPrefix(prefix: string): TaskNode | undefined {
    const matches: TaskNode[] = [];
    const lowerPrefix = prefix.toLowerCase();

    for (const [id, node] of this._nodes) {
      if (id.toLowerCase().startsWith(lowerPrefix)) {
        matches.push(node);
        if (matches.length > 1) {
          throw new AmbiguousIdError(prefix, matches.map(m => m.id));
        }
      }
    }

    return matches[0];
  }

  /**
   * Get a task node by ID or prefix
   * @param id - Task ID or short UUID prefix to look up
   * @returns Task node or undefined if not found
   * @complexity O(1) for full ID, O(n) for prefix
   */
  getNodeByIdOrPrefix(id: string): TaskNode | undefined {
    // Try exact match first (O(1))
    const exactMatch = this.getNode(id);
    if (exactMatch) return exactMatch;

    // Fall back to prefix search (O(n))
    return this.getNodeByPrefix(id);
  }

  /**
   * Generate a unique task ID with collision detection
   * Ensures that the first 7 characters of the UUID are unique across all tasks
   * @returns A unique task ID
   * @throws {Error} If unable to generate unique ID after many attempts
   */
  generateUniqueId(): string {
    const MAX_ATTEMPTS = 100;
    const PREFIX_LENGTH = 7;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const id = uuidv4();
      const prefix = id.substring(0, PREFIX_LENGTH);

      // Check if any existing task has the same prefix
      let prefixExists = false;
      for (const existingId of this._nodes.keys()) {
        if (existingId.substring(0, PREFIX_LENGTH) === prefix) {
          prefixExists = true;
          break;
        }
      }

      if (!prefixExists) {
        return id;
      }
    }

    throw new Error(`Failed to generate unique ID after ${MAX_ATTEMPTS} attempts. Too many tasks?`);
  }

  /**
   * Get all task IDs in the graph
   * @returns Array of task IDs
   */
  getAllTaskIds(): string[] {
    return Array.from(this._nodes.keys());
  }

  /**
   * Get all task nodes in the graph
   * @returns Array of task nodes
   */
  getAllTasks(): TaskNode[] {
    return Array.from(this._nodes.values());
  }

  /**
   * Add a task node to the graph
   * @param node - Task node to add
   * @throws {ValidationError} If task ID already exists
   * @complexity O(1)
   */
  addNode(node: TaskNode): void {
    if (this._nodes.has(node.id)) {
      throw new ValidationError(
        `Task with ID '${node.id}' already exists in graph.`,
        'id'
      );
    }

    this._nodes.set(node.id, node);
    this._outgoingEdges.set(node.id, new Set(node.edges));

    // Only initialize incoming edges if not already set (from previous node additions)
    if (!this._incomingEdges.has(node.id)) {
      this._incomingEdges.set(node.id, new Set());
    }

    // Update incoming edges for all outgoing edges
    for (const targetId of node.edges) {
      if (!this._incomingEdges.has(targetId)) {
        this._incomingEdges.set(targetId, new Set());
      }
      this._incomingEdges.get(targetId)!.add(node.id);
    }

    this._metadata.updated_at = new Date().toISOString();
  }

  /**
   * Remove a task node from the graph
   * @param id - Task ID to remove
   * @throws {TaskNotFoundError} If task not found
   * @complexity O(k) where k is the number of edges
   */
  removeNode(id: string): void {
    if (!this._nodes.has(id)) {
      throw new TaskNotFoundError(id);
    }

    // Remove all edges pointing to this node
    const incomingSources = this._incomingEdges.get(id) || new Set();
    for (const sourceId of incomingSources) {
      this._outgoingEdges.get(sourceId)?.delete(id);
      // Also update the source node's edges field
      const sourceNode = this._nodes.get(sourceId);
      if (sourceNode) {
        sourceNode.edges = sourceNode.edges.filter(eid => eid !== id);
      }
    }

    // Remove all edges from this node
    const outgoingTargets = this._outgoingEdges.get(id) || new Set();
    for (const targetId of outgoingTargets) {
      this._incomingEdges.get(targetId)?.delete(id);
    }

    // Remove the node and edge maps
    this._nodes.delete(id);
    this._outgoingEdges.delete(id);
    this._incomingEdges.delete(id);

    this._metadata.updated_at = new Date().toISOString();
  }

  /**
   * Update a task node in the graph
   * @param node - Task node with updated values
   * @throws {TaskNotFoundError} If task not found
   * @complexity O(1)
   */
  updateNode(node: TaskNode): void {
    if (!this._nodes.has(node.id)) {
      throw new TaskNotFoundError(node.id);
    }

    this._nodes.set(node.id, node);
    this._metadata.updated_at = new Date().toISOString();
  }

  /**
   * Get outgoing edges for a node
   * @param nodeId - Source task ID
   * @returns Array of target task IDs
   * @complexity O(k) where k is the number of outgoing edges
   */
  getOutgoingEdges(nodeId: string): string[] {
    return Array.from(this._outgoingEdges.get(nodeId) || []);
  }

  /**
   * Get incoming edges for a node
   * @param nodeId - Target task ID
   * @returns Array of source task IDs
   * @complexity O(k) where k is the number of incoming edges
   */
  getIncomingEdges(nodeId: string): string[] {
    return Array.from(this._incomingEdges.get(nodeId) || []);
  }

  /**
   * Add an edge between two nodes
   * @param fromId - Source task ID
   * @param toId - Target task ID
   * @throws {TaskNotFoundError} If either task not found
   * @throws {ValidationError} If edge already exists
   * @complexity O(1)
   */
  addEdge(fromId: string, toId: string): void {
    if (!this._nodes.has(fromId)) {
      throw new TaskNotFoundError(fromId);
    }
    if (!this._nodes.has(toId)) {
      throw new TaskNotFoundError(toId);
    }

    // Initialize edge sets if needed
    if (!this._outgoingEdges.has(fromId)) {
      this._outgoingEdges.set(fromId, new Set());
    }
    if (!this._incomingEdges.has(toId)) {
      this._incomingEdges.set(toId, new Set());
    }

    // Check if edge already exists
    if (this._outgoingEdges.get(fromId)!.has(toId)) {
      throw new ValidationError(
        `Edge from '${fromId}' to '${toId}' already exists.`,
        'edges'
      );
    }

    // Add edge
    this._outgoingEdges.get(fromId)!.add(toId);
    this._incomingEdges.get(toId)!.add(fromId);

    // Update task node's edge list
    const fromNode = this._nodes.get(fromId)!;
    if (!fromNode.edges.includes(toId)) {
      fromNode.edges.push(toId);
    }

    this._metadata.updated_at = new Date().toISOString();
  }

  /**
   * Remove an edge between two nodes
   * @param fromId - Source task ID
   * @param toId - Target task ID
   * @throws {TaskNotFoundError} If either task not found
   * @throws {ValidationError} If edge doesn't exist
   * @complexity O(1)
   */
  removeEdge(fromId: string, toId: string): void {
    if (!this._nodes.has(fromId)) {
      throw new TaskNotFoundError(fromId);
    }
    if (!this._nodes.has(toId)) {
      throw new TaskNotFoundError(toId);
    }

    const outgoingSet = this._outgoingEdges.get(fromId);
    if (!outgoingSet || !outgoingSet.has(toId)) {
      throw new ValidationError(
        `Edge from '${fromId}' to '${toId}' does not exist.`,
        'edges'
      );
    }

    // Remove edge
    outgoingSet.delete(toId);
    this._incomingEdges.get(toId)?.delete(fromId);

    // Update task node's edge list
    const fromNode = this._nodes.get(fromId)!;
    const edgeIndex = fromNode.edges.indexOf(toId);
    if (edgeIndex > -1) {
      fromNode.edges.splice(edgeIndex, 1);
    }

    this._metadata.updated_at = new Date().toISOString();
  }

  /**
   * Check if an edge exists
   * @param fromId - Source task ID
   * @param toId - Target task ID
   * @returns True if edge exists
   * @complexity O(1)
   */
  hasEdge(fromId: string, toId: string): boolean {
    const outgoingSet = this._outgoingEdges.get(fromId);
    return outgoingSet ? outgoingSet.has(toId) : false;
  }

  /**
   * Get root tasks (tasks with no incoming edges)
   * @returns Array of root task IDs
   * @complexity O(n) where n is the number of tasks
   */
  getRootTasks(): string[] {
    const roots: string[] = [];
    for (const [id, incomingSet] of this._incomingEdges) {
      if (incomingSet.size === 0) {
        roots.push(id);
      }
    }
    return roots;
  }

  /**
   * Get orphan tasks (tasks with no edges at all)
   * @returns Array of orphan task IDs
   * @complexity O(n) where n is the number of tasks
   */
  getOrphanTasks(): string[] {
    const orphans: string[] = [];
    for (const [id] of this._nodes) {
      const outgoing = this._outgoingEdges.get(id)?.size ?? 0;
      const incoming = this._incomingEdges.get(id)?.size ?? 0;
      if (outgoing === 0 && incoming === 0) {
        orphans.push(id);
      }
    }
    return orphans;
  }

  /**
   * Get leaf tasks (tasks with no outgoing edges)
   * @returns Array of leaf task IDs
   * @complexity O(n) where n is the number of tasks
   */
  getLeafTasks(): string[] {
    const leaves: string[] = [];
    for (const [id, outgoingSet] of this._outgoingEdges) {
      if (outgoingSet.size === 0) {
        leaves.push(id);
      }
    }
    return leaves;
  }

  /**
   * Clear all tasks and edges from the graph
   * Keeps metadata but resets the graph structure
   */
  clear(): void {
    this._nodes.clear();
    this._outgoingEdges.clear();
    this._incomingEdges.clear();
    this._metadata.updated_at = new Date().toISOString();
  }

  /**
   * Propagate status changes through the graph starting from a node
   *
   * Uses breadth-first traversal to update tasks based on:
   * 1. Parent's status (CRITICAL: only completed parents allow children to proceed)
   * 2. Task's own item completeness (criteria/deliverables/need_fix)
   *
   * RULE: Only COMPLETED parents can unblock children. If parent is ANY other state
   * (ready, in_progress, in_review, blocked), the child is automatically BLOCKED.
   *
   * When parent is completed:
   *   - No items complete → child becomes 'ready'
   *   - Some items complete → child becomes 'in_progress'
   *   - All items complete → child becomes 'in_review'
   *
   * Propagation stops when a task's status doesn't change.
   *
   * @param startNodeId - The node to start propagation from
   * @returns Object containing updated task IDs and detailed changes
   */
  propagateStatus(startNodeId: string): {
    updatedTasks: string[];
    statusChanges: Array<{
      taskId: string;
      oldStatus: string;
      newStatus: string;
      reason: string;
    }>;
  } {
    // Validate start node exists
    const startNode = this.getNode(startNodeId);
    if (!startNode) {
      throw new TaskNotFoundError(`Task with ID '${startNodeId}' not found`);
    }

    const queue: string[] = [];
    const visited = new Set<string>();
    const updatedTasks: string[] = [];
    const statusChanges: Array<{
      taskId: string;
      oldStatus: string;
      newStatus: string;
      reason: string;
    }> = [];

    // STEP 1: Check/update the starting node's own status based on its parents
    // BUT skip if starting node is already completed (e.g., just approved)
    // This prevents overwriting the 'completed' status set by approve()
    if (startNode.status !== 'completed') {
      const startNodeParents = this.getIncomingEdges(startNodeId);
      let startNodeEffectiveParentStatus: string;

      if (startNodeParents.length === 0) {
        // Root node (no parents) - treat as having completed parent
        startNodeEffectiveParentStatus = 'completed';
      } else {
        // Check if ALL parents are completed
        const allParentsCompleted = startNodeParents.every(parentId => {
          const parentTask = this.getNode(parentId);
          return parentTask && parentTask.status === 'completed';
        });
        startNodeEffectiveParentStatus = allParentsCompleted ? 'completed' : 'blocked';
      }

      // Update start node's own status if needed
      const startNodeOldStatus = startNode.status;
      const startNodeNewStatus = this.calculateChildStatus(startNode, startNodeEffectiveParentStatus);

      if (startNodeNewStatus !== startNodeOldStatus) {
        startNode.status = startNodeNewStatus;
        updatedTasks.push(startNodeId);
        statusChanges.push({
          taskId: startNodeId,
          oldStatus: startNodeOldStatus,
          newStatus: startNodeNewStatus,
          reason: this.buildStatusChangeReason(startNode, startNodeEffectiveParentStatus)
        });
      }
    }

    // Enqueue start node to propagate to its children
    queue.push(startNodeId);

    // STEP 2: Propagate to children using BFS
    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // Skip if already visited (cycle detection)
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const currentTask = this.getNode(currentId);
      if (!currentTask) {
        continue;
      }

      // Get all direct children (outgoing edges)
      const children = this.getOutgoingEdges(currentId);

      for (const childId of children) {
        const childTask = this.getNode(childId);
        if (!childTask) {
          continue;
        }

        // Get ALL parents of this child (not just current)
        const childParents = this.getIncomingEdges(childId);

        // Check if ALL parents are completed
        // If ANY parent is not completed, child is blocked
        const allParentsCompleted = childParents.every(parentId => {
          const parentTask = this.getNode(parentId);
          return parentTask && parentTask.status === 'completed';
        });

        const effectiveParentStatus = allParentsCompleted ? 'completed' : 'blocked';

        const oldStatus = childTask.status;
        const newStatus = this.calculateChildStatus(childTask, effectiveParentStatus);

        if (newStatus !== oldStatus) {
          childTask.status = newStatus;
          updatedTasks.push(childId);
          statusChanges.push({
            taskId: childId,
            oldStatus,
            newStatus,
            reason: this.buildStatusChangeReason(childTask, effectiveParentStatus)
          });

          // Only enqueue if status changed
          queue.push(childId);
        }
      }
    }

    // Update metadata timestamp if any changes were made
    if (updatedTasks.length > 0) {
      this._metadata.updated_at = new Date().toISOString();
    }

    return { updatedTasks, statusChanges };
  }

  /**
   * Calculate the status for a child task based on its parent's status and own items
   *
   * RULE: Only COMPLETED parents allow children to calculate status from items.
   * If parent is ANY other state (ready, in_progress, in_review, blocked),
   * child is automatically BLOCKED.
   *
   * @param task - The child task to calculate status for
   * @param parentStatus - The status of the parent task
   * @returns The calculated status
   */
  private calculateChildStatus(task: TaskNode, parentStatus: string): TaskStatus {
    // Priority 1: Parent must be completed for child to proceed
    // If parent is NOT completed, child is blocked regardless of its own items
    if (parentStatus !== 'completed') {
      return 'blocked';
    }

    // Priority 2: Parent is completed
    // Calculate status based on task's own items
    return this.calculateStatusFromItems(task);
  }

  /**
   * Calculate status based on task's own items (criteria/deliverables/need_fix)
   *
   * @param task - The task to calculate status for
   * @returns The calculated status
   */
  private calculateStatusFromItems(task: TaskNode): TaskStatus {
    const allCriteriaComplete = task.success_criteria.every(c => c.completed);
    const allDeliverablesComplete = task.deliverables.every(d => d.completed);
    const allNeedFixComplete = task.need_fix.every(f => f.completed);

    const anyCriteriaComplete = task.success_criteria.some(c => c.completed);
    const anyDeliverablesComplete = task.deliverables.some(d => d.completed);
    const hasNeedFix = task.need_fix.length > 0;

    // Rule 1: All items complete → in_review
    if (allCriteriaComplete && allDeliverablesComplete && allNeedFixComplete) {
      return 'in_review';
    }

    // Rule 2: Some items complete OR has need_fix → in_progress
    if (anyCriteriaComplete || anyDeliverablesComplete || hasNeedFix) {
      return 'in_progress';
    }

    // Rule 3: Nothing started → ready
    return 'ready';
  }

  /**
   * Build a human-readable reason for a status change
   *
   * @param task - The task that changed status
   * @param parentStatus - The status of the parent task
   * @param oldStatus - The previous status
   * @param newStatus - The new status
   * @returns A descriptive reason string
   */
  private buildStatusChangeReason(
    task: TaskNode,
    parentStatus: string
  ): string {
    // Priority: Check if blocked because parent is not completed
    if (parentStatus !== 'completed') {
      return `Parent not completed (status: ${parentStatus})`;
    }

    // Parent is completed - show item completion status
    const completedCriteria = task.success_criteria.filter(c => c.completed).length;
    const totalCriteria = task.success_criteria.length;
    const completedDeliverables = task.deliverables.filter(d => d.completed).length;
    const totalDeliverables = task.deliverables.length;
    const completedNeedFix = task.need_fix.filter(f => f.completed).length;
    const totalNeedFix = task.need_fix.length;

    const items: string[] = [];
    if (totalCriteria > 0) {
      items.push(`${completedCriteria}/${totalCriteria} criteria`);
    }
    if (totalDeliverables > 0) {
      items.push(`${completedDeliverables}/${totalDeliverables} deliverables`);
    }
    if (totalNeedFix > 0) {
      items.push(`${completedNeedFix}/${totalNeedFix} need_fix`);
    }

    if (items.length > 0) {
      return `Parent completed. Items: ${items.join(', ')}`;
    }

    return 'Parent completed. No items started';
  }

  /**
   * Convert graph to TaskGraph interface
   * @returns TaskGraph interface representation
   */
  toInterface(): TaskGraph {
    return {
      nodes: new Map(this._nodes),
      outgoingEdges: new Map(
        Array.from(this._outgoingEdges.entries()).map(([id, set]) => [id, new Set(set)])
      ),
      incomingEdges: new Map(
        Array.from(this._incomingEdges.entries()).map(([id, set]) => [id, new Set(set)])
      ),
      metadata: this._metadata,
    };
  }

  /**
   * Create TaskGraphStore from TaskGraph interface
   * @param graph - TaskGraph interface
   * @returns New TaskGraphStore instance
   */
  static fromInterface(graph: TaskGraph): TaskGraphStore {
    const store = new TaskGraphStore(graph.metadata);

    // Add all nodes (convert interface to class instance)
    for (const [id, node] of graph.nodes) {
      const taskNode = TaskNode.fromJSON(node);
      store._nodes.set(id, taskNode);
    }

    // Copy edge maps
    for (const [id, set] of graph.outgoingEdges) {
      store._outgoingEdges.set(id, new Set(set));
    }
    for (const [id, set] of graph.incomingEdges) {
      store._incomingEdges.set(id, new Set(set));
    }

    return store;
  }

  /**
   * Serialize graph to JSON-compatible object
   * @returns JSON-serializable object
   */
  toJSON(): {
    nodes: Record<string, TaskNode>;
    outgoingEdges: Record<string, string[]>;
    incomingEdges: Record<string, string[]>;
    metadata: ProjectMetadata;
  } {
    const nodes: Record<string, TaskNode> = {};
    for (const [id, node] of this._nodes) {
      nodes[id] = node;
    }

    const outgoingEdges: Record<string, string[]> = {};
    for (const [id, set] of this._outgoingEdges) {
      outgoingEdges[id] = Array.from(set);
    }

    const incomingEdges: Record<string, string[]> = {};
    for (const [id, set] of this._incomingEdges) {
      incomingEdges[id] = Array.from(set);
    }

    return {
      nodes,
      outgoingEdges,
      incomingEdges,
      metadata: this._metadata,
    };
  }

  /**
   * Deserialize graph from JSON object
   * @param json - JSON object from toJSON()
   * @returns New TaskGraphStore instance
   */
  static fromJSON(json: {
    nodes: Record<string, TaskNode>;
    outgoingEdges: Record<string, string[]>;
    incomingEdges: Record<string, string[]>;
    metadata: ProjectMetadata;
  }): TaskGraphStore {
    const store = new TaskGraphStore(json.metadata);

    // Add nodes
    for (const [id, node] of Object.entries(json.nodes)) {
      store._nodes.set(id, node);
    }

    // Add edges
    for (const [id, targets] of Object.entries(json.outgoingEdges)) {
      store._outgoingEdges.set(id, new Set(targets));
    }
    for (const [id, sources] of Object.entries(json.incomingEdges)) {
      store._incomingEdges.set(id, new Set(sources));
    }

    return store;
  }
}
