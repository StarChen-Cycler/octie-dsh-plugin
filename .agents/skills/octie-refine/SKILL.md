---
name: octie-refine
description: Phase 2: Octie Task Graph Refinement & Dependency Management. Rearrange tasks, modify dependencies, restructure task flow. Read user_spec and tech_spec files from octie-init, then use wire/merge/update commands to modify task relationships. Use when "rearrange tasks", "modify dependencies", "restructure octie graph", "change task flow", "refine octie tasks", "update blockers", "task dependency management", "reorganize octie". Decoupled from octie-research - focused solely on graph manipulation.
allowed-tools: Bash, Read, Write
---

# Octie Refine - Phase 2: Task Graph Refinement

**Purpose**: Modify and rearrange octie task dependencies after initial planning.

**When to use**: Restructuring task flow, fixing dependency issues, reorganizing priorities, splitting/merging tasks.

**When NOT to use**: Initial project setup (use `octie-research`), implementation coding (use `octie-dev`).

---

## Workflow Overview

```
A. Read Specs → B. Analyze Graph → C. Refine (1.Remove Blockers → 2.Merge/Split → 3.Rearrange) → D. Validate → E. Report
```

**⚠️ CRITICAL SEQUENCE**: Refinement MUST follow this order:
1. **Remove unnecessary blockers** - Clean graph first, parallelize where possible
2. **Merge or disconstruct tasks** - Atomicity alignment second
3. **Rearrange task dependencies** - Wire/reorder third
4. **Validate graph structure** - Final step, after all changes

---

## Critical Requirements

**⚠️ MUST**: Read spec files before any modifications. Understand project context first.

**⚠️ MUST**: Follow refinement sequence: Remove blockers → Merge/Split → Rearrange → Validate.

**⚠️ MUST**: Validate graph AFTER all refinement operations complete.

**⚠️ MUST**: Use TodoWrite for each refinement operation. Track all changes.

**⚠️ NEVER**: Modify task status directly. Status is auto-calculated.

**⚠️ NEVER**: Create new tasks here. This skill is for REARRANGING existing tasks only.

---

## Core Dependency Logic & Rationale

**Horizontal Decomposition**: Parallel tasks at same level with no deliverable dependencies between them.

**Vertical Decomposition**: Sequential tasks where output of Task N is required input for Task N+1.

**Blocker Rationale**: A task should only block another if:
- It produces a deliverable the blocked task needs (file, API, data structure)
- The dependency is unavoidable (no stub/mock workaround)
- The relationship is explicitly documented in `--dependencies`

**⚠️ NEVER** add blockers for coordination, ordering preferences, or same-person assignment.

### Task Atomicity Standards

- **Single focus**: One clear objective (no "and" in title)
- **Verifiable**: Specific success criteria that can be checked
- **Concrete**: Produces tangible outputs (files, APIs, docs)
- **Aligned**: Tasks at same level have similar scope and comparable deliverable count

**Priority vs Scope**: `--priority` indicates urgency (when to start), not scope (what to do).

### Task Consistency Standards

**⚠️ CRITICAL**: Related tasks MUST maintain consistency across:

| Aspect | Check | Example |
|--------|-------|---------|
| **Naming** | Same pattern across related files | `step2_style.py` ↔ `step2_style/` (not `step2_style_analysis.py`) |
| **Folder structure** | Parallel tasks use same depth | `validation/step1/`, `validation/step2/` (not `validation/step1/`, `step2/`) |
| **Deliverable format** | Consistent path patterns | `src/modules/user/`, `src/modules/auth/` (not `src/user/`, `modules/auth/`) |
| **Module names** | Match folder names | `step3_roughcut.py` ↔ `step3_roughcut/` (not `step3_rough_cut.py`) |

**Consistency Checklist**:
- [ ] All related tasks use same naming convention
- [ ] Folder depths match across parallel tasks
- [ ] Module names align with folder names
- [ ] No mixed conventions (e.g., snake_case vs camelCase)

**During refinement**: If inconsistency found, update deliverables to unify convention before merging/rearranging.

---

## Phase A: Read Specifications

### Step A1: Locate Project and Spec Files

