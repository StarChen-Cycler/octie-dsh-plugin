# Octie

A graph-based task management system with CLI and web UI.

## Overview

Octie is a project-oriented task management tool that uses directed graphs to represent task dependencies. It provides both a command-line interface for power users and a web interface for visualization.

## Features

- **Graph-based task structure**: Tasks are nodes in a directed graph (DAG with optional loops)
- **Atomic task definitions**: Each task has comprehensive context including:
  - Success criteria (quantitative, measurable, up to 10)
  - Deliverables (specific outputs, up to 10)
  - Blockers and dependencies
  - Related files and notes
  - Auto-managed timestamps (created_at, updated_at, completed_at)
- **Fast retrieval**: JSON-based storage with indexing for O(1) lookups
- **Dual output formats**: Markdown (token-efficient for AI) and JSON for visualization
- **CLI + Web UI**: Command-line tool with web-based visualization
- **Graph operations**: Add, remove, reconnect edges; cut, insert, merge tasks
- **Topological sorting**: Validated task ordering with cycle detection
- **Knowledge graph support**: Can be used for mapping learning paths and research dependencies

## Installation

```bash
npm install -g octie
```

## Quick Start

```bash
# Initialize a new project
octie init

# Create a task (interactive mode recommended)
octie create --interactive

# Create with flags
octie create \
  --title "Setup database" \
  --description "Create PostgreSQL database with migrations" \
  --priority top \
  --success-criterion "Database accepts connections" \
  --success-criterion "Migrations run successfully" \
  --deliverable "src/db/schema.sql"

# List tasks
octie list --status ready --priority top

# Get task details (multiple formats)
octie get <task-id>              # Default table format
octie get <task-id> --format md   # Markdown for AI
octie get <task-id> --format json # JSON for parsing

# Update task
octie update <task-id> --complete-criterion <criterion-id>

# Delete task
octie delete <task-id> --reconnect --force

# Start web UI
octie serve
```

## Workflow by Development Phase

Octie supports two use cases: **Task Management** (tracking work items) and **Knowledge Graph** (mapping learning paths and research dependencies).

### Phase 1: Investigation & Search

Explore the existing task graph to understand structure, dependencies, and current state.

```bash
# View all tasks with dependency graph
octie list --graph

# Find tasks ready to start
octie find --without-blockers

# Validate graph integrity
octie graph validate

# Find specific tasks
octie find --title "keyword"
octie find --status in_progress

# Get task details (use md format for token efficiency)
octie get <task-id> --format md
```

> **Tip**: Use `--format md` instead of `--format json` for AI/LLM contexts - it's more token-efficient.

### Phase 2: Task Creation

Create atomic tasks with as many quantitative success criteria and deliverables as possible (max 10 each).

```bash
octie create \
  --title "<Action Verb> <Specific Object>" \
  --description "<Detailed explanation>" \
  --success-criterion "<Quantitative metric 1>" \
  --success-criterion "<Quantitative metric 2>" \
  --success-criterion "<Quantitative metric N>" \
  --deliverable "<Specific output 1>" \
  --deliverable "<Specific output N>" \
  --notes "<Rationale and context>" \
  --priority <top|second|later>
```

> **Core Principle**: Be specific and well-defined. Make each criterion **quantitative** (e.g., "Accuracy > 90%", "Response time < 100ms"). Use `--notes` field for rationale and explanations.

### Phase 3: Task Execution

Track progress by marking criteria/deliverables complete. **Always get task details first** to obtain correct IDs.

```bash
# Get task details BEFORE updating (to get criterion/deliverable IDs)
octie get <task-id> --format md

# Mark progress
octie update <task-id> --complete-criterion <criterion-id>
octie update <task-id> --complete-deliverable <deliverable-id>

# Add blockers if dependencies discovered
octie update <task-id> --blockers <blocker-id> --dependency-explanation "Reason"

# Add notes for context
octie update <task-id> --notes "Progress update or findings"
```

### Phase 4: Review & Approval

Verify completion and approve tasks.

```bash
# Check task status
octie get <task-id> --format md

# Approve when all criteria/deliverables complete
octie approve <task-id>
```

