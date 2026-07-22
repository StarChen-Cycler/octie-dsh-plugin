# Octie Init - Reference Documentation

Detailed templates and integration patterns for project initialization.

---

## Templates

### User Spec Template

**Location**: `.memo/memodocs/user_spec_<project>.md`

```markdown
# <Project Name> - User Specification

## Overview

[Brief project description from user interview]

## User Stories

| Story | Description | Priority |
|-------|-------------|----------|
| As a... | I want to... | Must have |

## Features

### Feature 1
- Description
- Acceptance criteria

### Feature 2
- Description
- Acceptance criteria

## Edge Cases

- [Edge case 1 and handling]
- [Edge case 2 and handling]

## Out of Scope

- [Features not included in MVP]
```

---

### Tech Spec Template

**Location**: `.memo/memodocs/tech_spec_<project>.md`

```markdown
# <Project Name> - Technical Specification

## Architecture Overview

[Brief architecture description]

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | React | 18.x |
| Backend | Node.js | 20.x |
| Database | PostgreSQL | 15.x |

## Component Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route pages
├── hooks/          # Custom hooks
├── utils/          # Utility functions
└── api/            # API clients
```

## Data Models

### User
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique email |
| name | String | Display name |

## API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users | List users |
| POST | /api/users | Create user |

## Dependencies

- react-router-dom
- axios
- zustand
```

---

## Integration Patterns

### Flow: octie-init → octie-research → octie-dev

```
octie-init (Phase 1)
  ├── Creates project folder
  ├── Creates user_spec_<project>.md
  ├── Creates tech_spec_<project>.md
  ├── Creates .claude/rules/
  └── Creates CLAUDE.md
        ↓
octie-research (creates Octie tasks)
  ├── Runs octie init
  ├── Creates Octie tasks from specs
  └── Validates task graph
        ↓
octie-dev (Phase 2: Implementation)
  ├── Reads Octie tasks
  ├── Implements features
  └── Updates task progress
```

### memo-dec Integration

memo-dec and Octie work together:
- **memo-dec**: Code context (symbols, folder tree, specs)
- **Octie**: Task management (tasks, progress, dependencies)

Both are required for the full workflow.

---

## Common Workflows

### New Project

```bash
# 1. Initialize project (creates specs + rules)
/octie-init

# 2. Create Octie tasks (if not already done)
/octie-research

# 3. Begin development
/octie-dev
```

### After Specs Exist

```bash
# 1. Start from existing specs
/octie-init

# 2. Create tasks
/octie-research

# 3. Implement
/octie-dev
```

---

*Last updated: 2026-02-26*
