# Octie

This repository is a workspace around the `Octie` task graph tool. The actively implemented product lives in [`octie/`](./octie), while the repo root also contains design notes, workflow writeups, and supporting docs.

The previous root README had drifted away from the code. This version reflects what is actually implemented today.

## What is implemented

- A Node.js CLI for graph-based task management.
- A file-backed task graph stored under `.octie/`.
- Automatic task status calculation with a single manual approval step.
- Atomic task validation for titles, descriptions, success criteria, and deliverables.
- Directed blocker relationships with dependency explanation text as a paired field.
- Graph operations such as reconnecting, merging, wiring, cycle detection, and validation.
- Immutable snapshot history with listing, restore, and retention pruning.
- Loose subproject handoff creation under `.octie/subprojects/`.
- A web server plus React UI for browsing projects, tasks, graph data, and stats.
- A global project registry at `~/.octie/projects.json` used by the UI home page and sidebar.
- Import/export flows for JSON and Markdown.
- Unit, integration, and benchmark coverage with Vitest.

## Latest code-aligned additions and fixes

Recent commits on `main` added or tightened the following behavior:

- Canonical twin flag naming now uses `--dependency-explanation` for blocker explanations. `--dependencies` remains accepted as a hidden compatibility alias.
- Snapshot history now prunes retained snapshots instead of growing forever.
- Snapshot restore now runs through the normal save lifecycle instead of bypassing it.
- Failed snapshot-history writes and handoff rollbacks now surface cleanup failures more clearly.
- Status propagation now runs after rewiring-style graph changes so dependent task states stay consistent.
- Export now surfaces parent-directory creation failures.
- Deliverable validation is aligned to the implemented max of 10.
- Git Bash style path normalization is shared across commands that parse file or library inputs.

## Repository layout

```text
task-driver/
|-- README.md
|-- octie/                      # Actual CLI, core graph logic, server, UI, tests
|-- docs/                       # Supporting docs
|-- design/                     # Design notes
|-- CLAUDE.md
|-- LICENSE
`-- *.md                        # Root-level planning and workflow notes
```

Inside `octie/`:

```text
octie/
|-- bin/                        # CLI launcher
|-- src/
|   |-- cli/                    # Command definitions
|   |-- core/                   # Graph, storage, registry, models
|   `-- web/                    # Express server and routes
|-- web-ui/                     # React 19 + Vite UI
|-- tests/                      # Unit, integration, benchmark tests
|-- test/                       # Graph-focused legacy tests
|-- openapi.yaml
|-- ARCHITECTURE.md
`-- package.json
```

## Tech stack

- CLI/core: TypeScript, Commander, Express, Zod, UUID
- UI: React 19, Vite, Zustand, Tailwind CSS 4, React Flow / XYFlow, Dagre
- Testing: Vitest, Supertest

## Installation

### Global package

The package name in `octie/package.json` is `octie-cli`, and the executable is `octie`.

```bash
npm install -g octie-cli
```

### Local development

```bash
cd octie
npm install
npm run build
node bin/octie.js --help
```

## Quick start

### 1. Initialize a project

```bash
octie init --name my-project
```

### 2. Create a task

Use the canonical blocker/dependency pair:

```bash
octie create \
  --title "Implement login endpoint with JWT" \
  --description "Add a login endpoint that validates credentials, issues JWTs, and returns consistent error responses for invalid input." \
  --success-criterion "POST /login returns 200 for valid credentials" \
  --success-criterion "POST /login returns 401 for invalid credentials" \
  --deliverable "src/auth/login.ts" \
  --deliverable "tests/auth/login.test.ts" \
  --priority top
```

With blockers:

```bash
octie create \
  --title "Build frontend auth form" \
  --description "Create the login form UI once the backend contract is stable and the auth API is available for integration testing." \
  --success-criterion "Form submits valid credentials to the auth endpoint" \
  --deliverable "web-ui/src/components/LoginForm.tsx" \
  --blockers abc1234 \
  --dependency-explanation "Needs the auth API contract and live endpoint from abc1234"
