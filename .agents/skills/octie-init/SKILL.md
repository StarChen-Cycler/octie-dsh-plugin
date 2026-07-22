---
name: octie-init
description: Phase 1: Project Initialization - creates project folder, runs memo-dec, collects requirements via interview/brainstorm, verifies tech stack with C7 MCP, generates user_spec and tech_spec files, creates .Codex/rules with coding standards and UI design rules, creates AGENTS.md, initializes git. Does NOT create Octie tasks - use /octie-research for that. Use when: "start new project", "initialize project", "project setup", "create project structure".
allowed-tools: Write, Bash, Read, TaskCreate, TaskList, TaskUpdate, TaskGet, TaskDelete, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Octie Init - Project Initialization

**Phase 1**: Project Initialization - creates structure, specifications, coding rules. NO Octie tasks.

**⚠️ CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

---

## Workflow Overview

**When to use**: Starting new projects - creates specs and rules only.
**When NOT to use**:
- Use `/octie-research` to create Octie tasks after specs are ready
- Use `/octie-dev` for Phase 2 (implementation loop)

---

## Workflow Overview

```
0. Octie Check → memo-dec init → 1. Check Existing Specs → 2. Create Project Folder
 → 3. Rough Demand → 4. Interview → 5. Spec Verification → 6. Brainstorm
 → 7. C7 Verify → 8. tech_spec_<project>.md → 9. .Codex/ dir
 → 10. Generate Rules → 11. UI Rules → 12. AGENTS.md → 13. Completion → 14. Git Init
```

---

## Step-by-Step Instructions

### Step 0: Verify Octie Availability

**CRITICAL**: Run `octie -h` first to verify Octie is installed and available.

```bash
octie -h
```

**If Octie unavailable**: Abort and inform user Octie is required.

---

### Step 1: Run memo-dec init

```bash
memo-dec init --context
```

**Error handling**: Ask user - install memo-dec, continue without it, or retry.

---

### Step 1.5: Check for Existing Specs

**Action**: Check if spec files already exist in `.memo/memodocs/`:

```bash
ls .memo/memodocs/
```

**If BOTH user_spec_<project>.md AND tech_spec_<project>.md exist**:
1. Read and verify the existing specs
2. Confirm with user: "Found existing specs. Use as-is or regenerate? (y/n)"
3. If yes → Skip to Step 9 (Create .Codex dir)
4. If no → Proceed to Step 2

**If user_spec_<project>.md exists but tech_spec_<project>.md is missing**:
1. Use existing user_spec
2. Proceed to Step 6-7 (Brainstorm + C7 Verify)
3. Generate tech_spec

**If specs are missing** (new project):
1. Proceed to Step 2 (Create Project Folder)
2. Then Step 3+ to create specs via interview + brainstorm + C7

---

### Step 2: Create Project Folder

**Prompt**:
```
What is the project folder name? (lowercase-kebab-case, e.g., "todo-app")
```

**Action**:
```bash
mkdir <project-name>
cd <project-name>
```

**Rules**:
- Lowercase-kebab-case naming
- Sibling to `.memo` folder (same parent)
- Empty folder, set as working directory

**Error**: If folder exists, ask - use existing, new name, or cancel.

---

### Step 3: Collect Rough Demand

**Prompt**:
```
What would you like to build?
Direct input or file path (@/path/to/file).
```

**Input handling**:
- Starts with `@` or `/` → read file
- Otherwise → direct text input

**Error**: If file read fails, ask for direct input.

---

### Step 4: Invoke Interview Skill (Descriptive PRD)

Use `/interview` skill → descriptive PRD (features, edge cases, NO tech stack).

**Save to**: `.memo/memodocs/user_spec_<project_name>.md`

**If interview skill unavailable**: Manually create user_spec with:
- Project overview
- User stories
- Core features
- Edge cases

---

### Step 5: Simple Spec Verification

**Prompt**:
```
Spec saved to: .memo/memodocs/user_spec_<project>.md
Anything to modify? (y/n)
```

**Behavior**:
- `y` → ask modifications, apply, re-ask
- `n` → proceed to Step 6

Do NOT display full spec - path confirmation only.

---

### Step 6: Invoke Brainstorm Skill (Tech PRD)

Use `/superpower:brainstorming` skill → tech stack decisions.

**Input**: Descriptive PRD from Step 4.

**Output**: Tech stack, architecture, constraints, tooling.

**Save to**: Append `.memo/memodocs/user_spec_<project>.md`

**If brainstorm skill unavailable**: Ask user directly:
- What tech stack to use?
- Any framework preferences?
- Deployment requirements?

---

### Step 7: Verify Tech Stack with C7 MCP

**Purpose**: Verify tech stack decisions using Context7 MCP before writing tech file.

**If tech stack NOT defined by user/brainstorm**:
1. Query C7 MCP for each major requirement
2. Get best practices and recommendations
3. Present options to user for decision

**Action**: Query C7 MCP for each major technology decision from Step 6.

**Process**:
1. Extract technologies from brainstorm output OR query C7 for requirements
2. Query C7 MCP for each technology
3. Document important findings
4. Adjust tech stack if needed

**Example queries** (if tech stack unknown):
```
"/reactjs/docs": "Best practices for React 2024"
"/nodejs/docs": "Best practices for Node.js REST API"
"/postgresql/docs": "Best practices for PostgreSQL schema design"
```

**Example queries** (if tech stack known):
```
"/mongodb/docs": "Best practices for MongoDB with Node.js"
"/vercel/next.js": "Next.js 14+ app router architecture"
```

