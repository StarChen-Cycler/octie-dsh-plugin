---
name: octie-fix
description: Phase 3: Feature/Bug Preparation with Octie task management. Loads context from memo-dec, analyzes new feature or bug request, searches C7 MCP for best practices, finds most critical structured fix, presents pre-modify workflow, generates Octie task with success criteria and deliverables. Uses Octie for task management instead of proj-progress-checklist.md. Use when: "add feature", "fix bug", "new feature", "bug fix", "implement feature", "prepare implementation". 3-phase workflow with C7 MCP verification.
allowed-tools: Write, Bash, Read, TaskCreate, TaskList, TaskUpdate, TaskGet, TaskDelete, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Octie Fix - Feature/Bug Preparation with Octie

**Phase 3**: Feature/Bug Preparation - prepares new feature or bug fix with Octie task management.

**⚠️ CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

**When to use**: Adding new features, fixing bugs, preparing implementation tasks.
**When NOT to use**: Use `/octie-dev` for ongoing development loops.

---

## Workflow Overview

```
Phase A: Context Loading → Phase B: Discovery & Analysis → Phase C: Create Octie Task → Phase D: User Confirmation
```

**Phase A includes**: Symbols → Folder → Reference files → Descriptive spec → Git history

**Phase B includes**: C7 MCP search → Critical fix analysis → Pre-modify workflow presentation

---

## Step-by-Step Instructions

### Phase A: Context Loading

#### Step A1: Verify Octie Availability

**CRITICAL**: Run `octie -h` first to verify Octie is installed.

```bash
octie -h
```

**If Octie unavailable**: Abort - Octie required.

---

#### Step A2: Check Reference Files Structure

**Action**: Run `ls -R` on `.memo` and `.Codex` folders.

```bash
ls -R .memo
ls -R .Codex
```

**Purpose**: Identify available reference files (coding rules, UI rules, tech specs).

---

#### Step A3: Read Symbol Files

**File**: `.memo/memosymbols.txt`

Read first for token-efficient context:
```
Format: line:tag:name (e.g., 4:fun:App)
Tags: fun=function, var=variable, com=command
```

---

#### Step A4: Read Folder Structure

**File**: `.memo/memotree/memofoldertree.txt`

Shows project organization.

---

#### Step A5: Query Octie for Existing Tasks

**CRITICAL**: Run `octie list -h` and `octie find -h` first.

```bash
octie list -h
octie find -h
```

**MANDATORY**: Always use `--format md` for token-efficient output.

**Query all tasks** (REQUIRED first):
```bash
octie list --format md
```

This shows existing tasks to understand project state and avoid duplicates.

**Query ready tasks**:
```bash
octie list --status ready --format md
```

---

#### Step A6: Read Descriptive Spec

**File**: `.memo/memodocs/user_spec_<project>.md`

**Purpose**: Understand project requirements and feature context.

---

#### Step A7: Read Git History

**Command**: `git diff HEAD~2 HEAD` or `git log --oneline -5`

**Purpose**: Understand recent modifications.

---

### Phase B: Discovery & Analysis

#### Step B1: Capture Feature/Bug Request

**Input**: User provides new feature or bug description.

**Capture details**:
- Feature: What functionality to add, user value, acceptance criteria
- Bug: What's broken, expected behavior, actual behavior, reproduction steps

---

#### Step B2: Internal Discovery Questions

Ask 1-2 **internal** questions about:
- How feature/bug relates to existing codebase
- What components/modules are affected
- Dependencies or blockers
- Similar features to reference

---

#### Step B3: Read Relevant Files

Read files based on discovery:
1. Direct dependencies (files being modified)
2. Upstream dependencies (types, models, utilities)
3. Context files (config, similar features)

**Reading strategy**:
- Use symbols from memosymbols.txt
- Read existing similar features
- Check `.Codex/rules/` for implementation standards

---

