---
name: octie-dev
description: Phase 2: Development loop with Octie task management. Loads context from memo-dec (symbols, specs), locates project folder, checks C7 MCP before implementing, finds most critical structured fix, presents pre-modify workflow, uses C7 MCP for debugging, implements features with tests, commits, and refreshes symbols. Uses Octie for task management (list, update, complete). Use after octie-init to implement features. Trigger: "implement", "dev loop", "continue development", "start working".
allowed-tools: Write, Bash, Read, TaskCreate, TaskList, TaskUpdate, TaskGet, TaskDelete, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Octie Dev - Development Loop with Octie

**⚠️ CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

---

## Overview

This skill provides **Phase 2: Development Loop** for projects initialized with octie-init.

**Workflow**:
1. (Optional) Skip Phase A if invoked after `octie-fix` (context already loaded)
2. Load context from `.memo/` (symbols via memo-dec, specs)
3. Locate sibling project folder created by octie-init
4. Set project folder as working directory
5. Query Octie for ready tasks: `octie list --status ready` and `octie find --without-blockers`
6. Check C7 MCP before implementing
7. Find most critical and structured fix for each task
8. Present pre-modify workflow
9. Implement features
10. Use C7 MCP for debugging when problems occur
11. Update Octie tasks with `--complete-criterion` and `--complete-deliverable`
12. Commit changes and refresh symbols

**Connection with octie-init**:
- octie-init (Phase 1): Creates project + .memo + Octie tasks
- octie-dev (Phase 2): Reads Octie tasks, implements in project folder
- octie-fix (Phase 3): Adds new tasks to Octie with C7 verification → octie-dev continues

---

## Critical Requirements

**Octie Task Updates**: Use `octie update` with `--complete-criterion` and `--complete-deliverable` to mark progress. Abort if Octie unavailable.

**⚠️ NEVER use `octie update --unblock`**: This command bypasses the proper dependency resolution logic and can corrupt the task dependency graph. The `--unblock` flag forcefully removes blockers without validating that prerequisites are actually complete, which causes:
- Dependent tasks may start before prerequisites are truly done
- Task state becomes inconsistent with actual work completed
- The dependency graph logic is bypassed, leading to race conditions in task scheduling

**Always use `octie approve` instead** - it properly validates all criteria are met before unblocking dependents.

**Solve One Task at a Time**: Complete each task fully (all criteria, deliverables, and need_fix items) before moving to the next task. Do not work on multiple tasks in parallel. This ensures:
- Clear focus on a single objective
- Proper task completion tracking
- Clean git history per task
- Correct dependency unblocking via `octie approve`


**Critical Fix Analysis**: Find minimal change addressing root cause, follow existing patterns, align with C7 MCP.

**Pre-Modify Workflow Presentation**: Show current system before changes.

**No Session Interruptions**: Work autonomously. Make reasonable assumptions and proceed.

**Sync with octie-init Structure**: Maintain sibling folder structure.

**Token Efficiency**: Read symbols first (50-70% savings), use `--format md` for Octie output.

---

## Phase A: Context Loading

### Step A0: Skip to Phase B if Context Already Loaded

**Purpose**: If invoked after `octie-fix`, skip Phase A and proceed to Phase B.

**Detection**: Checklist item was just added with C7 MCP notes + user indicates implementation readiness.

**When detected**: Proceed to **Phase B: Step B3** with context already loaded.

**Otherwise**: Continue with Phase A.

---

### Step A1: Verify Octie Availability

**CRITICAL**: Run `octie -h` first.

```bash
octie -h
```

**If Octie unavailable**: Abort.

---

### Step A2: Check Reference Files Structure

**Action**: Run `ls -R` on .memo and .Codex folders.

```bash
ls -R .memo
ls -R .Codex
```

**Purpose**: Identify available reference files (coding rules, UI rules, tech specs).

---

### Step A3: Read Symbol Files

**File**: `.memo/memosymbols.txt`

Read first for token-efficient context:
```
Format: line:tag:name (e.g., 4:fun:App = line 4 has function App)
Tags: fun=function, var=variable, com=command
```

---

### Step A4: Read Folder Structure