## Development

```bash
# Clone repository
git clone https://github.com/StarChen-Cycler/octie.git
cd octie

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run CLI in development mode
node bin/octie.js --help

# Start web UI server
npm run serve
```

## Project Structure

```
octie/
├── src/                      # Source files
│   ├── algorithms/           # Graph algorithms
│   ├── cli/                 # CLI interface
│   ├── commands/            # CLI commands (init, create, list, get, update, delete, merge, export, import, graph, serve, approve, find, wire)
│   ├── core/                # Core functionality
│   │   ├── graph/           # Graph data structures and algorithms
│   │   ├── models/          # Task node model
│   │   └── storage/         # File I/O and atomic writes
│   ├── formatters/          # Output formatters (Markdown, JSON, Table)
│   ├── types/               # TypeScript type definitions
│   └── web/                 # Web server
├── tests/                   # Test files
├── web-ui/                  # Web UI (React + Vite)
├── html/                    # Built web UI assets
├── dist/                    # Compiled JavaScript
├── bin/octie.js             # CLI entry point
└── package.json
```

## CLI Commands Reference

### Global Options

These options apply to all commands:

| Option | Description |
|--------|-------------|
| `-v, --version` | Display version number |
| `-p, --project <path>` | Path to Octie project directory (default: current) |
| `--format <format>` | Output format: `json`, `md`, `table` (default: `table`) |
| `--verbose` | Enable verbose output |
| `--quiet` | Suppress non-error output |
| `-h, --help` | Display help for command |

### `octie init`

Initialize a new Octie project in current or specified directory.

```bash
octie init                           # Initialize in current directory
octie init --name "my-project"       # Specify project name
```

**Options:**
| Flag | Description |
|------|-------------|
| `-n, --name <name>` | Project name (default: "my-project") |

### `octie create`

Create a new atomic task. All required fields must be provided.

```bash
# Interactive mode (recommended)
octie create --interactive

# Command-line mode (all required fields)
octie create \
  --title "Implement user authentication" \
  --description "Create JWT-based authentication system with login, logout, and token refresh endpoints" \
  --success-criterion "Login returns valid JWT on correct credentials" \
  --success-criterion "Token refresh works correctly" \
  --deliverable "src/auth/login.ts" \
  --deliverable "tests/auth/login.test.ts" \
  --priority top \
  --blockers abc123,def456 \
  --dependency-explanation "Needs API spec from abc123 and auth from def456"
```

**Required Options:**
| Flag | Description | Validation |
|------|-------------|------------|
| `--title <string>` | Task title | 1-200 chars, must contain action verb |
| `--description <string>` | Detailed description | 50-10000 chars |
| `--success-criterion <text>` | Quantitative success criterion (repeatable) | Min 1, Max 10 |
| `--deliverable <text>` | Expected output (repeatable) | Min 1, Max 10 |

> **Best Practice**: Add as many quantitative success criteria and deliverables as possible (up to 10 each). Make criteria measurable (e.g., "Accuracy > 90%", "Response time < 100ms"). Use `--notes` field for rationale and explanations - keep criteria/deliverables specific and verifiable.

**Optional Options:**
| Flag | Description |
|------|-------------|
| `-p, --priority <level>` | `top`, `second`, or `later` (default: `second`) |
| `-b, --blockers <ids>` | Comma-separated task IDs that block this task |
| `--dependency-explanation <text>` | Explanatory text WHY task depends on blockers (required with --blockers) |
| `-f, --related-files <paths>` | File paths relevant to task (comma-separated or multiple) |
| `-c, --c7-verified <library:notes>` | C7 library verification (format: library-id or library-id:notes) |
| `-n, --notes <text>` | Additional context (can be specified multiple times) |
| `--notes-file <path>` | Read notes from file (multi-line support) |
| `-i, --interactive` | Use interactive prompts |

**Atomic Task Policy:**
Tasks MUST be atomic - small, specific, executable, and verifiable:
- Single purpose: Does ONE thing well
- Executable: Can be completed in 2-8 hours (typical) or 1-2 days (max)
- Verifiable: Has quantitative success criteria
- Independent: Minimizes dependencies