#### Step B4: Search C7 MCP for Best Practices

**CRITICAL**: Run `mcp__context7__resolve-library-id` and `mcp__context7__query-docs` as needed.

**Purpose**: Query C7 MCP for each major technology. Verify implementation patterns, edge cases, best practices.

**Process**:
1. Extract technologies from discovered files
2. Query C7 MCP for each technology
3. Document critical findings
4. Adjust fix strategy based on guidance

**Example queries**:
```
"/vercel/next.js": "Best practices for API route error handling"
"/mongodb/docs": "MongoDB aggregation pipeline patterns"
```

**When to skip**: C7 MCP unavailable or verified by user.

---

#### Step B5: Find Most Critical and Structured Fix

**Analysis framework**:

1. **Root Cause Analysis** (bugs):
   - Identify actual problem vs surface symptoms
   - Trace error path
   - Find minimal change fixing root cause

2. **Impact Assessment** (features):
   - Critical path vs optional
   - Minimum viable implementation

3. **Structural Evaluation**:
   - Architectural vs localized change
   - Patterns reusable

4. **Critical Fix Selection**:
   - Address root cause
   - Follow patterns
   - Minimize regression

**Output**: Structured fix description.

---

#### Step B6: Present Pre-Modify Workflow

**Purpose**: Present workflow showing current system and where fix integrates. Be concrete - show actual code.

```markdown
## Pre-Modify Workflow: [Feature/Bug Name]

### Current System Flow

[User] → [API Handler] → [Service Layer] → [Database]
   ↓            ↓              ↓              ↓
[Error]    [500 response]   [null]       [N/A]

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

---

### Phase C: Create Octie Task

#### Step C1: Generate Success Criteria

Create quantitative, verifiable success criteria:

**For features**:
- Functionality implemented
- Tests written
- Documentation updated

**For bugs**:
- Bug fixed
- Root cause addressed
- Regression prevention

---

#### Step C2: Create Octie Task

**CRITICAL**: Run `octie create -h` first.

```bash
octie create -h
```

**Create task**:
```bash
octie create \
  --title "<Action Verb> <Specific Object>" \
  --description "<Detailed explanation>" \
  --success-criterion "<Quantitative criteria 1>" \
  --success-criterion "<Quantitative criteria 2>" \
  --success-criterion "<Quantitative criteria 3>" \
  --deliverable "<Deliverable 1>" \
  --deliverable "<Deliverable 2>" \
  --related-files "path/to/file1" \
  --related-files "path/to/file2" \
  --c7-verified "<library:pattern>" \
  --priority <top|second|later>
```

**Add blockers if task depends on others**:
```bash
octie create \
  --title "<Task Title>" \
  --description "..." \
  --success-criterion "..." \
  --blockers <existing-task-id> \
  --dependency-explanation "Depends on Task X" \
  --priority top
```

**Use `--format md`** for token-efficient output.

---

#### Step C3: Link to Existing Tasks (if needed)

If new task depends on existing Octie tasks:

```bash
octie update <new-task-id> --blockers <existing-task-id> --dependency-explanation "Requires Task X completion"
```

---

### Phase D: User Confirmation

#### Step D1: Present Task Creation

Show the user the new Octie task with:
- Task title and description
- Success criteria
- Deliverables
- Related files
- C7 verification
- Priority

**Get task details**:
```bash
octie get <task-id> --format md
```

#### Step D2: Confirm with User

**Prompt**:
```
Created new Octie task:

**Title**: [title]
**Description**: [description]
**Success Criteria**:
- [ ] criterion 1
- [ ] criterion 2
**Deliverables**:
- deliverable 1
- deliverable 2
**Related Files**: file1, file2
**C7 Verified**: library:pattern