```

### 3. Inspect and update tasks

```bash
octie list
octie get abc1234 --format md
octie find --without-blockers --priority top
octie update abc1234 --complete-criterion def5678
octie update abc1234 --add-need-fix "Handle invalid token refresh path"
octie approve abc1234
```

### 4. Start the UI

```bash
octie serve
```

Default server address:

```text
http://localhost:3000
```

The UI home page lists registered projects. A project-specific URL can also be opened with the encoded project path:

```text
http://localhost:3000/?project=<absolute-project-path>
```

## Data model and workflow

### Storage layout

Octie projects are stored inside the target working directory:

```text
.octie/
|-- project.json
|-- history/
|   |-- history.ndjson
|   `-- snapshots/
|-- subprojects/
|-- indexes/
`-- cache/
```

### Status model

Statuses are derived from task state:

- `ready`: no blockers and no work started
- `blocked`: unresolved blockers exist
- `in_progress`: work has started or `need_fix` items exist
- `in_review`: all criteria, deliverables, and `need_fix` items are complete
- `completed`: approved manually

Only one manual transition exists:

```text
in_review -> completed
```

That transition is performed with:

```bash
octie approve <task-id>
```

### Task requirements enforced by code

- `title`: required, max 200 chars, atomic-task validation applied
- `description`: required, 50-10000 chars
- `success_criteria`: required, 1-10
- `deliverables`: required, 1-10
- `need_fix`: optional, but blocks review until resolved
- `blockers` + `dependencies`: treated as a paired feature

## Active CLI surface

These commands are registered in the current CLI:

| Command | Purpose |
| --- | --- |
| `init` | Initialize a new Octie project |
| `create` | Create an atomic task |
| `list` | List tasks, including `--graph` and `--tree` views |
| `get` | Show one task in `table`, `json`, or `md` format |
| `update` | Update priority, items, blockers, notes, related files, C7 verification, and `need_fix` items |
| `approve` | Approve an `in_review` task |
| `find` | Search tasks by title, text, file, library verification, or graph shape |
| `delete` | Delete tasks with optional `--reconnect` or `--cascade` |
| `merge` | Merge two tasks into one |
| `wire` | Insert an existing task into a blocker chain |
| `graph` | Show stats, validate structure, and inspect cycles |
| `history` | List and restore immutable snapshots |
| `handoff create` | Create a loose child subproject handoff |
| `export` | Export as JSON or Markdown |
| `import` | Import JSON or Markdown, optionally merging |
| `serve` | Start the web server and UI |

Examples for the newer workflow commands:

```bash
octie history list
octie history restore <snapshot-id>

octie handoff create \
  --subproject-name robust-tests \
  --title "Create robust-tests handoff gate" \
  --description "Create a loose handoff task that points to a dedicated robust-tests child Octie project for follow-on work." \
  --success-criterion "Child project exists at the expected path" \
  --deliverable "parent handoff gate record"
```

## Web UI and API

### UI behavior that is actually present

- Multi-project home page driven by the global registry
- Sidebar project switching
- Kanban view
- Graph view with PNG and SVG export
- Task detail panel
- Project stats bar
- Theme toggle and keyboard shortcuts

### UI behavior currently not exposed

- A list-view UI exists in code, but it is commented out in `web-ui/src/App.tsx`

### Read-oriented API endpoints

The current server reliably exposes read and analysis endpoints such as:

- `GET /health`
- `GET /api`
- `GET /api/project`
- `GET /api/projects`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `GET /api/graph`
- `GET /api/graph/topology`
- `POST /api/graph/validate`
- `GET /api/graph/cycles`
- `GET /api/graph/critical-path`
- `GET /api/stats`

There are also task mutation routes in the codebase (`POST/PUT/DELETE /api/tasks...`), but the current implementation mutates loaded graph objects without writing them back through storage. In practice, the CLI is the authoritative write path today.

## Development

From `octie/`:

```bash
npm install
npm run build
npm test
```

Other useful commands:

```bash
npm run build:web
npm run test:coverage
npm run bench
npm run serve
```

Relevant docs in the package directory:

- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `TROUBLESHOOTING.md`
- `openapi.yaml`

## Current caveats

- The `batch` command source exists, but it is commented out in `src/cli/index.ts` and is not part of the active CLI.
- The React UI is currently a browse-and-inspect surface centered on Kanban and Graph views.
- The CLI is more complete than the server-side write API and should be treated as the primary workflow surface.

## License

MIT