```bash
# Find project folder (sibling to .octie/)
ls -la

# Read user specification
cat .memo/memodocs/user_spec_*.md

# Read technical specification
cat .memo/memodocs/tech_spec_*.md
```

**Extract**:
- Core features and requirements
- Tech stack constraints
- Architecture patterns
- Integration points affecting task order

---

## Phase B: Analyze Current Graph

### Step B1: View Current Structure

```bash
# View complete task details (full context - no head options)
octie list --format md

# View graph structure for dependency analysis
octie list --graph

# Find tasks ready to start (no blockers)
octie find --without-blockers
```

**Dependency Logic & Rationale**:
- **Horizontal decomposition**: Break work into parallel tasks at same complexity level
- **Vertical decomposition**: Sequential tasks where each builds on the previous
- **Blocker rationale**: A task should only block another if:
  - It produces a deliverable the blocked task needs
  - The dependency is unavoidable (no workaround)
  - The relationship is explicitly documented in `--dependencies`

**Task Complexity Alignment**:
- Tasks at same level should have similar scope (2-8 hours each)
- If Task A takes 2 hours and Task B takes 8 hours, split Task B or merge Task A
- Use `--priority` to indicate urgency, not complexity

**Analyze from both views**:
- **From `--format md`**: Task details, deliverables, criteria, complexity
- **From `--graph`**: Dependency relationships, flow
- Look for: Misaligned priorities, non-atomic tasks, trivial tasks

### Step B2: Apply Atomicity & Alignment Analysis

**Checklist for each dependency level**:
- [ ] All tasks are atomic (single objective, verifiable deliverables)
- [ ] Tasks at same level have comparable scope (similar deliverable count)
- [ ] No trivial tasks with just 1-2 deliverables (merge candidates)
- [ ] No oversized tasks with many unrelated objectives (split candidates)

**Atomicity Alignment - Resolution**:
```bash
# Find tasks at same level
octie list --graph | grep -A 5 "Level 2"

# If Task A has 1 deliverable, Task B has 8 deliverables at same level:
# Option 1: Split Task B into focused sub-tasks
octie wire <B-part2> --after <B-part1> ...

# Option 2: Merge Task A with another related small task
octie merge <A-id> <C-id> --force
```

### Step B3: Validate Blocker Logic

**For each blocker relationship**:
- [ ] Does blocked task NEED a deliverable from blocker?
- [ ] Is there NO workaround (cannot stub/mock)?
- [ ] Is the dependency rationale documented in `--dependencies`?

**Red flags** (remove these blockers):
- Blocker added for "coordination" only
- Same person assigned to both tasks (use priority instead)
- No concrete deliverable dependency

### Step B4: Identify Refinement Needs

**During analysis, look for**:

| Issue | How to Spot | Resolution |
|-------|-------------|------------|
| Scope mismatch | Task deliverable count analysis | Split or merge per atomicity rules |
| Wrong priority | Context vs priority mismatch | Update --priority |
| Missing blockers | Logic gaps in dependency chain | Add --blockers + --dependency-explanation |
| Unjustified blockers | No deliverable need | Remove blocker, keep parallel |

---

## Phase C: Graph Refinement Operations

**⚠️ CRITICAL SEQUENCE**: Follow steps C1 → C2 → C3 in order. Do NOT skip or reorder.

**Before using any `octie` command**, check help first:
```bash
octie wire -h
octie merge -h
octie update -h
```

### Step C1: Remove Unnecessary Blockers (FIRST)

**Purpose**: Maximize parallelization by removing unjustified blockers.

```bash
# Get current state first
octie get <task-id>

# Remove a specific blocker (dependencies auto-clear if last blocker)
octie update <task-id> --unblock <blocker-id>
```

**⚠️ NOTE**: When removing the last blocker, dependencies explanation is cleared automatically. Do NOT provide `--dependency-explanation` with `--unblock`.

**Remove blocker when**:
- Blocker added for "coordination" only → Use priority instead
- Same person assigned to both tasks → Use priority instead
- No concrete deliverable dependency → Make parallel
- Stub/mock workaround exists → Not a true blocker

### Step C2: Merge or Disconstruct Tasks (SECOND)

**Purpose**: Align task atomicity - merge trivial tasks, split oversized ones.

#### Merge (Combine Small Tasks)

