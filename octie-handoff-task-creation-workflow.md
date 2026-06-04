---
name: octie-handoff-workflow
description: "Session-derived workflow for creating a loose Octie subproject handoff after investigation. Combines octie-research context loading with octie-fix task-preparation discipline, then creates and validates a parent handoff plus child backlog."
allowed-tools: Bash, Read, Write, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Octie Handoff - Task Creation Workflow

This document abstracts the handoff-task creation process used in this session into a reusable workflow.

It is not a skill install file. It is a root-level process note that follows the same shape as the existing Octie skill docs.

## Purpose

Use this workflow when:

- the problem has already been investigated
- the repo already has a root `.octie/` project
- the next body of work is large enough to deserve its own child Octie graph
- the new work must stay anchored to existing contract or compatibility guarantees

Do not use a handoff when:

- the follow-on work can stay inside the current root graph
- the issue has not been researched enough to define preserved contracts and blockers
- the child work would be only one small atomic task

## Workflow Overview

```text
Phase 0: Problem Intake and Evidence
  ->
Phase A: Verify Octie and Read Handoff Playbook
  ->
Phase B: Load Existing Project Context
  ->
Phase C: Anchor the Handoff to Existing Root Tasks
  ->
Phase D: Create Parent Handoff Task
  ->
Phase E: Create Child Backlog and Closeout Gate
  ->
Phase F: Validate Child and Root Graphs
  ->
Phase G: Report Parent ID, Child Path, and Ready Entry Task
```

## Critical Rules

- If `.octie/` already exists, follow the `octie-research` path, not `octie init`.
- Read the handoff playbook every time with `octie --right-way-to-create-subtask-handoff`.
- Parent handoff tasks should be anchored to completed evidence and contract tasks, not created as root-level orphans.
- Child graphs must be independent. Do not add cross-project graph edges.
- Create the child closeout gate manually inside the child project.
- Do not approve the parent handoff task until the child closeout gate is complete.
- Success criteria must be quantitative and machine-checkable. Octie will reject vague wording.
- If the handoff touches compatibility or semantics, make non-regression guardrails the first child task.
- Encode “do not create backward or forward misalignment” as explicit child-task notes and success criteria, not just a casual note in the parent description.

## Preconditions

Before creating the handoff, confirm all of the following:

- `octie` is installed and runnable.
- the repo already has a valid root `.octie/` project
- the target subproject folder name does not already exist under `.octie/subprojects/`
- there is a concrete investigation artifact
- there are existing root tasks that define the baseline contracts the child work must preserve

For technical remediation work, the evidence package should usually include:

- external or sibling investigation files supplied by the user
- repo code inspection of the actual hot paths
- a memo or investigation note written into the repo
- upstream verification from C7 or primary-source web docs when the technical surface is library- or runtime-dependent

## Phase 0: Problem Intake and Evidence

Start from the same sequence used in this session:

1. Read the user-provided investigation or context files.
2. Inspect the relevant code paths in the repo.
3. Research upstream behavior with C7 and primary-source docs if the fix depends on ROS, HDF5, NumPy, executors, or similar external behavior.
4. Write the resulting fix-path note into the repo so the future handoff has a stable evidence artifact.

This phase matters because the handoff should point at a known problem statement, not a vague intuition.

## Phase A: Verify Octie and Read Handoff Playbook

Run:

```bash
octie -h
octie handoff -h
octie --right-way-to-create-subtask-handoff
octie list -h
octie find -h
```

Purpose:

- verify Octie exists
- confirm the handoff command surface
- load the loose-handoff rules
- refresh list and find usage before touching an existing graph

The most important handoff rule from the playbook is:

- parent handoff task in root graph
- child Octie project under `.octie/subprojects/<name>/`
- loose contextual link only
- no cross-project edges
- child closeout gate created manually

## Phase B: Load Existing Project Context

Use the `octie-research` loading pattern for existing projects.

Run:

```bash
ls -R .memo .claude
octie list --format md
octie list --status ready --format md
octie graph validate --format md
git log --oneline -5
```

Read:

- `.memo/memodocs/user_spec_<project>.md`
- `.memo/memodocs/tech_spec_<project>.md`
- `.memo/memosymbols.txt`
- `.memo/memotree/memofoldertree.txt`
- any new investigation memo created in Phase 0

Purpose:

- understand current product and architecture intent
- confirm root graph status
- learn whether there are ready tasks already
- identify the real boundaries the handoff must preserve

## Phase C: Anchor the Handoff to Existing Root Tasks

This is where `octie-fix` style preparation matters.

Search the root graph for:

- the evidence-producing task
- the current semantic contract task
- the current storage or dataset contract task
- the current compatibility-policy task

Use commands like:

```bash
octie find --search "<topic>" --format md
octie find --has-file "<path>" --format md
octie get <task-id> --format md
```

In this session, the parent handoff was anchored to completed tasks representing:

- transport saturation evidence
- backward as-of sync semantics
- HDF5 layout baseline
- schema-version compatibility enforcement

This is the right pattern when the child work must optimize behavior without reopening those contracts.

## Phase D: Create Parent Handoff Task

Use:

```bash
octie handoff create --subproject-name <name> ...
```

The parent handoff task should include:

- a concrete action-verb title
- a specific description of what the child project will own
- quantitative success criteria
- deliverables for the root handoff and child project existence
- blockers pointing to the completed root baseline tasks
- dependencies explaining why those baselines matter
- related files pointing to the memo and affected code
- notes that define phase boundaries and preserved contracts

