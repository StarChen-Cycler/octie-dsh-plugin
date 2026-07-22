---
name: octie-research
description: Phase 1: Octie Project Initialization & Task Planning. Initialize octie projects, create atomic tasks with blockers, view graph structure, validate task configurations. MUST use research skill for edge cases and related questions when project already initialized. Rearrange tasks using create/merge/wire if needed. Proceed to octie-dev when well-defined. Trigger: "plan tasks", "initialize octie", "create task structure", "octie plan", "octie research", "task planning", "task research".
allowed-tools: Bash, Read, Write, Skill, WebSearch, mcp__tavily__tavily_search, mcp__metaso__metaso_web_search, mcp__metaso__metaso_web_reader, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__github__search_code
---

# Octie Research - Phase 1: Project Initialization & Task Planning

**⚠️ CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

---

## Workflow

```
A. octie init → B. Read Specs → C. RESEARCH (if existing) → D. Create Tasks → E. Validate Graph → F. Report
```

**Note**: After reporting valid configuration, use `/octie-dev` to begin implementation.

---

## Critical Rules

| Rule | Description |
|------|-------------|
| **RESEARCH REQUIRED** | If `.octie/` exists, MUST invoke `/research` before creating/modifying tasks |
| **Atomic Tasks** | 2-8 hours scope, specific, executable, verifiable |
| **Twin Feature** | `--blockers` AND dependency explanation MUST be provided together. Use `--dependencies` for `octie create`, `--dependency-explanation` for `octie update` |
| **Multi-Item** | Up to 10 criteria, 10 deliverables per task. Quantitative criteria. |
| **Short IDs** | Use first 7-8 characters of UUID |

---

## INVALID Commands

```bash
# WRONG                                    # CORRECT
octie update <id> --status <status>        # Status is auto-calculated
octie create --blockers <ids>              # Need --dependencies too
octie update <id> --blockers               # Need --blockers <ids>
```

---

## Phase A: Initialize

```bash
octie init                    # Create .octie/ folder
octie list --graph            # View structure
```

---

## Phase B: Read Specs

### Step B0: Read User Spec and Tech Spec (MANDATORY)

Before researching or creating tasks, read the spec files to understand the project:

```bash
# Read user specification
cat .memo/memodocs/user_spec_<project>.md

# Read technical specification
cat .memo/memodocs/tech_spec_<project>.md
```

**Purpose**: Understand project requirements, features, tech stack, and architecture before research.

**Extract**:
- Core features from user_spec
- Tech stack from tech_spec
- API design patterns
- Data models

---

## Phase C: Research & Create

### Step C1: Research (MANDATORY if existing)

If `octie list --graph` shows existing tasks:

```bash
/research
```

**Research focus**: Technology edge cases, architecture patterns, integration concerns, testing strategies.

**After research**: Create tasks for discovered edge cases, add C7 verification, adjust priorities.

### Step C2: Analyze Existing Graph (If Tasks Exist)

When `.octie/` already has tasks, analyze before creating new ones:

```bash
octie list --graph    # View current structure
octie graph validate  # Check for issues
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

### Step C3: Create Tasks

**Pattern**: Max 10 criteria, 10 deliverables. Quantitative criteria, specific deliverables.

**Success Criteria & Deliverables Clarity**:
- Each criterion should be independently verifiable (yes/no, pass/fail)
- Each deliverable should be a concrete output (file, API, test, docs)
- Use `--notes` to add context that doesn't fit in criteria/deliverables
- Add assumptions and constraints in notes for clarity

**Good vs Bad Examples**:
| Type | Bad | Good |
|------|-----|------|
| Criterion | "Works well" | "Returns 200 status code" |
| Criterion | "Fast" | "Response time < 200ms" |
| Deliverable | "Code" | "src/api/auth/login.ts handler" |
| Notes | - | "Assumes PostgreSQL, requires env vars: JWT_SECRET" |

```bash
octie create \
  --title "<Action Verb> <Object> <Context>" \
  --description "<What + Why + How, min 50 chars>" \
  --success-criterion "<Quantitative 1>" \
  --success-criterion "<Quantitative 2>" \
  --deliverable "<Specific output 1>" \
  --deliverable "<Specific output 2>" \
  --notes "<Rationale>" \
  --related-files <path1>,<path2> \
  --priority <top|second|later> \
  --blockers <id1>,<id2> \
  --dependencies "<Why blockers needed>"