**File**: `.memo/memotree/memofoldertree.txt`

Shows project organization.

---

### Step A5: Query Octie for Tasks

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

This MUST be run first to get the complete task list before any filtered queries.

**IMPORTANT**: `--without-blockers` only returns tasks that have NO blockers set. This does NOT mean the task is ready to work on. You MUST also check status to get available tasks.

**Query by status** (REQUIRED for available tasks):
```bash
octie list --status ready --format md
octie list --status in_progress --format md
```

**Query tasks without blockers** (DIFFERENT from ready - just means no dependencies):
```bash
octie find --without-blockers --format md
```

**Query top priority**:
```bash
octie list --priority top --format md
```

**Why both matter**:
- `--status ready` = Tasks ready to work on (no blockers AND prerequisites met)
- `--status in_progress` = Tasks currently being worked on
- `--without-blockers` = Tasks with no blockers set (may still be blocked by prerequisites)

**Extract**: Task IDs, titles, success criteria, deliverables, blockers.

---

### Step A6: Evaluate Previous Work and Git History

**CRITICAL**: This step has TWO purposes:

#### Purpose 1: Inspect Previous Session's Work

**Evaluate what was actually done** in the previous session:
- Read recent git commits: `git log --oneline -10`
- Check git diff: `git diff HEAD~2 HEAD`
- Understand what changes were made and why

#### Purpose 2: Determine Task Status

**For each in_progress task**, determine if it's actually complete:

1. **If task appears finished** (all criteria met from git history):
   - Update Octie: `octie update <task-id> --complete-criterion <criterion-id>` for each criterion
   - Update Octie: `octie update <task-id> --complete-deliverable <deliverable-id>` for each deliverable
   - Task will transition to `in_review` state automatically
   - This unblocks dependent tasks

2. **If task NOT finished**:
   - Continue working on this task (pick up where left off)
   - Check which criteria/deliverables are still incomplete
   - Proceed with implementation

**Summary**:
```
if (previous_session_completed_task):
    update_octie_with_completed_items()  # Triggers in_review
    check_for_new_ready_tasks()
else:
    continue_in_progress_task()
```

---

## Phase B: Discovery & Analysis

### Step B1: Summarize Project Context

Provide:
```markdown
## Project Context

**Tech Stack**: [from tech_spec_<project>.md]
**Current Stage**: [from Octie tasks]

**Ready Tasks (Top Priority)**:
- Task 1: [title] (ID: xxx)
- Task 2: [title] (ID: xxx)

**Blocked Tasks**:
- Task 3: [title] - blocked by [task ID]
```

---

### Step B2: Determine Which Task to Work On

**IMPORTANT**: Octie automatically changes task status to `in_review` when ALL success criteria, ALL deliverables, AND ALL need_fix items are marked complete. No manual status update needed.

**⚠️ FULLY AUTOMATIC**: Never ask user to choose tasks. Auto-select based on rules below.

**Task Selection Logic** (follow this exact order):

1. **If tasks in `in_progress` exist**: Continue working on those tasks
   - Get task details: `octie get <task-id> --format md`
   - Check which criteria/deliverables are not yet complete
   - Continue from where left off

2. **If no `in_progress` tasks but `ready` tasks exist**: Start a new ready task
   - Query: `octie list --status ready --format md`
   - **Priority selection** (fully automatic):
     ```
     top > second > later
     ```
   - If multiple tasks at same priority: Pick first one arbitrarily
   - Get full details: `octie get <task-id> --format md`

3. **If all unblocked tasks are `in_review`**: Auto-approve if tests passed
   - If tests passed and all criteria met → Run `octie approve <task-id>`
   - This unblocks dependent tasks automatically
   - If tests failed or criteria incomplete → Fix issues first

4. **If no tasks exist or all tasks blocked**: Ask user for next steps
   - May need to create new tasks via octie-fix
   - Or clear blockers on existing tasks

**Summary of what to work on**:
```
if (has in_progress_tasks):
    work_on = in_progress_tasks
elif (has ready_tasks):
    work_on = first_task_by_priority(top > second > later)  # Auto-select
elif (all unblocked are in_review and tests_passed):
    octie approve <task-id>
else:
    ask_user()
```

