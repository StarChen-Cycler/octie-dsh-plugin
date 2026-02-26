# Status Propagation New Method

## Overview

This document describes the new status calculation and propagation logic for the Octie task management system.

---

## Core Principles

### 1. Structural Data vs Derived Data

| Type | Data | Management |
|------|------|------------|
| **Structural** | `blockers[]`, `edges[]` | Only modified by explicit commands (`--blockers`, `--unblock`) |
| **Derived** | `status` | Calculated from item completeness + ancestor status |

### 2. One-Way Influence

```
Item Completeness  →  Status  →  Children Status
        ↓                ↓              ↓
   (checked/unchecked)  (calculated)  (propagated)

NO reverse influence:
- Status does NOT modify items
- Status does NOT modify blockers/edges
- Children status does NOT affect parent status
```

### 3. Propagation Direction

```
┌─────────────────────────────────────────────────────────────┐
│                    STATUS CALCULATION                        │
├─────────────────────────────────────────────────────────────┤
│  status = f(items, ancestor_status)                         │
│                                                             │
│  1. Any ancestor NOT completed? → blocked                  │
│  2. All items complete? → in_review                        │
│  3. Any work started? → in_progress                        │
│  4. Default → ready                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (only when status changes)
┌─────────────────────────────────────────────────────────────┐
│                    STATUS PROPAGATION                        │
├─────────────────────────────────────────────────────────────┤
│  Trigger: Status changes to `completed` OR `in_progress`    │
│  Direction: DOWNWARD only (parent → children)               │
│  Stop condition: Child status unchanged                     │
│                                                             │
│  Parent.change → [Child1, Child2, ...].recalculateStatus() │
│                        │                                    │
│                        ▼                                    │
│                  If Child.status changed:                   │
│                        │                                    │
│                        ▼                                    │
│                  [Grandchild...].recalculateStatus()        │
│                        │                                    │
│                        ▼                                    │
│                     (recursive)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Status Calculation Logic

### `calculateStatus()` - Pure Function

```typescript
calculateStatus(): TaskStatus {
  // RULE 1: Check if any ancestor is NOT completed (upward check)
  if (this.hasIncompleteAncestor()) {
    return 'blocked';
  }

  // RULE 2: Check if all items complete → ready for review
  const allCriteriaComplete = this.success_criteria.every(c => c.completed);
  const allDeliverablesComplete = this.deliverables.every(d => d.completed);
  const allNeedFixComplete = this.need_fix.every(f => f.completed);
  const allComplete = allCriteriaComplete && allDeliverablesComplete && allNeedFixComplete;

  if (allComplete) {
    return 'in_review';
  }

  // RULE 3: Check if work has started
  const anyCriteriaChecked = this.success_criteria.some(c => c.completed);
  const anyDeliverableChecked = this.deliverables.some(d => d.completed);
  const hasUnresolvedNeedFix = this.need_fix.some(f => !f.completed);

  if (anyCriteriaChecked || anyDeliverableChecked || hasUnresolvedNeedFix) {
    return 'in_progress';
  }

  // RULE 4: Default - ready for work
  return 'ready';
}
```

### `hasIncompleteAncestor()` - Upward Check (only in calculateStatus)

```typescript
/**
 * Check if any ancestor in the blocker chain is NOT completed
 * Called ONLY during status calculation (calculateStatus)
 * NOT during propagation
 */
hasIncompleteAncestor(): boolean {
  for (const blockerId of this.blockers) {
    const blocker = this._graph?.getNode(blockerId);
    if (!blocker) continue; // Skip deleted blockers

    // Direct blocker is not completed → we are blocked
    if (blocker.status !== 'completed') {
      return true;
    }
    // Recursively check if blocker has incomplete ancestors
    if (blocker.hasIncompleteAncestor()) {
      return true;
    }
  }
  return false;
}
```

---

## Propagation Algorithm

### Iterative Recursive Downward Propagation

```typescript
/**
 * Propagate status change to all children (iterative recursive)
 * One parent may have MULTIPLE children
 * Only triggered when status changes to `completed` OR `in_progress`
 * Only continues if child's status actually changes
 */
