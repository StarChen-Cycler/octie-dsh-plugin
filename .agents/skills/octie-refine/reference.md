# Octie Refine - Reference Documentation

Detailed command patterns, examples, and error handling for task graph refinement.

---

## Core Principles: Dependency Logic & Task Atomicity

### Task Atomicity Standards

**Atomic Task** = Single, focused objective with:
- **One clear purpose**: Not multiple unrelated goals
- **Verifiable completion**: Clear yes/no success criteria
- **Concrete deliverables**: Tangible outputs (files, APIs, docs)
- **No "and" in title**: Indicates multiple objectives that should be separate

**Atomicity Checklist**:
- [ ] **Single Objective**: One feature, component, or integration
- [ ] **Clear Boundaries**: Obvious where task starts and ends
- [ ] **Verifiable**: Concrete deliverable, not abstract
- [ ] **Focused Scope**: Can explain in one sentence without "and"

**Non-Atomic Examples** (split these):
- "Implement login and signup" → Split into two tasks
- "Design and build API" → Split into design task + build task
- "Fix all bugs" → One task per bug or related bug group

### Task Consistency Standards

**⚠️ CRITICAL**: Related tasks MUST maintain consistency across naming, structure, and patterns.

**Consistency Dimensions**:

| Dimension | Inconsistent (Bad) | Consistent (Good) |
|-----------|-------------------|-------------------|
| **Naming** | `step2_style_analysis.py` vs `step2_style/` | `step2_style.py` ↔ `step2_style/` |
| **Folder depth** | `validation/step1/`, `step2/` | `validation/step1/`, `validation/step2/` |
| **Path pattern** | `src/user/`, `modules/auth/` | `src/modules/user/`, `src/modules/auth/` |
| **Convention** | `getUser`, `get_user`, `get-user` | All use `get_user` |

**Real Example - Naming Inconsistency**:
```
Found in project:
  validation/step2_style/         (folder)
  validation_chain/step2_style_analysis.py  (module)

Problem: "style" vs "style_analysis" mismatch

Resolution: Rename module to step2_style.py to match folder
```

**Consistency Checklist**:
- [ ] All related tasks use same naming convention
- [ ] Folder depths match across parallel tasks
- [ ] Module names align with folder names
- [ ] No mixed conventions (snake_case vs camelCase)
- [ ] Deliverable paths follow same pattern

**During refinement**: If inconsistency found, use `octie update` to fix deliverables before proceeding.

### Horizontal Decomposition (Parallel)

Tasks at the **same dependency level** with **no blockers between them**.

**Requirements for horizontal tasks**:
- Independent objectives (can work in parallel)
- No deliverable dependencies between them
- Similar scope (comparable deliverable count)

**Example** (Horizontal - Valid):
```
Level 2: [Login UI] ←→ [Signup UI] ←→ [Password Reset UI]
```
All can run parallel, same scope, no dependencies between them.

### Vertical Decomposition (Sequential)

Tasks where output of Task N is required input for Task N+1.

**Requirements for vertical dependencies**:
- Concrete deliverable dependency (file, API, data structure)
- No workaround possible (cannot stub/mock)
- Explicitly documented in `--dependency-explanation`

**Example** (Vertical - Valid):
```
[Design DB Schema] → [Implement API] → [Build Frontend]
```
Each needs the concrete output from the previous.

### Blocker Rationale Checklist

**BEFORE adding a blocker, verify ALL THREE:**

1. **Deliverable Required**: The blocked task needs a specific file/API/data structure
   - ❌ "Needs coordination"
   - ✅ "Needs `auth_middleware.py` from blocker"

2. **Unavoidable**: No workaround exists
   - ❌ Can stub/mock the dependency
   - ❌ Can work in parallel with interfaces
   - ✅ Cannot proceed without the actual deliverable

3. **Documented**: `--dependency-explanation` explains WHY
   - ❌ `--dependency-explanation "Depends on Task A"`
   - ✅ `--dependency-explanation "Needs JWT middleware (task-a) for route protection"`

