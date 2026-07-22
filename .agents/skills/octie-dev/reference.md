# Octie Dev - Reference Documentation

Additional details for octie-dev workflow.

---

## ⚠️ CRITICAL: Always Use --help First

**Before using ANY Octie command, run --help to get the correct options and syntax.**

```bash
# Always check help first
octie -h
octie list -h
octie get -h
octie update -h
octie find -h
octie create -h
octie approve -h
octie graph -h
```

**Why**: Octie CLI options may change. Always verify current syntax via `--help`.

---

## Implementation Checklist

- [ ] Run `octie -h` to verify Octie is available
- [ ] Run `octie list -h` to understand list options
- [ ] Query all tasks: `octie list --format md` (REQUIRED first)
- [ ] Query by status: `octie list --status ready --format md`
- [ ] Query in_progress: `octie list --status in_progress --format md`
- [ ] Get task details: `octie get <id> --format md`
- [ ] Run `octie get -h` to see get options
- [ ] Read relevant files using symbols from `.memo/memosymbols.txt`
- [ ] Check C7 MCP for implementation patterns
- [ ] Present pre-modify workflow
- [ ] Implement the feature/fix
- [ ] Write tests
- [ ] Run tests to verify
- [ ] Update Octie task progress:
  - Run `octie update -h` first
  - Mark criteria: `octie update <id> --complete-criterion <criterion-id>` (optional: `--evidence "<proof>"`)
  - Mark deliverables: `octie update <id> --complete-deliverable <deliverable-id>`
  - Add notes: `octie update <id> --notes "..."`
- [ ] Commit changes
- [ ] Refresh symbols: `memo-dec extractsymbols`

---

## Pre-Modify Workflow Template

Present this BEFORE making any changes. Show the current system state and where your fix integrates.

### Template

```markdown
## Pre-Modify Workflow: [Task Title from Octie]

### Current System Flow

[User] → [API Handler] → [Service Layer] → [Database]
   ↓            ↓              ↓              ↓
[Error]    [500 response]  [null]       [N/A]

### Files to Modify

| File | Function/Component | What Changes |
|------|-------------------|--------------|
| src/api/users.ts | getUserById() | Add null check |
| src/services/user.ts | validateUser() | Add validation |

### Current Behavior (Code Snippet)

```typescript
// src/api/users.ts:45-62
async function getUserById(id: string) {
  // Bug: No validation, throws unhandled error
  return await db.users.findUnique({ where: { id } });
}
```

### Proposed Changes

1. Add input validation in `getUserById()` - throw ValidationError if id is empty
2. Add null check before database query
3. Return 404 if user not found

### Impact Scope

- **Direct impact**: GET /api/users/:id endpoint
- **Side effects**: None (isolated change)
- **Tests needed**: Unit test for empty id, unit test for not found case

### Verification Criteria (from Octie task)

- [ ] Empty id returns 400 ValidationError
- [ ] Valid id returns user object
- [ ] Invalid id returns 404 NotFoundError
```

### When to Use

- **Every implementation** - Before writing code, show the current state
- **Bug fixes** - Show the bug in context
- **Feature additions** - Show where new code integrates
- **Refactoring** - Show what changes and why

### Key Elements

1. **System Flow** - How data moves through components
2. **Files to Modify** - Specific files with line numbers
3. **Current Behavior** - Actual code snippet (not description)
4. **Proposed Changes** - Concrete steps
5. **Impact** - What's affected
6. **Verification** - How to confirm it works

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `octie: command not found` | Octie not installed | Install Octie CLI |
| `octie: not initialized` | No Octie project | Run octie-init first |
| Invalid task ID | Task doesn't exist | Check `octie list` |
| Criterion not found | Wrong ID | Get task details to see IDs |
| Cycle detected | Circular dependencies | Use `octie graph cycles` |

---

## Integration Patterns

### Workflow

```
/octie-fix (Phase 3) → Creates task with criteria
    ↓
/octie-dev (Phase 2) → Reads tasks, implements, updates
    ↓
Commit → Refresh symbols
```

### Context

- **Octie**: Task status, criteria, deliverables, blockers
- **memo-dec**: Code symbols, folder tree, specs

---

## Token Efficiency

1. **Use `--format md`** for all Octie commands
2. **Read symbols first** before source files
3. **Query specific filters** after getting full list
4. **Use internal discovery** to minimize file reads

---

*Last updated: 2026-02-25*
