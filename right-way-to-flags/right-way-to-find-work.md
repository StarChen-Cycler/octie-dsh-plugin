# Right Way To Find Work

Use this flag when inspecting the Octie graph and selecting the next task to execute.

## Preconditions

Before finding work, make sure:
- Octie is initialized
- the task graph already exists
- current Octie state is queried fresh, not assumed from memory

## Query rules

Always inspect current state directly from Octie.

Start with:

```bash
octie list --format md
```

Then inspect execution state:

```bash
octie list --status in_progress --format md
octie list --status ready --format md
octie list --status in_review --format md
octie list --status blocked --format md
```

Use topology views when needed:

```bash
octie list --graph
octie find --without-blockers --format md
octie find --orphans --format md
octie find --leaves --format md
```

Use focused search when needed:

```bash
octie find --title "<pattern>" --format md
octie find --search "<text>" --format md
octie find --has-file "<path>" --format md
octie find --verified "<library>" --format md
```

## Selection rules

Choose work in this order:
- continue `in_progress` tasks first
- otherwise choose from `ready` tasks
- among `ready` tasks, use priority order: `top` > `second` > `later`
- if multiple tasks have the same priority, choose deterministically from returned order

Use these meanings:
- `in_progress`: work already started
- `ready`: work available to start
- `in_review`: all items complete, waiting for approval
- `blocked`: unresolved blockers exist
- `--without-blockers`: graph inspection only, not final execution choice
- `--orphans`: disconnected tasks
- `--leaves`: end tasks with no outgoing edges

Do not:
- select work from `--without-blockers` alone
- ignore an existing `in_progress` task and start unrelated new work
- treat `--orphans` or `--leaves` as priority signals