```bash
octie merge <source-id> <target-id> --force
```

**Merge when**: Below atomic threshold, strong coupling, same level related output.

**⚠️ NEVER merge when**: Multiple objectives result, different dependency levels, blocker relationships lost.

**⚠️ CAUTION**: Cannot undo. Verify with `octie get <id>` first.

#### Disconstruct (Split Large Tasks)

Use `octie wire` to break oversized tasks into sequential sub-tasks.

```bash
# Split Task B into B1 → B2
octie wire <B2-id> --after <B1-id> --dep-on-after "B2 needs B1's output"
```

**Split when**: Task has many unrelated objectives, scope exceeds 8 hours, multiple "and" in title.

### Step C3: Rearrange Task Dependencies (THIRD)

**Purpose**: Insert/reorder tasks in dependency chains.

```bash
# Insert B between A and C (A→C must already exist)
# Before: abc123 → def456
# After:  abc123 → xyz789 → def456

octie wire <task-id> \
  --after <predecessor-id> \
  --before <successor-id> \
  --dep-on-after "<Why this task needs predecessor>" \
  --dep-on-before "<Why successor needs this task>"
```

**Example**:
```bash
octie wire xyz789 \
  --after abc123 \
  --before def456 \
  --dep-on-after "Needs API spec from abc123" \
  --dep-on-before "Frontend def456 needs models from this task"
```

**⚠️ PREREQUISITE**: Edge A→C must exist. Wire only works on connected tasks.

**Twin Validation**: Both `--dep-on-after` AND `--dep-on-before` required.

### Step C4: Update Priority (Optional)

Adjust task urgency without changing dependencies.

```bash
octie update <task-id> --priority <top|second|later>
```

---

## Phase D: Validation (FINAL STEP)

**⚠️ CRITICAL**: Run validation AFTER completing ALL refinement operations (C1-C3). Do NOT validate after each individual change.

### Step D1: Final Graph Validation

```bash
# Run ALL validation commands at the end
octie graph validate
octie graph cycles
octie find --orphans
octie list --graph
```

**Check**:
- [ ] No cycles introduced
- [ ] All tasks connected (no orphans)
- [ ] Blocker dependencies logical
- [ ] Priority alignment correct

### Step D2: Verify Ready Tasks

```bash
octie find --without-blockers
```

Confirm tasks without blockers are actually ready to start.

---

## Phase E: Report

### Step E1: Summarize Changes

```markdown
## Octie Refine: Graph Updated

**Operations Performed**:
- Wired: X tasks reordered
- Merged: X tasks combined
- Updated: X dependencies modified

**Current State**:
- Tasks: X total (Top: Y, Second: Z, Later: W)
- Graph: Valid/Invalid
- Ready to start: X tasks without blockers

**Next Steps**:
- If valid: Proceed with `/octie-dev` for implementation
- If issues: Additional refinement needed
```

---

## Quick Reference

| Order | Command | Purpose |
|-------|---------|---------|
| 1 | `octie update --unblock <id>` | Remove blocker (auto-clears deps if last) |
| 2a | `octie merge <src> <tgt> --force` | Combine small tasks |
| 2b | `octie wire` (split) | Disconstruct large tasks |
| 3 | `octie wire <id> --after --before` | Rearrange dependencies |
| - | `octie update --priority` | Change urgency (anytime) |
| FINAL | `octie graph validate` | Check integrity |
| FINAL | `octie graph cycles` | Detect circular deps |
| FINAL | `octie find --orphans` | Find disconnected |

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "Cycle detected" | Circular blocker | Use `--unblock` to remove one blocker |
| "twin required" | Missing dependency explanation | Add `--dependency-explanation` with `--blockers` |
| "Edge doesn't exist" | Wire on unconnected tasks | Wire only works on existing A→C edges |
| "Task not found" | Short ID collision | Use 7+ character UUID prefix |
| "violates atomic" | Post-merge too large | Split with wire instead |

---

## See Also

- [reference.md](reference.md) - Detailed command patterns and examples
- `octie-research` - Phase 1: Initial task planning
- `octie-dev` - Phase 3: Task implementation

---

## ⚠️ REMINDER: TodoWrite Required

Track every refinement operation with TodoWrite. Each wire, merge, or update = one todo item.