### Priority vs Scope

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `--priority` | Urgency (when to start) | `top` = start first, not necessarily largest scope |
| Task content | Scope (what to do) | Focus and deliverables, independent of priority |

**⚠️ NEVER** use priority to indicate complexity. They are orthogonal.

---

## Wire Command Patterns

### Pattern 1: Insert Task in Chain

Insert a task between two existing tasks.

```bash
# Scenario: Insert task C between A and B
# Before: A (abc123) → B (def456)
# After:  A → C → B

octie wire <C-id> \
  --after abc123 \
  --before def456 \
  --dep-on-after "C needs output from A" \
  --dep-on-before "B needs output from C"
```

### Pattern 2: Move Task Earlier

Move a task earlier in the dependency chain.

```bash
# Scenario: Move task D to before B
# Before: A → B → C → D
# After:  A → D → B → C

octie wire <D-id> \
  --after <A-id> \
  --before <B-id> \
  --dep-on-after "D can start after A completes" \
  --dep-on-before "B depends on D's output"
```

### Pattern 3: Move Task Later

Move a task later in the dependency chain.

```bash
# Scenario: Move task B to after C
# Before: A → B → C → D
# After:  A → C → B → D

octie wire <B-id> \
  --after <C-id> \
  --before <D-id> \
  --dep-on-after "B needs C's data models" \
  --dep-on-before "D requires B's API endpoints"
```

---

## Merge Command Patterns

### Pattern 1: Merge Related Implementation Tasks

```bash
# Scenario: Two small UI tasks should be one
# Task A: "Create login button component" (1 deliverable: Button.tsx)
# Task B: "Create login form layout" (1 deliverable: Form.tsx)
# Both are related UI components, too small individually

# Verify first
octie get <A-id>
octie get <B-id>

# Merge A into B (A deleted, B kept with combined scope)
octie merge <A-id> <B-id> --force

# Update B's description and deliverables to reflect combined scope
octie update <B-id> \
  --title "Implement login form with button" \
  --description "Combined: Create login form layout and button component" \
  --deliverable "src/components/LoginForm.tsx" \
  --deliverable "src/components/LoginButton.tsx"
```

### Pattern 2: Merge Setup Tasks

```bash
# Scenario: Multiple small setup tasks
# Task A: "Initialize npm project" (1 deliverable: package.json)
# Task B: "Install eslint config" (1 deliverable: .eslintrc)
# Task C: "Setup prettier" (1 deliverable: .prettierrc)
# All related setup, too small individually

# Merge A and B into C
octie merge <A-id> <C-id> --force
octie merge <B-id> <C-id> --force

# Result: C now covers all setup with 3 deliverables
```

**⚠️ Merge Warnings**:
- Cannot undo merge operation
- Source task is permanently deleted
- Target task inherits all blockers/dependencies
- Run `octie get` on both tasks before merging

---

## Update Command Patterns

### Pattern 1: Add Blockers to Existing Task

```bash
# Get current state
octie get <task-id>

# Add blockers (MUST include --dependency-explanation)
octie update <task-id> \
  --blockers <blocker1-id>,<blocker2-id> \
  --dependency-explanation "Needs auth middleware and user model from blockers"
```

### Pattern 2: Remove Blockers

```bash
# Remove a specific blocker
octie update <task-id> --unblock <blocker-id>

# NOTE: When removing last blocker, dependencies auto-clear.
# Do NOT use --dependency-explanation with --unblock.
```

### Pattern 3: Change Priority

```bash
# Escalate to top priority
octie update <task-id> --priority top

# De-prioritize
octie update <task-id> --priority later
```

### Pattern 4: Update After Research Discovery

```bash
# Add discovered requirements
octie update <task-id> \
  --add-success-criterion "Rate limiting: 100 req/min" \
  --add-deliverable "src/middleware/rate_limiter.py" \
  --notes "Discovery: Need rate limiting per security review"
```