**Blockers & Dependencies (Twin Feature):**
- `--blockers`: Creates GRAPH EDGES affecting execution order. Task A blocks Task B → A must complete before B starts.
- `--dependency-explanation`: Explanatory text WHY this task depends on its blockers. REQUIRED when --blockers is set (twin validation).

### `octie approve`

Approve a task in review (`in_review` → `completed`). This is the ONLY manual status transition.

```bash
octie approve <task-id>
octie approve abc12345 --project /path/to/project
```

**Options:**
| Flag | Description |
|------|-------------|
| `-p, --project <path>` | Project directory path |

**Status System:**
- Manual transition (this command): `in_review` → `completed`
- All other transitions happen automatically:
  - `ready` → `in_progress`: When any criterion/deliverable is checked
  - `in_progress` → `in_review`: When all items are complete
  - `any` → `blocked`: When a blocker is added
  - `blocked` → `in_progress`/`ready`: When all blockers completed (depends on item state)

**Prerequisites for Approval:**
- Task must be in `in_review` status
- All success criteria must be complete
- All deliverables must be complete
- All need_fix items must be resolved

### `octie list`

List all tasks with optional filtering.

```bash
octie list                           # List all tasks
octie list --status in_progress       # Filter by status
octie list --priority top            # Filter by priority
octie list --tree                    # Show as tree view
octie list --graph                   # Show graph structure
octie list --format json             # JSON output
octie list --format md               # Markdown output (token-efficient for AI)
```

> **Tip**: Use `--format md` for AI/LLM contexts - it's more token-efficient than JSON.

**Options:**
| Flag | Description |
|------|-------------|
| `-s, --status <status>` | Filter by: `ready`, `in_progress`, `in_review`, `completed`, `blocked` |
| `-p, --priority <level>` | Filter by: `top`, `second`, `later` |
| `--graph` | Show graph structure |
| `--tree` | Show tree view |

**Status Values:**
| Status | Description |
|--------|-------------|
| `ready` | Task has no blockers and no work started |
| `in_progress` | Work has begun (items checked or need_fix added) |
| `in_review` | All items complete, awaiting approval |
| `completed` | Task approved (use `octie approve`) |
| `blocked` | Task has unresolved blockers |

### `octie get`

Get detailed information about a specific task.

```bash
octie get <task-id>                  # Table format (default)
octie get <task-id> --format md      # Markdown format (token-efficient for AI)
octie get <task-id> --format json    # JSON format
```

> **Important**: Always use `octie get` to retrieve task details and obtain correct criterion/deliverable IDs before updating.

**Task ID Format:**
- Full UUID: `12345678-1234-1234-1234-123456789012`
- Short UUID: First 7-8 characters (e.g., `abc12345`)

### `octie update`

Update an existing task. Status is AUTOMATICALLY calculated from task state.

> **Important**: Before updating/completing any items, always use `octie get <task-id> --format md` first to retrieve the task details and obtain the correct criterion/deliverable IDs.

```bash
octie update <task-id> --priority top
octie update <task-id> --complete-criterion <criterion-id>
octie update <task-id> --complete-deliverable <deliverable-id>
octie update <task-id> --add-need-fix "Bug found" --need-fix-source review
octie update <task-id> --blockers xyz --dependency-explanation "Needs xyz output"
```

