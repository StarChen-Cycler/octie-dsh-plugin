# Right Way To Review And Approve

Use this flag when completing task items, resolving `need_fix`, and approving finished work.

## Preconditions

Before approving a task, make sure:
- the task has already been selected from current Octie state
- implementation work is actually complete
- task details are read fresh from Octie

## Status rules

Do not try to set status manually.

Use these meanings:
- `ready`: no blockers and no work started
- `in_progress`: some work has started
- `in_review`: all criteria, deliverables, and need_fix items are complete
- `completed`: approved through `octie approve`
- `blocked`: unresolved blockers exist

`octie approve` is the only manual status transition.

## Completion rules

Always read the task first:

```bash
octie get <id> --format md
```

Mark completed items with:

```bash
octie update <id> --complete-criterion <criterion-id>
octie update <id> --complete-deliverable <deliverable-id>
octie update <id> --complete-need-fix <need-fix-id>

# Optional: record evidence when completing a criterion
octie update <id> --complete-criterion <criterion-id> --evidence "0.86 ms median, n=810"
```

Add blocking issues found during work with:

```bash
octie update <id> \
  --add-need-fix "<issue>" \
  --need-fix-source <review|runtime|regression>
```

Use `need_fix` for:
- review findings
- runtime failures
- regressions discovered during validation

## Approval rule

Approve only when:
- all success criteria are complete
- all deliverables are complete
- all need_fix items are resolved
- the task is in `in_review`

```bash
octie approve <id>
```

Do not:
- use `octie update --status`
- approve partially complete work
- use blocker edits to simulate completion
