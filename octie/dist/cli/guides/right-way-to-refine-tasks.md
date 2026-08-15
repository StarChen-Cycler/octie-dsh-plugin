# Right Way To Refine Tasks

Use this flag when the graph structure is wrong and tasks or dependencies need structural correction.

## Preconditions

Before refining tasks, make sure:
- the existing graph has been inspected
- the task set is already present in Octie
- the issue is structural, not normal execution progress

Do not use this flag to move work forward in normal execution.

## Refinement order

Refine in this order:
- remove unnecessary blockers first
- merge trivial tasks or split oversized tasks
- rearrange dependencies if needed
- validate after the refinement batch

Do not skip or reorder these steps.

## Structural rules

Use these rules:
- horizontal tasks stay parallel when there is no concrete deliverable dependency
- vertical tasks are sequential only when one task truly needs another task's output
- tasks at the same level should have comparable scope
- use priority for urgency, not dependency
- remove blockers added only for coordination or preferred ordering

## Blocker removal

Use `--unblock` only for structural correction.

```bash
octie update <id> --unblock <blocker-id>
```

Use it when:
- the blocker was added for coordination only
- the tasks can proceed in parallel
- a stub, mock, interface, or placeholder makes the dependency avoidable
- the blocker is creating a bad cycle or invalid chain

Do not use it to bypass unfinished prerequisite work.

## Merge and split

Merge small tasks with:

```bash
octie merge <source-id> <target-id> --force
```

Merge only when:
- the tasks are below atomic threshold
- the outputs are tightly related
- the merged result stays atomic

Warnings:
- merge cannot be undone
- the source task is deleted
- the target task inherits blockers and dependencies

Split oversized tasks by creating a more atomic task and wiring it into the graph:

```bash
octie wire <task-id> \
  --after <src-id> \
  --before <tgt-id> \
  --dep-on-after "<reason>" \
  --dep-on-before "<reason>"
```

Use `wire` only on an existing connected chain.

## Reordering and validation

Reorder dependencies with:

```bash
octie wire <task-id> \
  --after <src-id> \
  --before <tgt-id> \
  --dep-on-after "<reason>" \
  --dep-on-before "<reason>"
```

Validate after the refinement batch:

```bash
octie graph validate
octie graph cycles
octie find --orphans
octie list --graph
octie find --without-blockers
```

Check that:
- no cycles were introduced
- no tasks became orphaned
- blocker logic is still valid
- the resulting unblocked work actually looks correct