Ready to proceed with implementation? (y/n)
```

**Behavior**:
- `y` → Proceed with implementation (user can invoke `/octie-dev`)
- `n` → Ask what needs to be modified, apply changes, re-confirm

---

#### Step D3: Next Steps

After confirmation:
```
Next steps:
  🚀 Use /octie-dev to begin implementation
  📋 Review Octie task for success criteria
  📖 Review pre-modify workflow analysis
```

---

## Octie Task Fields

| Field | Octie Flag |
|-------|------------|
| Title | `--title` |
| Description | `--description` |
| Success Criteria | `--success-criterion` (up to 10) |
| Deliverables | `--deliverable` (up to 10) |
| Related Files | `--related-files` |
| C7 Verified | `--c7-verified` |
| Priority | `--priority` |
| Blockers | `--blockers` + `--dependency-explanation` |

---

## Critical Requirements

**Octie Required**: Abort if Octie unavailable.


**Quantitative Success Criteria**: Measurable and verifiable.

**C7 MCP Verification**: Always query C7 MCP after reading files.

**Critical Fix Analysis**: Find minimal change addressing root cause.

**Pre-Modify Workflow**: Present current system before proposing changes.

**Token Efficiency**: Read symbols first, use `--format md`.

---

## Integration with Other Skills

### With octie-dev (Phase 2)

```
octie-fix (Phase 3)
  ↓ C7 MCP verification
  ↓ Critical fix analysis
  ↓ Creates Octie task with criteria
octie-dev (Phase 2)
  ↓ Reads Octie task
  ↓ Implements using fix approach
  ↓ Updates task with completed criteria
  ↓ Commits changes
```

### With octie-init (Phase 1)

This skill assumes Phase 1 has created:
- `.memo/` with specs and symbols
- `.Codex/rules/` with coding standards
- Initial Octie tasks (via octie-init)

---

## Tasks System Requirement

**CRITICAL**: Use Codex Tasks System.

**Tools**: TaskCreate, TaskList, TaskUpdate, TaskGet, TaskDelete

**Pattern**: `[Verb] + [Specific Object] + [Context/Purpose]`

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Octie unavailable | Abort - Octie required |
| No .memo folder | Create via memo-dec init first |
| Spec file missing | Proceed without spec |
| Git has no commits | Skip git diff |
| Feature spans multiple tasks | Create parent task with subtasks |
| Bug is critical | Set priority to top |
| No relevant files found | Ask user to specify |
| User rejects task | Ask modifications, re-confirm |
| C7 MCP unavailable | Proceed without C7 MCP |

---

## Best Practices

1. **Always run `octie -h` first** to verify Octie
2. **Run `octie create -h`** before creating tasks
3. **Use `--format md`** for token-efficient output
4. **Read symbols first** - 50-70% token savings
5. **C7 MCP after file reading** - verify patterns
6. **Critical fix selection** - minimal change
7. **Pre-modify workflow** - show current system
8. **Quantitative criteria** - verifiable
9. **User confirmation** - always show and get approval
10. **Link to existing tasks** - maintain dependencies

---

## File Organization

```
parent-directory/ (git root)
├── <project-folder>/          # Source code
├── .octie/                     # Octie task graph
│   └── (octie task data)
├── .Codex/                   # Coding rules
│   └── rules/
├── .memo/                     # Project documentation & context
│   ├── memosymbols.txt
│   └── memodocs/
│       ├── user_spec_<project>.md
│       └── tech_spec_<project>.md
└── AGENTS.md
```

---

## ⚠️ Git Safety Caution

**CRITICAL**: This skill creates Octie tasks but does not commit changes.

### Before ANY Git Operation

```bash
git rev-parse --git-dir
pwd
git log --oneline -5
git remote -v
git status
```

### Destructive Commands (FORBIDDEN)

- `rm -rf .git`
- `git reset --hard`
- `git clean -fdx`

---

## ⚠️ REMINDER: Tasks System Required

**CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

---

*See [reference.md](reference.md) for detailed templates, Octie command examples, and integration patterns.*
