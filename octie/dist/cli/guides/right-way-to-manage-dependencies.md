# Right Way To Manage Dependencies

Use this flag when adding blockers and dependency rationale to Octie tasks.

## Preconditions

Before adding dependencies, make sure:
- the tasks are already well-formed and atomic
- the task set is already scoped clearly
- existing Octie tasks and graph state have been checked

If the tasks are not yet well-formed, use `--right-way-to-form-tasks` first.

## Dependency rules

Think in two patterns:
- horizontal: tasks at the same level that can proceed in parallel
- vertical: tasks where one task needs a concrete deliverable from another

Only add a blocker for a vertical dependency.

Add a blocker only when all of the following are true:
- the blocked task needs a concrete deliverable from the blocker
- the dependency is unavoidable
- the reason can be stated specifically

Do not add blockers for:
- coordination only
- preferred ordering only
- same-person assignment
- vague future uncertainty
- work that can proceed with a stub, mock, interface, or placeholder

Use `--priority` for urgency, not to simulate dependency.

A good dependency explanation should name the real need.

Good:
- `Needs auth middleware from blocker for protected route wiring`
- `Needs database schema from blocker before query implementation`

Bad:
- `Depends on Task A`
- `Must be done first`

## Flag name

Use `--dependency-explanation` as the documented flag name for dependency rationale.

## `octie create` dependency rule

When creating a task with blockers, `--blockers` and `--dependency-explanation` must be provided together.

```bash
octie create \
  --title "Implement <specific objective>" \
  --description "Implement <specific scoped objective> within the prepared requirements, verified patterns, and known constraints." \
  --success-criterion "<measurable criterion 1>" \
  --success-criterion "<measurable criterion 2>" \
  --success-criterion "<measurable criterion 3>" \
  --success-criterion "<measurable criterion 4>" \
  --success-criterion "<measurable criterion 5>" \
  --deliverable "<concrete output 1>" \
  --deliverable "<concrete output 2>" \
  --deliverable "<concrete output 3>" \
  --deliverable "<concrete output 4>" \
  --deliverable "<concrete output 5>" \
  --blockers <id1>,<id2> \
  --dependency-explanation "<specific reason this task needs those deliverables>" \
  --priority <top|second|later>
```

## `octie update` dependency rule

When adding a blocker to an existing task, `--blockers` and `--dependency-explanation` must be provided together. Add blockers one per call so each blocker gets its own explanation; repeat the command for additional blockers.

```bash
octie update <id> \
  --blockers <id1> \
  --dependency-explanation "<specific reason this task needs that deliverable>"
```

## Quality checks

Before adding a blocker, check:
- what exact deliverable is needed
- why this task cannot proceed without it
- whether this is a real dependency or only a sequencing preference
- whether the tasks should actually remain parallel

If the dependency is structural but wrong and must be removed later, call:
- `--right-way-to-refine-tasks`