**Options:**
| Flag | Description |
|------|-------------|
| `--priority <level>` | Set priority: `top`, `second`, `later` |
| `--add-deliverable <text>` | Add a new deliverable |
| `--complete-deliverable <id>` | Mark deliverable(s) complete (supports: `id`, `id1,id2`, `"id1","id2"`) |
| `--remove-deliverable <id>` | Remove deliverable by ID (cannot remove completed items) |
| `--add-success-criterion <text>` | Add a new success criterion |
| `--complete-criterion <id>` | Mark criterion(s) complete (supports: `id`, `id1,id2`, `"id1","id2"`) |
| `--remove-criterion <id>` | Remove criterion by ID (cannot remove completed items) |
| `--blockers <ids>` | Add blocker(s) (requires --dependency-explanation) |
| `--unblock <id>` | Remove blocker (removes graph edge) |
| `--dependency-explanation <text>` | Set/update dependencies explanation (required with --blockers) |
| `--clear-dependencies` | Clear dependencies explanation (when removing last blocker) |
| `--add-related-file <path>` | Add a related file path |
| `--remove-related-file <path>` | Remove a related file path |
| `--verify-c7 <library:notes>` | Add C7 library verification |
| `--remove-c7-verified <library>` | Remove C7 verification by library ID |
| `--add-need-fix <text>` | Add blocking issue found during work |
| `--need-fix-source <source>` | Source of need_fix: `review`, `runtime`, `regression` |
| `--need-fix-file <path>` | Optional file path for need_fix item |
| `--complete-need-fix <id>` | Mark need_fix item as resolved |
| `--notes <text>` | Append to notes (can be specified multiple times) |
| `--notes-file <path>` | Read notes from file and append |

**Need Fix Items (Blocking Issues):**
- `--add-need-fix <text>`: Add a blocking issue (status auto-changes to in_progress)
- Sources: `review` (code review), `runtime` (testing), `regression` (after completion)
- `--complete-need-fix <id>`: Mark issue as resolved (supports short UUID)

**Blockers & Dependencies (Twin Feature):**
- `--blockers <ids>`: Add blocker(s) (creates graph edge). REQUIRES --dependency-explanation.
- `--unblock <id>`: Remove blocker (removes graph edge). Auto-clears dependencies if last one.
- `--dependency-explanation <text>`: Set/update dependencies explanation.

**Short UUID Support:**
All ID parameters support short UUIDs (first 7-8 characters).

### `octie find`

Search and filter tasks with advanced options.

```bash
octie find --title "auth"                      # Find tasks with "auth" in title
octie find --search "JWT token"                # Full-text search
octie find --has-file "auth.ts"                # Find tasks referencing auth.ts
octie find --verified "/express"               # Find tasks verified against Express
octie find --without-blockers                   # Find tasks ready to start
octie find --orphans                            # Find disconnected tasks
octie find --leaves --status ready              # Find ready end tasks
octie find --title "API" --priority top         # Combine filters
```

**Options:**
| Flag | Description |
|------|-------------|
| `-t, --title <pattern>` | Search task titles (case-insensitive substring) |
| `-s, --search <text>` | Full-text search in description, notes, criteria, deliverables |
| `-f, --has-file <path>` | Find tasks referencing a specific file |
| `-v, --verified <library>` | Find tasks with C7 verification from specific library |
| `--without-blockers` | Show tasks with no blockers (ready to start) |
| `--orphans` | Show tasks with no relationships (no edges) |
| `--leaves` | Show tasks with no outgoing edges (end tasks) |
| `--status <status>` | Filter by status |
| `-p, --priority <priority>` | Filter by priority |

### `octie delete`

Delete a task with optional edge reconnection.

```bash
octie delete <task-id>               # Interactive deletion
octie delete <task-id> --force       # Skip confirmation
octie delete <task-id> --reconnect   # Reconnect edges (A→B→C becomes A→C)
octie delete <task-id> --cascade     # Delete all dependent tasks
```

**Options:**
| Flag | Description |
|------|-------------|
| `--reconnect` | Reconnect incoming to outgoing edges after deletion (A→B→C → A→C) |
| `--cascade` | Delete all tasks that depend on this task |
| `--force` | Skip confirmation prompt |

**Deletion Modes:**
- Default: Removes task and its edges; dependents have this task removed from blockers
- `--reconnect`: Splice into chain (A→B→C becomes A→C)
- `--cascade`: Delete this task AND all tasks that depend on it

### `octie merge`

Merge two tasks into one.

```bash
octie merge <source-id> <target-id>  # Merge source into target
```

**Merge Behavior:**
- Source task is DELETED after merge
- Target receives: all success criteria, deliverables, notes, related files (appended)
- Blockers are transferred from source to target
- Cannot undo - backup is created automatically

### `octie export`

Export project data to file.

```bash
octie export                         # Export to stdout (JSON)
octie export -o backup.json
octie export --type md -o tasks.md   # Token-efficient for AI contexts
```