### Parent Task Checklist

- success criteria reference actual files, task counts, or required note contents
- description is specific enough to survive later review
- blockers point to completed baseline tasks, not unrelated in-progress work
- no child-specific cross-project graph edges are invented
- notes explain what must not drift

### Common Failure Mode

Octie may reject the first attempt if the success criteria are too vague.

Example fix:

- bad: “preserves semantics”
- good: “child backlog notes contain both ‘backward as-of’ and ‘schema-version compatibility’ before the parent handoff is approved”

If Octie rejects the parent task:

1. tighten the success criteria
2. keep them observable
3. rerun the command

## Phase E: Create Child Backlog and Closeout Gate

Switch to the child project with:

```bash
octie --project .octie/subprojects/<name> ...
```

The child backlog should be created in a controlled order.

### Recommended Child Backlog Shape

1. Guardrail task
2. Primary implementation task A
3. Primary implementation task B
4. Realistic throughput or regression measurement task
5. Decision task for any optional phase-2 redesign
6. Child closeout gate

### Why This Order Works

- the guardrail task becomes the single ready entry task
- implementation tasks are blocked on the guardrail
- the measurement task is blocked on the implementation tasks
- the architecture decision is blocked on the measurement task
- the child closeout gate is blocked on everything

### Child Task Design Rules

- each child task must still be atomic
- titles need action verbs
- success criteria should be assertions, passing command outcomes, counts, or exact artifacts
- notes should explicitly restate preserved contracts when drift risk is high

### Example Guardrail Content

For compatibility-sensitive work, the first child task should define:

- preserved sync semantics
- preserved provenance handling
- preserved on-disk layout
- preserved schema-version behavior
- required non-regression tests
- realistic performance fixtures or commands

### Example Misalignment Guardrails

If the user asks to avoid backward or forward misalignment, encode both:

- sync-side misalignment
  - no forward-fill
  - no source-timestamp-driven selection
  - preserve backward as-of matching
- compatibility-side misalignment
  - preserve current HDF5 layout
  - preserve validator expectations
  - preserve schema-version compatibility policy

## Phase F: Validate Child and Root Graphs

After backlog creation, validate both graphs.

Run:

```bash
octie --project .octie/subprojects/<name> list --format md
octie --project .octie/subprojects/<name> list --graph --format md
octie --project .octie/subprojects/<name> graph validate --format md
octie --project .octie/subprojects/<name> find --without-blockers --format md
octie --project .octie/subprojects/<name> find --orphans --format md
octie get <parent-task-id> --format md
octie graph validate --format md
```

Success conditions:

- child graph validates
- root graph validates
- child graph has exactly the intended entry task ready
- child graph has no orphans
- parent task contains the canonical Octie handoff note block

## Phase G: Report

The handoff is only complete when the report includes:

- parent handoff task ID
- child subproject path
- child task list or graph summary
- current ready entry task in the child graph
- confirmation that no orphans exist
- confirmation that preserved contracts are encoded in the child backlog

## Full Lifecycle Summary

The full lifecycle used in this session was:

1. user supplied external investigation files
2. repo code was inspected against those files
3. C7 and web research verified the likely fix path
4. a repo memo documented the remediation plan
5. Octie CLI and handoff playbook were read
6. root graph state, specs, symbols, and recent git history were loaded
7. related root tasks were searched and reviewed
8. a parent handoff task was created and anchored to completed baseline tasks
9. a dedicated child subproject was initialized under `.octie/subprojects/`
10. a child backlog and closeout gate were created manually
11. both graphs were validated
12. the result was reported with parent ID, child path, and next ready child task

That is the intended end-to-end handoff lifecycle.

## Failure Modes Seen in This Session

- Parent handoff creation failed when success criteria were not quantitative enough.
- Child task creation failed when the title did not contain a strong action verb.
- Child task creation failed when success criteria described intent instead of an observable result.

The practical fix in all three cases was the same:

- make the language tighter
- make the criteria measurable
- rerun without changing the workflow itself

## Minimal Command Skeleton

```bash
# Verify tooling and read rules
octie -h
octie handoff -h
octie --right-way-to-create-subtask-handoff
octie list -h
octie find -h

# Load existing graph and context
octie list --format md
octie list --status ready --format md
octie graph validate --format md
git log --oneline -5

# Search for baseline anchors
octie find --search "<topic>" --format md
octie find --has-file "<path>" --format md
octie get <baseline-id> --format md

# Create parent handoff
octie handoff create --subproject-name <name> ...

# Create child backlog
octie --project .octie/subprojects/<name> create ...
octie --project .octie/subprojects/<name> create ...
octie --project .octie/subprojects/<name> create ...
octie --project .octie/subprojects/<name> create ...
octie --project .octie/subprojects/<name> create ...
octie --project .octie/subprojects/<name> create ...

# Validate child and root graphs
octie --project .octie/subprojects/<name> list --graph --format md
octie --project .octie/subprojects/<name> graph validate --format md
octie --project .octie/subprojects/<name> find --without-blockers --format md
octie --project .octie/subprojects/<name> find --orphans --format md
octie get <parent-id> --format md
octie graph validate --format md
```

## Recommended Reuse Rule

If a future issue follows this same pattern:

- external investigation
- repo validation
- upstream doc check
- compatibility-sensitive follow-on work
- large enough scope for a child graph

then reuse this workflow directly.

If the future issue does not have compatibility or semantic drift risk, simplify the child backlog by dropping the dedicated guardrail task and keeping the handoff smaller.