**Edge Cases**:

| Scenario | Action |
|----------|--------|
| No tasks at all | Ask user if they want to create tasks via octie-fix or initialize project |
| All tasks blocked | Check blockers, ask user to unblock or create new tasks |
| Task in review with need_fix | Fix the issues, then approve when complete |
| Completed tasks with passing tests | Run `octie approve <task-id>` to unblock dependents |
| Multiple ready tasks same priority | Pick first one - DO NOT ask user |

---

### Step B3: Read Priority Tasks from Octie

For **ready tasks**, extract:
- Title and description
- Success criteria (quantitative)
- Deliverables
- Need fix items (issues from review/runtime)
- Related files
- C7 verification notes

**Get full task details**:
```bash
octie get <task-id> --format md
```

---

### Step B4: Internal Discovery Questions

Ask 1-2 **internal** questions about:
- Top priority features to implement
- How features are currently implemented
- What files need to be read

---

### Step B5: Read Relevant Files

Read files based on discovery:
1. Direct dependencies (files being modified)
2. Upstream dependencies (types, models, utilities)
3. Context files (config, similar features)

**Reading strategy**: Use symbols, read existing patterns, check `.Codex/rules/`.

---

## Phase C: Implementation

### Step C0: Present Pre-Modify Workflow

**Purpose**: For each task, present workflow showing current system and where fix integrates.

```markdown
## Pre-Modify Workflow: [Task Title]

### Current System
[Component A] → [Component B] → [Component C]

### Files to Modify
- `path/to/file1.ts` (function: X)
- `path/to/file2.ts` (function: Y)

### Proposed Changes
1. Add/modify function in file1
2. Update integration in file2

### Impact
- Direct: [affected components]
- Tests: [verification needed]
```

---

### Step C1: Check C7 MCP Before Implementing

Query C7 MCP for each task before implementing. Verify best practices.

**When task has C7 Verified notes**: Use those patterns directly.

**When task lacks C7 notes**: Query C7 MCP now.

---

### Step C2: Find Most Critical and Structured Fix

**Analysis framework**:

1. **Root Cause Analysis** (bugs):
   - Identify actual problem
   - Trace error path
   - Find minimal fix

2. **Impact Assessment** (features):
   - Critical path vs optional
   - Minimum viable implementation

3. **Structural Evaluation**:
   - Architectural vs localized change
   - Existing patterns reusable

4. **Critical Fix Selection**:
   - Address root cause
   - Follow patterns
   - Minimize regression

**Output**: Structured implementation plan.

---

### Step C3: Implement Tasks

1. **Implement** following critical fix analysis
2. **Write tests** for implemented features
3. **Debug with C7 MCP** when errors occur
4. **Verify success criteria** from Octie task
5. **Update Octie** with completed criteria/deliverables

---

### Step C4: Update Octie Task Progress

**CRITICAL**: Run `octie get -h` and `octie update -h` first to understand options.

```bash
octie get <task-id> -h
octie update <task-id> -h
```

**Get task details first**:
```bash
octie get <task-id> --format md
```

**Mark criteria complete**:
```bash
octie update <task-id> --complete-criterion <criterion-id>
octie update <task-id> --complete-criterion <id1>,<id2>
octie update <task-id> --complete-criterion <criterion-id> --evidence "<proof, e.g. test output or benchmark>"
```

**Mark deliverables complete**:
```bash
octie update <task-id> --complete-deliverable <deliverable-id>
```

**Mark need_fix items complete**:
```bash
octie update <task-id> --complete-need-fix <need-fix-id>
```

**Add new issues discovered as need_fix items** (blocking issues found during implementation):
```bash
# Add need_fix from code review
octie update <task-id> --add-need-fix "<issue>" --need-fix-source review --need-fix-file "path/to/file.ts"

# Add need_fix from runtime error
octie update <task-id> --add-need-fix "<error message>" --need-fix-source runtime

# Add need_fix from regression
octie update <task-id> --add-need-fix "<broken feature>" --need-fix-source regression
```

**need_fix sources**:
- `review` - issues found during code review
- `runtime` - runtime errors or exceptions
- `regression` - features that stopped working

