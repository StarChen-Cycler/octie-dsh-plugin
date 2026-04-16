# Right Way To Form Tasks

Use this flag when creating Octie tasks with `octie create`.

## Preconditions

Before creating tasks, make sure:
- spec information is sufficiently provided
- relevant codebase context has been read
- relevant C7 MCP verification has been completed
- required online research has been completed for uncertain or unstable external behavior
- existing Octie tasks have been checked to avoid duplicates

If any of these are missing, stop and gather them first.

## Atomic task rules

A good Octie task set should:
- fully cover the requested outcome
- break the work into atomic tasks
- avoid overlapping or vague tasks
- preserve implementation realism
- make later dependency management straightforward

Each task must be:
- single-purpose
- specific
- executable in roughly 2-8 hours
- verifiable through measurable criteria
- concrete in deliverables

Split the task if:
- the title naturally contains `and`
- it produces multiple unrelated outputs
- the description spans multiple implementation objectives

Do not create vague tasks like:
- `Fix auth`
- `Improve performance`
- `Handle edge cases`

## One-at-a-time creation (no batch, no compact)

⚠️ CRITICAL: Always create Octie tasks **one at a time**.

- Run `octie create` once per task, then verify with `octie get <id> --format md`
- After each creation, audit the task for atomicity before creating the next one
- **Never** create multiple tasks in a single command or loop
- **Never** use compact/abbreviated flag syntax to rush through creation
- Each task deserves full attention to title, description, criteria, and deliverables

**Why**: The atomic task feature requires each task to be audited individually. Batch creation or compact shortcuts bypass the review step and produce low-quality tasks that need rework later.

## `octie create` rules

Use:
- 1 action-oriented title
- 1 specific description
- 1-10 success criteria
- 1-10 deliverables

Success criteria should be:
- quantitative
- independently verifiable
- pass/fail checkable

Deliverables should be:
- concrete outputs such as files, endpoints, tests, schemas, docs, scripts, or migrations

Use notes only for:
- assumptions
- constraints
- supporting context that does not belong in criteria or deliverables

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
  --priority <top|second|later>
```

Optional additional items:
- `--related-files "<path>"`
- `--c7-verified "<library:pattern>"`
- `--notes "<supporting context>"`
- `--blockers <id1>,<id2> --dependency-explanation "<why this task depends on them>"`

Use `octie get <id> --format md` after creation to verify the task is still atomic.

If blockers or sequencing are needed, use `--right-way-to-manage-dependencies`.