```

### Example 1: Implementation Task

```bash
octie create \
  --title "Implement JWT login endpoint" \
  --description "Create POST /api/auth/login endpoint. Validates credentials against DB, returns JWT. Uses bcrypt with 10 rounds." \
  --success-criterion "Returns 200 with JWT for valid credentials" \
  --success-criterion "Returns 401 for invalid credentials" \
  --success-criterion "JWT has userId claim, 24hr expiration" \
  --success-criterion "Response time < 200ms" \
  --success-criterion "Test coverage > 90%" \
  --deliverable "POST /api/auth/login handler" \
  --deliverable "JWT token generation utility" \
  --deliverable "Unit tests in tests/auth.test.ts" \
  --deliverable "API docs in OpenAPI format" \
  --related-files src/auth/,src/routes/auth.ts \
  --notes "Token secret from process.env.JWT_SECRET" \
  --priority top
```

### Example 2: Task with Blockers

```bash
octie create \
  --title "Implement password reset flow" \
  --description "Password reset via email. User requests reset, system sends token email, user resets." \
  --success-criterion "Reset token expires after 1 hour" \
  --success-criterion "Email sent within 30 seconds" \
  --success-criterion "New password hashed with bcrypt" \
  --deliverable "POST /api/auth/forgot-password" \
  --deliverable "POST /api/auth/reset-password" \
  --deliverable "Email template" \
  --priority second \
  --blockers f8b2449a \
  --dependencies "Needs JWT login (f8b2449a) for token patterns"
```

### Step C4: Wire Dependencies

```bash
octie wire <task-id> --after <src> --before <tgt> \
  --dep-on-after "reason" --dep-on-before "reason"
```

### Step C5: Incorporate User Feedback

If user provides suggestions that adjust the task flow:

1. **Evaluate suggestion**: Does it improve scope, clarity, or dependencies?
2. **Apply adjustment**: Use create/merge/wire to incorporate changes
3. **Validate again**: Run graph validation after modifications
4. **Document rationale**: Update notes with explanation

**Common adjustments**:
- Split oversized tasks into smaller chunks
- Merge trivial tasks that are too small
- Reorder dependencies for better flow
- Add missing blockers or remove unnecessary ones

---

## Phase D: Validate

```bash
octie list --graph            # View relationships
octie graph validate          # Check integrity
octie graph cycles            # Detect cycles
octie find --orphans          # Find disconnected
octie find --without-blockers # Find ready tasks
```

---

## Phase E: Report

**If valid**:
```markdown
## Octie Research: Configuration Valid
**Tasks**: X total (Top: Y, Second: Z, Later: W)
**Graph**: Valid, no cycles
**Ready to start**: X tasks without blockers
**Next step**: Use `/octie-dev` to begin implementation.
```

**If issues**: List problems and fixes needed. Rearrange with create/merge/wire/update.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/research` | MANDATORY for existing projects |
| `octie init` | Initialize project |
| `octie create` | Create atomic task |
| `octie list --graph` | View structure |
| `octie graph validate` | Check integrity |
| `octie wire` | Insert task in chain |
| `octie merge <src> <tgt>` | Combine tasks |
| `octie find --orphans` | Find disconnected |

---

## Error Handling

| Error | Fix |
|-------|-----|
| "violates atomic task" | Split into smaller tasks |
| "twin required" | Provide both --blockers AND dependency explanation. Use `--dependencies` for create, `--dependency-explanation` for update |
| "Cycle detected" | Remove one blocker |
| "Task not found" | Use 7+ char UUID prefix |

---

## See Also

- [reference.md](reference.md) - CLI examples with multi-item patterns
- `octie --help` - Main help

---

## ⚠️ REMINDER: Tasks System Required

**CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.