> **Tip**: Export as `--type md` for better token efficiency in LLM/agent contexts.

**Options:**
| Flag | Description |
|------|-------------|
| `-t, --type <format>` | Export format: `json`, `md` (default: `json`) |
| `-o, --output <path>` | Output file path |

### `octie import`

Import tasks from file.

```bash
octie import backup.json             # Import from JSON file
octie import tasks.md --merge       # Import from Markdown and merge
```

**Options:**
| Flag | Description |
|------|-------------|
| `--format <format>` | Input format: `json`, `md` (auto-detected from extension) |
| `--merge` | Merge with existing tasks instead of replacing |

### `octie graph`

Graph analysis and validation commands.

```bash
octie graph validate                 # Check graph integrity (cycles, orphan references)
octie graph cycles                   # Detect and display cycles
```

**Subcommands:**
| Command | Description |
|---------|-------------|
| `validate` | Check graph integrity (cycles, orphan references) |
| `cycles` | Detect and display all cycles in graph |

### `octie serve`

Start web UI server for task visualization.

```bash
octie serve                          # Default: localhost:3000
octie serve -p 8080                  # Custom port
octie serve --host 0.0.0.0           # Listen on all interfaces
octie serve --open                    # Open browser automatically
```

**Options:**
| Flag | Description |
|------|-------------|
| `-p, --port <number>` | Server port (default: 3000) |
| `-h, --host <host>` | Host address (default: localhost) |
| `--open` | Open browser automatically |
| `--no-cors` | Disable CORS headers |
| `--no-logging` | Disable request logging |

### `octie wire`

Insert an existing task between two connected tasks on a blocker chain.

```bash
# Wire task B between A and C
octie wire xyz789 \
  --after abc123 \
  --before def456 \
  --dep-on-after "Needs API spec to create models" \
  --dep-on-before "Frontend needs TypeScript models"
```

**Visual Example:**
```
Before: A → C (A blocks C)
After:  A → B → C (A blocks B, B blocks C)
```

**Workflow:**
1. Create intermediate task first (using `octie create`)
2. Wire it into chain using `octie wire`

**Required Options:**
| Flag | Description |
|------|-------------|
| `--after <id>` | Source task ID - will become inserted task's blocker |
| `--before <id>` | Target task ID - will block on inserted task instead |
| `--dep-on-after <text>` | Why inserted task depends on --after task (twin validation) |
| `--dep-on-before <text>` | Why --before task depends on inserted task |

## Knowledge Graph Patterns

Octie can be used as a knowledge graph tool for mapping learning paths, research dependencies, and concept relationships.

### Pattern: Learning Path with Branches

```bash
# Root task (no blockers)
octie create --title "Start Deep Learning" ...

# Branch 1: CNN Path
octie create --title "Learn CNN" --blockers <root-id> ...
octie create --title "CNN Implementation" --blockers <cnn-id> ...

# Branch 2: RNN Path
octie create --title "Learn RNN" --blockers <root-id> ...
octie create --title "RNN Implementation" --blockers <rnn-id> ...

# Branch 3: Transformer Path
octie create --title "Learn Transformers" --blockers <root-id> ...
octie create --title "Transformer Implementation" --blockers <transformer-id> ...

# Convergence: Comparison task
octie create --title "Compare Architectures" \
  --blockers <cnn-id> \
  --dependency-explanation "Need CNN understanding" \
  --blockers <rnn-id> \
  --dependency-explanation "Need RNN understanding" \
  --blockers <transformer-id> \
  --dependency-explanation "Need Transformer understanding"
```

### Pattern: Prerequisite Chain

```bash
octie create --title "Foundation A" ...
octie create --title "Foundation B" --blockers <a-id> ...
octie create --title "Foundation C" --blockers <b-id> ...
octie create --title "Advanced Topic" --blockers <c-id> ...
```

### Pattern: Parallel Research

```bash
# Start multiple research paths in parallel
octie create --title "Research Topic A" --blockers <root-id> ...
octie create --title "Research Topic B" --blockers <root-id> ...
octie create --title "Research Topic C" --blockers <root-id> ...

# Synthesize findings
octie create --title "Synthesis Report" \
  --blockers <topic-a-id>,<topic-b-id>,<topic-c-id> \
  --dependency-explanation "Need all research completed"
```