---

## Graph Validation Patterns (FINAL STEP)

**⚠️ Run ALL validation commands AFTER completing refinement operations.**

### Pattern 1: Final Validation

```bash
# Run these commands together at the END
octie graph validate
octie graph cycles
octie find --orphans
octie list --graph
octie find --without-blockers
```

### Pattern 2: Fix Cycle (if detected)

```bash
# Identify weakest link (which dependency makes least sense)
octie get abc123
octie get def456
octie get ghi789

# Remove the blocker that creates the cycle
octie update ghi789 --unblock abc123

# Or restructure with wire
octie wire <new-task> --after abc123 --before def456 ...
```

### Pattern 3: Fix Orphans (if detected)

```bash
# Get orphan details
octie get xyz789

# Get orphan details
octie get xyz789

# Wire to appropriate location
octie wire xyz789 \
  --after <appropriate-predecessor> \
  --before <appropriate-successor> \
  --dep-on-after "Context from predecessor" \
  --dep-on-before "Successor needs this"
```

---

## Task Atomicity Scenarios

### Scenario A: Sub-Atomic Tasks (Merge Required)

**Problem**:
- Task X: "Create button component" (too small, incomplete)
- Task Y: "Add button styles" (dependent on X, also small)
- Both are partial work, not independently meaningful

**Resolution** (Merge into atomic task):
```bash
# Check both tasks
octie get <X-id>
octie get <Y-id>

# Merge X into Y
octie merge <X-id> <Y-id> --force

# Update Y to be atomic (single deliverable)
octie update <Y-id> \
  --title "Implement styled button component" \
  --description "Create button component with full styling. Complete, atomic unit of work." \
  --success-criterion "Button renders correctly" \
  --success-criterion "Styles match design spec" \
  --deliverable "src/components/Button.tsx" \
  --deliverable "src/components/Button.css"
```

**Result**: Single atomic task with complete, verifiable deliverable

---

### Scenario B: Multi-Objective Task (Split Required)

**Problem**:
- Task Z: "Implement entire auth system including login, signup, password reset, email verification, and OAuth"
- Too many objectives, violates atomicity
- Title contains "and", indicates multiple tasks

**Resolution** (Wire to restructure into atomic tasks):
```bash
# Original: Z (non-atomic, 5 objectives)
# Split into atomic tasks:
# - Z1: "Implement login with JWT"
# - Z2: "Implement signup flow"
# - Z3: "Implement password reset"

# Wire dependencies:
octie wire <Z2-id> \
  --after <Z1-id> \
  --before <Z3-id> \
  --dep-on-after "Needs JWT patterns from Z1" \
  --dep-on-before "Z3 needs user model from Z2"
```

**Result**: Three atomic tasks, each with single objective

---

### Scenario C: Atomicity Imbalance (Fix Parallel Tasks)

**Problem**:
```
Level 2:
├── Task A: "Setup ESLint config file" ← Sub-atomic (trivial)
└── Task B: "Implement REST API with 10 endpoints" ← Complex
```

**Resolution** (Find merge partner for A to make atomic):
```bash
# Look for other setup/config tasks
octie list --graph | grep -i "setup\|config\|init"

# If Task C: "Setup Prettier config" exists:
octie merge <A-id> <C-id> --force

# Update C to be atomic:
octie update <C-id> \
  --title "Configure code quality tooling" \
  --description "Setup ESLint and Prettier with shared config and npm scripts"
```

**Result**: Task C is now atomic - complete setup with multiple related configs

---

### Scenario D: Horizontal vs Vertical Decision

**Context**: Authentication feature

**Option 1 - Horizontal** (Parallel, no blockers):
```
[Login UI] ←→ [Signup UI] ←→ [Reset Password UI]
└────────────────────────────────────────────────┘
All use shared auth hook, can develop in parallel
```