function propagateToChildren(
  taskId: string,
  graph: TaskGraphStore
): string[] {
  const updatedTaskIds: string[] = [];

  // Find ALL direct children (tasks that have this task in their blockers)
  const children = graph.getAllTasks().filter(t => t.blockers.includes(taskId));

  for (const child of children) {
    const oldStatus = child.status;

    // Recalculate child's status (this does upward check via hasIncompleteAncestor)
    child.recalculateStatus();

    // Only continue propagating if status actually changed
    if (child.status !== oldStatus) {
      updatedTaskIds.push(child.id);

      // Recursively propagate to THIS child's children
      const descendantUpdates = propagateToChildren(child.id, graph);
      updatedTaskIds.push(...descendantUpdates);
    }
    // Status unchanged → STOP this branch
  }

  return updatedTaskIds;
}
```

---

## Trigger Points (Simplified)

### When to Propagate

Propagation is ONLY triggered when status changes to `completed` or `in_progress`:

| Event | Status Change? | Propagate? |
|-------|----------------|------------|
| `approve()` | → `completed` | **YES** (always) |
| Task regresses | → `in_progress` | **YES** (always) |
| Item checked | Maybe | Only if status changes |
| Item unchecked | Maybe | Only if status changes |
| `need_fix` added | Maybe | Only if status changes |
| `need_fix` completed | Maybe | Only if status changes |

### Unified Pattern in Methods

```typescript
someItemModification(): void {
  // 1. Modify the item
  // ...

  // 2. Recalculate self's status
  const oldStatus = this.status;
  this.recalculateStatus();

  // 3. Only propagate if status changed to completed or in_progress
  if (this.status !== oldStatus &&
      (this.status === 'completed' || this.status === 'in_progress')) {
    propagateToChildren(this.id, this._graph);
  }
}
```

---

## Key Design Decisions

### 1. Blockers/Edges Are Preserved

- **Never auto-deleted** when task completes
- Only modified by explicit commands (`--blockers`, `--unblock`)
- Allows blocking chain to be maintained for status calculation

### 2. No Historical Edges Needed

Since blockers/edges are preserved, the existing `edges` field already serves as the historical record.

### 3. Completed Tasks Can Regress

```typescript
// In recalculateStatus()
if (this.status === 'completed') {
  // Regression: need_fix added OR ancestor incomplete → leave completed
  if (newStatus === 'in_progress' || newStatus === 'blocked') {
    this.status = newStatus;
    this._touch();
  }
  // Otherwise stay completed
  return this.status;
}
```

### 4. Child Status Never Affects Parent

Parent's status calculation:
- ✅ Parent's own items
- ✅ Parent's ancestors' status (recursive upward)
- ❌ Parent's children's status (NO downward influence upward)

---

## Status Transitions Summary

| From | To | Trigger |
|------|-----|---------|
| `ready` | `in_progress` | Item checked OR need_fix added |
| `ready` | `blocked` | Ancestor becomes incomplete |
| `in_progress` | `in_review` | All items complete |
| `in_progress` | `completed` | Manual `approve()` ONLY |
| `in_progress` | `blocked` | Ancestor becomes incomplete |
| `in_review` | `completed` | Manual `approve()` ONLY |
| `in_review` | `in_progress` | need_fix added |
| `in_review` | `blocked` | Ancestor becomes incomplete |
| `completed` | `in_progress` | need_fix added (regression) |
| `completed` | `blocked` | Ancestor becomes incomplete (regression) |
| `blocked` | `ready` | All ancestors complete + no work started |
| `blocked` | `in_progress` | All ancestors complete + work started |
| `blocked` | `in_review` | All ancestors complete + all items complete |

---

## Implementation Checklist

- [ ] Add `hasIncompleteAncestor()` method to `TaskNode`
- [ ] Modify `calculateStatus()` to use `hasIncompleteAncestor()`
- [ ] Create `propagateToChildren()` in `status-helpers.ts`
- [ ] Add propagation calls to `approve()` and regression scenarios
- [ ] Remove auto-deletion of blockers/edges on completion
- [ ] Add unit tests for transitive blocking
- [ ] Add unit tests for propagation scenarios
- [ ] Update web UI to use preserved edges for graph visualization