### Best Practices for Knowledge Graphs

1. **Phase Notes**: Add annotations like "Phase 1: Foundations" to clarify learning stages
2. **Rationale Notes**: Explain why certain paths converge or diverge
3. **Parallel Flows**: Independent concepts can be explored in parallel from a common parent
4. **Convergence Points**: Use multiple blockers to require all paths to complete

## Web API Reference

When the server is running, the following REST API endpoints are available.

> **Full API documentation**: See [openapi.yaml](./openapi.yaml) for the complete OpenAPI 3.0 specification.

### Task Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks (supports `?status=`, `?priority=`, `?search=`) |
| `GET` | `/api/tasks/:id` | Get task by ID |
| `POST` | `/api/tasks` | Create new task |
| `PUT` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task (supports `?reconnect=true`) |
| `POST` | `/api/tasks/:id/merge` | Merge tasks (body: `{ "targetId": "uuid" }`) |

### Graph Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph` | Get full graph structure |
| `GET` | `/api/graph/topology` | Get topological order |
| `POST` | `/api/graph/validate` | Validate graph structure |
| `GET` | `/api/graph/cycles` | Detect cycles |
| `GET` | `/api/graph/critical-path` | Get critical path |
| `GET` | `/api/stats` | Get project statistics |

### Health Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api` | API info |
| `GET` | `/api/project` | Project metadata |

## Data Format

Tasks are stored in `.octie/project.json` with the following structure:

```json
{
  "version": "1.0.0",
  "format": "octie-project",
  "metadata": {
    "project_name": "my-project",
    "version": "1.0.0",
    "created_at": "2026-02-16T12:00:00Z",
    "updated_at": "2026-02-16T14:30:00Z",
    "task_count": 5
  },
  "tasks": {
    "task-id": {
      "id": "uuid",
      "title": "Task title",
      "description": "Detailed description",
      "status": "ready|in_progress|in_review|completed|blocked",
      "priority": "top|second|later",
      "success_criteria": [...],
      "deliverables": [...],
      "blockers": [],
      "dependencies": "",
      "edges": [],
      "related_files": [],
      "notes": "",
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601",
      "completed_at": "ISO-8601|null"
    }
  },
  "edges": [
    {"from": "task-id-1", "to": "task-id-2", "type": "blocks"}
  ],
  "indexes": {
    "byStatus": {...},
    "byPriority": {...},
    "rootTasks": [...],
    "orphans": []
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run tests/create.test.ts

# Run with coverage
npm run test:coverage

# Run benchmarks
npm run bench

# Run tests with UI
npm run test:ui
```

**Test Coverage**:
- Unit tests: 388 passed (8 skipped for unimplemented features)
- Integration tests: Full CLI workflow, concurrent access, file corruption recovery
- Web API tests: 48 comprehensive endpoint tests
- Performance benchmarks: All operations under target thresholds

## Project Status

**Current Version**: 1.0.0

**Completed Features**:
- ✅ Core data structures (TaskNode, TaskGraphStore with O(1) lookup)
- ✅ Storage layer with atomic writes and backup rotation
- ✅ Graph algorithms (topological sort, cycle detection, traversal, operations)
- ✅ CLI commands (init, create, list, get, update, delete, merge, export, import, graph, serve, approve, find, wire)
- ✅ Output formatters (Markdown, JSON, Table)
- ✅ Web API server with RESTful endpoints (Express.js)
- ✅ Web UI (React + ReactFlow + Zustand + Tailwind CSS)
- ✅ Unit tests (388 passing)
- ✅ Integration tests (CLI workflow, concurrent access, recovery)
- ✅ Web API tests (48 comprehensive tests)
- ✅ Performance benchmarks (all under target thresholds)

**Future Enhancements** (post-v1.0.0):
- 📋 Real-time collaboration (WebSocket)
- 📋 Task templates
- 📋 Advanced filtering and search
- 📋 Export to other formats (PDF, CSV)

## License

MIT