**Add notes**:
```bash
octie update <task-id> --notes "<implementation notes>"
```

---

### Step C5: Debug with C7 MCP When Problems Occur

Use C7 MCP for debugging: compilation errors, runtime exceptions, test failures.

---

## Phase D: Commit & Refresh

### Step D1: Generate Commit Message

Use conventional commits:
```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, chore
```

### Step D2: Execute Git Commands

```bash
git add .
git commit -m "[generated message]"
```

### Step D3: Refresh Symbols

```bash
memo-dec extractsymbols
```

### Step D4: Update Octie Task Status

If all criteria/deliverables complete, task automatically changes to `in_review`.

**For approval** (optional):
```bash
octie approve <task-id>
```

---

## Octie Command Quick Reference

| Operation | Command |
|-----------|---------|
| List all tasks | `octie list --format md` |
| List ready tasks | `octie list --status ready --format md` |
| List in_progress tasks | `octie list --status in_progress --format md` |
| Find without blockers | `octie find --without-blockers --format md` |
| Get task details | `octie get <id> --format md` |
| Complete criterion | `octie update <id> --complete-criterion <criterion-id>` |
| Complete deliverable | `octie update <id> --complete-deliverable <deliverable-id>` |
| Add success criterion | `octie update <id> --add-success-criterion "<text>"` |
| Add need_fix (review) | `octie update <id> --add-need-fix "<issue>" --need-fix-source review --need-fix-file "path"` |
| Add need_fix (runtime) | `octie update <id> --add-need-fix "<error>" --need-fix-source runtime` |
| Complete need_fix | `octie update <id> --complete-need-fix <need-fix-id>` |
| ⚠️ **NEVER use --unblock** | Corrupts dependency logic - use `octie approve` instead |
| Add notes | `octie update <id> --notes "<text>"` |
| Validate graph | `octie graph validate` |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Invoked after octie-fix | Skip Phase A, proceed to Phase B |
| Octie unavailable | Abort - Octie required |
| No ready tasks | Query `octie list --status blocked` |
| All tasks completed | Prompt for new tasks or octie-fix |
| Git has no commits | Skip git diff, continue |
| memo-dec not initialized | Run `memo-dec init` first |
| Implementation fails criteria | Don't commit, ask user |
| Bash command blocks | Kill, re-run with non-interactive flags |

---

## File Structure

**Sibling Structure** (created by octie-init):
```
parent-directory/
├── <project-folder>/          # Source code
├── .octie/                    # Octie task graph
│   └── (octie task data)
├── .memo/                     # Project documentation & context
│   ├── memosymbols.txt
│   └── memodocs/
│       ├── user_spec_<project>.md
│       └── tech_spec_<project>.md
├── .Codex/                   # Coding rules
│   └── rules/
└── AGENTS.md
```

---

## Best Practices

1. **Always run `octie -h` first** to verify Octie
2. **Run `octie <command> -h`** before each operation
3. **Use `--format md`** for token-efficient output
4. **Read symbols first** - 50-70% token savings
5. **Present pre-modify workflow** before implementing
6. **Check C7 MCP** before implementing, debug with C7 MCP
7. **Find critical fix** - minimal change
8. **Use non-interactive bash flags**
9. **Direct errors** - no fallbacks
10. **Update Octie** as work progresses
11. **Solve one task at a time** - Complete all criteria/deliverables for one task before starting the next
12. **Use `octie approve`** to unblock dependent tasks after completing a task - NEVER use `--unblock`

---

## ⚠️ Git Safety Caution

**CRITICAL**: This skill commits changes to git. Always verify repository location.

### Before ANY Git Operation

```bash
git rev-parse --git-dir
pwd
git log --oneline -5
git remote -v
git status
```

### Mandatory Remote Backup

**ALWAYS push to remote within 1 hour of first commit.**

```bash
git remote add origin <github-url>
git push -u origin main
```

**Never rely on local-only repositories** - catastrophic loss is irreversible.

---

## ⚠️ REMINDER: Tasks System Required

**CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

---

*See [reference.md](reference.md) for detailed templates, Octie command examples, and integration patterns.*