**Option 2 - Vertical** (Sequential, with blockers):
```
[Auth Hook] → [Login UI]
                → [Signup UI: 4h]
                → [Reset UI: 3h]
```

**Decision Criteria**:
- If UI components can use stub/mock hook → Horizontal (Option 1)
- If UI needs actual hook implementation → Vertical (Option 2)

---

### Scenario E: Invalid Blocker Removal

**Problem**:
```
[API Design: 3h] → [Frontend Dev: 5h]
```
But frontend can use mock API while design is in progress.

**Resolution** (Remove blocker, make parallel):
```bash
# Remove incorrect blocker (dependencies auto-clear if last blocker)
octie update <frontend-id> --unblock <api-design-id>

# Now parallel (same level, no dependencies):
[API Design: 3h] ←→ [Frontend Dev: 5h]
```

**Result**: Faster delivery through parallel work

---

## Common Refinement Scenarios

### Scenario 1: Split Oversized Task

```bash
# Original task is 16 hours (too large)
octie get <large-task-id>

# Create smaller tasks (don't modify this skill - use octie-research for new tasks)
# Then wire them in sequence
octie wire <part2-id> --after <part1-id> ...
octie wire <part3-id> --after <part2-id> ...

# Update original to be part 1, or merge and restructure
```

### Scenario 2: Reorder for Better Flow

```bash
# Current: API → Tests → Docs (bad - tests need docs context)
# Desired: API → Docs → Tests

octie wire <tests-id> \
  --after <docs-id> \
  --before "" \
  --dep-on-after "Tests need API docs for test cases"
```

### Scenario 3: Parallelize Sequential Tasks

```bash
# Current: A → B → C (all sequential, but B and C could be parallel)
# Desired: A → B, A → C (B and C parallel after A)

# Remove B as blocker from C
octie update <C-id> --unblock <B-id>
```

---

## Error Reference

| Error | Cause | Resolution |
|-------|-------|------------|
| "Cycle detected" | Circular dependency chain | Use `--unblock` to remove one blocker |
| "twin required" | Missing `--dependency-explanation` | Add `--dependency-explanation` with `--blockers` |
| "Edge doesn't exist" | Wire on unconnected tasks | Wire only works on existing A→C edges |
| "Task not found" | ID too short or wrong | Use 7+ characters from UUID, verify with `octie list` |
| "violates atomic" | Merged task too large | Split before merging, or use wire to restructure instead |
| "invalid dependency" | Self-reference or duplicate | Check blocker IDs don't include task itself |
| "orphaned task" | No connections after restructure | Use `octie wire` to connect to graph |

---

## Integration with Other Octie Skills

### From octie-research (Phase 1)

- Receives: Initial task graph with user_spec and tech_spec
- Action: Refine structure, fix issues, optimize flow
- Outputs: Validated, well-structured task graph

### To octie-dev (Phase 3)

- Provides: Clean dependency graph ready for implementation
- Handoff criteria: No cycles, no orphans, clear priorities

---

## Command Quick Reference

```bash
# Analysis (Phase B)
octie list --format md          # View task details
octie list --graph              # View structure
octie find --without-blockers   # Ready to start

# Refinement (Phase C)
octie wire <id> --after <a> --before <b> --dep-on-after "..." --dep-on-before "..."  # Insert/reorder
octie merge <src> <tgt> --force              # Combine tasks
octie update <id> --blockers <id> --dependency-explanation "..."   # Add one blocker (repeat per blocker)
octie update <id> --unblock <id>             # Remove blocker (auto-clears deps if last)
octie update <id> --priority <top|second|later>  # Change priority

# Validation (Phase D - FINAL STEP)
octie graph validate            # Check integrity
octie graph cycles              # Detect cycles
octie find --orphans            # Disconnected tasks

# Information
octie get <id>                  # Task details
octie --help                    # Full help
```

---

*Generated for octie-refine skill. Decoupled from octie-research for focused graph manipulation.*
