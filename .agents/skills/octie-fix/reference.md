# Octie Fix - Reference Documentation

Additional details for octie-fix workflow.

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

## octie-fix Checklist

- [ ] Run `octie -h` to verify Octie is available
- [ ] Run `ls -R .memo` to check reference files structure
- [ ] Run `ls -R .claude` to check coding rules
- [ ] Read `.memo/memosymbols.txt` for code context
- [ ] Read `.memo/memotree/memofoldertree.txt` for structure
- [ ] Query Octie tasks: `octie list --format md` (REQUIRED first)
- [ ] Read user spec: `.memo/memodocs/user_spec_<project>.md`
- [ ] Check git history: `git log --oneline -5`
- [ ] Capture feature/bug request from user
- [ ] Run internal discovery questions
- [ ] Read relevant files based on discovery
- [ ] Search C7 MCP for implementation patterns
- [ ] Run critical fix analysis
- [ ] Present pre-modify workflow (concrete, with code snippets)
- [ ] Run `octie create -h` to see create options
- [ ] Create Octie task with success criteria and deliverables
- [ ] Get task details: `octie get <id> --format md`
- [ ] Present task to user for confirmation
- [ ] If confirmed, guide user to use `/octie-dev`

---

## Pre-Modify Workflow Template

Present this BEFORE creating the Octie task. Show current system and where fix integrates.

### Template

```markdown
## Pre-Modify Workflow: [Feature/Bug Name]

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
```

### When to Use

- **Every feature/bug** - Before creating task, show current state
- **Bug fixes** - Show the bug in context with code
- **Feature additions** - Show where new code integrates

---

## Success Criteria Templates

### Feature Implementation

| Criterion | Template |
|-----------|----------|
| Functionality | "[Feature] works as specified in requirements" |
| Performance | "Response time < [X]ms" |
| Coverage | "Unit test coverage > [X]%" |
| Integration | "Integration with [service] works correctly" |

### Bug Fix

| Criterion | Template |
|-----------|----------|
| Fix verification | "[Error] no longer occurs" |
| Root cause | "[Root cause] addressed" |
| Regression | "Test case for [edge case] passes" |

---

## User Confirmation Template

```
Created new Octie task:

**Title**: [title]
**Description**: [description]

**Success Criteria**:
- [ ] criterion 1
- [ ] criterion 2
- [ ] criterion 3

**Deliverables**:
- deliverable 1
- deliverable 2

**Related Files**: file1, file2
**C7 Verified**: library:pattern
**Priority**: top/second/later

Ready to proceed with implementation? (y/n)
```

---

## Integration Patterns

### Workflow

```
User Request
    ↓
/octie-fix (Phase 3)
    ↓ Analyze feature/bug
    ↓ C7 MCP verification
    ↓ Present pre-modify workflow
    ↓ Create Octie task
    ↓ User confirms
    ↓
/octie-dev (Phase 2)
    ↓ Implement
    ↓ Update task progress
    ↓ Commit
```

### Context

- **Octie**: Task creation with criteria/deliverables
- **memo-dec**: Code context (symbols, specs)
- **C7 MCP**: Implementation patterns verification

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `octie: command not found` | Octie not installed | Install Octie CLI |
| `octie: not initialized` | No Octie project | Run octie-init first |
| Invalid task ID | Task doesn't exist | Check `octie list` |
| Duplicate title | Task already exists | Use different title |
| Cycle detected | Circular dependencies | Check blockers |

---

*Last updated: 2026-02-25*
