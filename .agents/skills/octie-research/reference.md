# Octie Research - Reference (Token-Efficient)

Quick reference for task creation and updates. Max 10 criteria, 10 deliverables per task.

---

## Multi-Item Patterns

```bash
# Repeat flags for multiple items
--success-criterion "..." --success-criterion "..."  # Max 10
--deliverable "..." --deliverable "..."              # Max 10
--notes "..." --notes "..."                          # Multiple OK

# Comma-separated
--related-files src/a.ts,src/b.ts,tests/
--blockers <id1>,<id2>
```

---

## Create Command - 2 Examples

### Ex 1: Implementation Task (Full Multi-Item)

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

### Ex 2: Task with Blockers

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

---

## Update Command - 2 Examples

> **Always run `octie get <id>` first to get correct criterion/deliverable IDs.**

### Ex 1: Adding Items

```bash
# Get current state first
octie get abc123

# Add discovered requirements
octie update abc123 --add-success-criterion "Rate limiting: 100 req/min"
octie update abc123 --add-deliverable "rate_limiter.py"
octie update abc123 --notes "Discovery: Need CORS for frontend"
octie update abc123 --add-related-file "src/middleware/rate_limiter.py"
```

### Ex 2: Marking Progress

```bash
octie get abc123  # Get IDs first

# Complete items
octie update abc123 --complete-criterion def456,ghi789
octie update abc123 --complete-criterion def456 --evidence "pytest: 42 passed, 0 failed"
octie update abc123 --complete-deliverable jkl012

# Add need fix
octie update abc123 --add-need-fix "Memory leak in handler" --need-fix-source review

# Resolve need fix
octie update abc123 --complete-need-fix stu901
```

---

## Criteria & Deliverables - Quick Reference

| Type | BAD (vague) | GOOD (quantitative/specific) |
|------|-------------|------------------------------|
| Criterion | "Works well" | "Returns 200 status" |
| Criterion | "Fast" | "Response time < 200ms" |
| Criterion | "Good coverage" | "Test coverage > 80%" |
| Deliverable | "Code" | "POST /api/auth/login handler" |
| Deliverable | "Tests" | "tests/auth.test.ts" |
| Deliverable | "Docs" | "docs/api/auth.md" |

---

## Wire Command - 1 Example

Insert task B between A and C:

```bash
# Before: abc123 → def456
# After:  abc123 → xyz789 → def456

octie wire xyz789 \
  --after abc123 \
  --before def456 \
  --dep-on-after "Needs API spec" \
  --dep-on-before "Frontend needs models"
```

---

## Graph Commands - Quick Reference

```bash
octie graph validate    # Check integrity
octie graph cycles      # Detect cycles
octie find --orphans    # Disconnected tasks
octie find --without-blockers  # Ready to start
octie merge <src> <tgt> --force  # Combine tasks
```

---

## Research Integration (MANDATORY for Existing Projects)

**Always invoke `/research` when**:
- Project has `.octie/` folder
- Adding tasks to existing project

**Query examples**:
```
"[framework] common pitfalls production"
"[library] authentication best practices"
"[database] connection pooling"
```

**After research**: Add C7 verification to tasks
```bash
octie create ... --c7-verified "/express:error-handling"
```

---

## Error Reference

| Error | Fix |
|-------|-----|
| "violates atomic task" | Split into smaller tasks |
| "twin required" | Provide both --blockers AND dependency explanation. Use `--dependencies` for create, `--dependency-explanation` for update |
| "Cycle detected" | Remove one blocker |
| "Task not found" | Use 7+ char UUID prefix |

---

## Status (Auto-Calculated)

| Status | Condition |
|--------|-----------|
| `ready` | No blockers, no work started |
| `in_progress` | Any item completed |
| `in_review` | All items complete |
| `completed` | Approved via `octie approve` |
| `blocked` | Has unresolved blockers |