**When to skip**: C7 MCP unavailable or verified by user.

---

### Step 8: Generate tech_spec_<project>.md

**Source**: spec file after Step 5.

**Format**: Architecture, tech stack, components, data models, API design.

**Save to**: `.memo/memodocs/tech_spec_<project>.md`

**Template**: See [reference.md](reference.md)#tech-template.

---

### Step 9: Create .Codex Directory Structure

**Purpose**: Create directory for AI coding rules.

**Action** (in parent directory, sibling to .memo):
```bash
cd ..
mkdir -p .Codex/rules
```

**Location**: Sibling to `.memo` folder (same parent level)

---

### Step 10: Generate Coding Rules

**Purpose**: Auto-generate technology-specific coding standards.

**Action**: Invoke `/Codex-rules` skill with tech stack from `tech_spec_<project>.md`.

**Input**: Each major technology.

**Output**: Rules in `.Codex/rules/`:
- `<tech>-rules.md`
- `testing-rules.md`
- `coding-style.md`

---

### Step 11: Generate UI Design Rules

**Purpose**: Auto-generate UI/UX design standards.

**Action**: Invoke `frontend-design:frontend-design` skill.

**Skip if**: Project has no UI (pure backend, CLI tool, API-only).

---

### Step 12: Create AGENTS.md Configuration

**Purpose**: Configure Codex's working directory and git context.

**Action**: Create `AGENTS.md` in parent directory.

**Template**:
```markdown
# <Project Name>

**Git Root**: <parent-directory>
**Working Directory**: `<project-folder>/`

## Directory Structure

- `.Codex/` - AI coding rules
- `.memo/` - Project documentation
- `<project-folder>/` - Source code

## Development Context

Run commands from git root, code happens in `<project-folder>/`.

```bash
cd <project-folder>
```
```

---

### Step 13: Completion & Next Steps

**Display**:
```
✅ Project initialization complete!

Created:
  📄 .memo/memodocs/user_spec_<project>.md
  🔧 .memo/memodocs/tech_spec_<project>.md
  📜 .Codex/rules/<tech>-rules.md
  🎨 .Codex/rules/ui-design-rules.md
  📝 AGENTS.md

Next steps:
  🔬 Use /octie-research to create Octie tasks
  🚀 Use /octie-dev to begin Phase 2: Development Loop
```

---

### Step 14: Initialize Git Repository

**Action**:
```bash
git init
git add .
git commit -m "Initial project setup: specs, roadmap, Octie tasks, and coding rules"
```

**Error handling**:
- Git not installed → ask to install or skip
- Repo exists → skip init
- Commit fails → show error

---

## File Organization

```
parent-directory/ (git root)
├── <project-folder>/                     # Source code
├── .Codex/                             # AI coding rules
│   └── rules/
│       ├── <tech>-rules.md
│       ├── testing-rules.md
│       ├── coding-style.md
│       ├── ui-design-rules.md
│       └── accessibility_rules.md
├── .memo/                                # Project documentation & context
│   ├── memosymbols.txt
│   └── memodocs/
│       ├── user_spec_<project>.md       # Descriptive PRD
│       └── tech_spec_<project>.md       # Technical specification
└── AGENTS.md                             # Working directory config
```

---

## Next: Octie Research

**After octie-init completes**, use `/octie-research` to:
1. Initialize Octie project (`octie init`)
2. Create Octie tasks from specs
3. Validate task graph

**Flow**:
```
octie-init (specs + rules)
    ↓
octie-research (creates tasks)
    ↓
octie-dev (implementation)
```

---

## Tasks System Requirement

**Tools**: TaskCreate, TaskList, TaskUpdate, TaskGet, TaskDelete

**Pattern**: `[Verb] + [Specific Object] + [Context/Purpose]`

---

## Error Handling

| Failure | Handling |
|---------|----------|
| Octie unavailable | Abort - Octie required |
| memo-dec fails | Continue without, install, or retry |
| Folder exists | Use existing, new name, or cancel |
| Interview fails | Retry, skip, or manual PRD |
| Brainstorm fails | Retry, skip, or manual tech |
| C7 MCP fails | Skip verification, proceed |
| Git fails | Install, skip, or handle manually |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| `.memo` exists | Run `memo-dec init --context` anyway |
| Octie init already exists | Ask: merge, overwrite, or cancel |
| Invalid file path | Ask for direct input |
| Skills not installed | Ask to install or skip |

---

## Best Practices

1. **Check for existing specs** before creating new ones
2. **Interview before tech stack** - understand requirements first
3. **Use C7 MCP** to verify tech stack decisions
4. **Sibling structure** - project, .memo, .Codex at same level
5. **Two specs**: user_spec (UX/requirements) + tech_spec (technical)
6. **After init**: Use `/octie-research` to create Octie tasks

---

## ⚠️ Git Safety Caution

**CRITICAL**: This skill initializes git repositories. Always push to remote immediately after initialization.

### After Step 14 (Git Init), Push to Remote

```bash
git remote add origin <github-url>
git push -u origin main
```

**Never work with a local-only repository** - catastrophic loss is irreversible.

---

## ⚠️ REMINDER: Tasks System Required

**CRITICAL**: Use Codex Tasks System throughout. Break down EVERY step into granular, trackable sub-tasks. Include ALL checklist items in tasks, not just main task items.

---

*See [reference.md](reference.md) for detailed templates, Octie command examples, and integration patterns.*
