# Octie Architecture

This document describes the architecture of Octie, a graph-based task management system.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Data Structures](#data-structures)
- [Graph Algorithms](#graph-algorithms)
- [Storage Layer](#storage-layer)
- [CLI Architecture](#cli-architecture)
- [Web API Architecture](#web-api-architecture)
- [Data Flow](#data-flow)
- [Extension Points](#extension-points)

## Overview

Octie manages tasks as nodes in a directed graph, where edges represent dependencies between tasks. The system provides:

1. **CLI** - Command-line interface for task management
2. **Web API** - RESTful API for programmatic access
3. **Web UI** - React-based visualization (optional)

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
├─────────────────────┬─────────────────┬─────────────────────┤
│        CLI          │     Web API     │       Web UI        │
│   (Commander.js)    │   (Express.js)  │      (React)        │
├─────────────────────┴─────────────────┴─────────────────────┤
│                      Core Layer                              │
├────────────────┬───────────────────┬────────────────────────┤
│   TaskGraph    │    TaskStorage    │      TaskNode          │
│   (In-memory)  │   (File I/O)      │   (Data Model)         │
├────────────────┴───────────────────┴────────────────────────┤
│                   Graph Algorithms                           │
├──────────────────────────────────────────────────────────────┤
│  Topological Sort  │  Cycle Detection  │  Traversal (BFS/DFS)│
├──────────────────────────────────────────────────────────────┤
│                     Storage Layer                            │
├──────────────────────────────────────────────────────────────┤
│  Atomic Writes  │  Backup Rotation  │  Indexing             │
├──────────────────────────────────────────────────────────────┤
│                   .octie/ Directory                          │
│  project.json  │  project.json.bak  │  indexes/  │  cache/  │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### TaskNode (`src/core/models/task-node.ts`)

The fundamental unit representing a single task.

```typescript
class TaskNode {
  id: string;                    // UUID v4
  title: string;                 // 1-200 chars
  description: string;           // 50-10000 chars
  status: TaskStatus;            // not_started | pending | in_progress | completed | blocked
  priority: TaskPriority;        // top | second | later
  success_criteria: SuccessCriterion[];
  deliverables: Deliverable[];
  blockers: string[];            // Task IDs
  dependencies: string[];        // Task IDs
  edges: string[];               // Outgoing edges (task IDs)
  sub_items: string[];           // Child task IDs
  related_files: string[];       // File paths
  notes: string;
  c7_verified: C7Verification[];
  created_at: string;            // ISO 8601, immutable
  updated_at: string;            // ISO 8601, auto-updated
  completed_at: string | null;   // Auto-set when complete
}
```

**Key Features:**
- **Atomic Task Validation**: Ensures tasks are specific, measurable, and executable
- **Auto-timestamp Management**: System-managed timestamps that cannot be manually set
- **Status Transitions**: Validated state machine for status changes
- **Criterion Evidence**: Completed criteria may carry optional `evidence` text (benchmarks, test output) recorded via `octie update --complete-criterion <id> --evidence "<text>"`

### TaskGraphStore (`src/core/graph/index.ts`)

In-memory graph representation using adjacency lists.

```typescript
class TaskGraphStore {
  private nodes: Map<string, TaskNode>;           // O(1) lookup
  private outgoingEdges: Map<string, Set<string>>; // node -> nodes it points to
  private incomingEdges: Map<string, Set<string>>; // node -> nodes pointing to it
  private metadata: ProjectMetadata;
}
```

**Operations:**
| Operation | Time Complexity | Method |
|-----------|-----------------|--------|
| Get task | O(1) | `getNode(id)` |
| Add task | O(1) | `addNode(node)` |
| Remove task | O(E) | `removeNode(id)` |
| Add edge | O(1) | `addEdge(from, to)` |
| Remove edge | O(1) | `removeEdge(from, to)` |
| Get outgoing edges | O(k) | `getOutgoingEdges(id)` |
| Get incoming edges | O(k) | `getIncomingEdges(id)` |

### TaskStorage (`src/core/storage/file-store.ts`)

Handles persistence to `.octie/project.json`.

```typescript
class TaskStorage {
  async init(): Promise<void>;
  async load(): Promise<TaskGraphStore>;
  async save(graph: TaskGraphStore): Promise<void>;
  exists(): boolean;
  listBackups(): Promise<BackupInfo[]>;
  restoreFromBackup(backupPath: string): Promise<void>;
}
```

### IndexManager (`src/core/storage/indexer.ts`)

Maintains pre-computed indexes for fast retrieval.

```typescript
class IndexManager {
  private byStatus: Map<TaskStatus, Set<string>>;
  private byPriority: Map<TaskPriority, Set<string>>;
  private searchText: Map<string, Set<string>>;  // term -> task IDs
  private byFile: Map<string, Set<string>>;      // file -> task IDs
  private rootTasks: Set<string>;
  private orphanTasks: Set<string>;
}
```

## Data Structures

### Adjacency List Representation

The graph uses two adjacency lists for bidirectional traversal:

```
Tasks: A, B, C
Edges: A -> B, A -> C, B -> C

outgoingEdges:
  A -> {B, C}
  B -> {C}
  C -> {}

incomingEdges:
  A -> {}
  B -> {A}
  C -> {A, B}
```

This enables:
- **Forward traversal**: Follow `outgoingEdges` to find dependents
- **Backward traversal**: Follow `incomingEdges` to find dependencies

### Storage Format

`.octie/project.json` structure:

```json
{
  "$schema": "https://octie.dev/schemas/project-v1.json",
  "version": "1.0.0",
  "format": "octie-project",
  "metadata": {
    "project_name": "my-project",
    "version": "1.0.0",
    "created_at": "2026-02-15T12:00:00Z",
    "updated_at": "2026-02-15T14:30:00Z",
    "task_count": 150
  },
  "tasks": {
    "task-001": { /* TaskNode */ }
  },
  "edges": [
    { "from": "task-001", "to": "task-002", "type": "blocks" }
  ],
  "indexes": {
    "byStatus": { "pending": ["task-003"], ... },
    "byPriority": { "top": ["task-001"], ... },
    "rootTasks": ["task-001"],
    "orphans": []
  }
}
```

## Graph Algorithms

### Topological Sort (`src/core/graph/sort.ts`)

Uses **Kahn's Algorithm** for O(V + E) sorting:

```
1. Calculate in-degree for all nodes
2. Initialize queue with nodes having in-degree 0
3. While queue not empty:
   a. Remove node from queue, add to result
   b. Reduce in-degree of neighbors
   c. Add neighbors with in-degree 0 to queue
4. If result.length < total nodes, graph has cycle
```

**Result:**
```typescript
interface TopologicalSortResult {
  sorted: string[];      // Topologically ordered task IDs
  hasCycle: boolean;     // True if cycle detected
  cycleNodes: string[];  // Nodes involved in cycles
}
```

### Cycle Detection (`src/core/graph/cycle.ts`)

Uses **DFS with Three-Color Marking**:

```
WHITE (0) = not visited
GRAY (1)  = currently visiting (in recursion stack)
BLACK (2) = completely visited

1. Mark all nodes WHITE
2. For each WHITE node, run DFS:
   a. Mark current node GRAY
   b. For each neighbor:
      - If GRAY: cycle found! Reconstruct path
      - If WHITE: recurse
   c. Mark current node BLACK
```

**Result:**
```typescript
interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: string[][];    // All cycles found
}
```

### Graph Traversal (`src/core/graph/traversal.ts`)

**BFS (Breadth-First Search):**
- Level-by-level exploration
- Used for finding shortest paths
- Supports forward and backward direction

**DFS (Depth-First Search):**
- Deep exploration before backtracking
- Used for finding any path, detecting cycles
- Recursive with backtracking

## Storage Layer

### Atomic Write Strategy

Prevents data corruption during writes:

```
1. Write to temp file: project.json.tmp-<timestamp>
2. Verify write succeeded (non-empty)
3. Create backup of existing file
4. Atomic rename temp -> actual file
5. Rotate backups (keep last N)
```

### Backup Rotation

```
.octie/
├── project.json
├── project.json.bak        # Most recent backup
├── project.json.bak.1      # Older backups
├── project.json.bak.2
└── ...
```

Default: Keep last 5 backups.

### Index Strategy

Indexes are rebuilt on load and updated incrementally:

```
Load:
  1. Parse project.json
  2. Build in-memory graph
  3. Rebuild all indexes (O(n))

Update:
  1. Remove task from old indexes (O(1))
  2. Add task to new indexes (O(1))
  3. Update root/orphan status
```

## CLI Architecture

### Command Structure

```
octie <command> [options]

Commands:
  init        Initialize project
  create      Create new task
  list        List tasks
  get         Get task details
  update      Update task
  delete      Delete task
  merge       Merge two tasks
  export      Export project
  import      Import tasks
  graph       Graph operations
  serve       Start web server
```

### Command Implementation Pattern

```typescript
// src/cli/commands/example.ts
import { Command } from 'commander';
import { loadGraph, saveGraph, success, error } from '../utils/helpers.js';

export const exampleCommand = new Command('example')
  .description('Example command')
  .option('-p, --project <path>', 'Project path')
  .action(async (options) => {
    try {
      const graph = await loadGraph(options.project);
      // ... do work ...
      await saveGraph(graph);
      success('Operation completed');
    } catch (e) {
      error(e.message);
      process.exit(1);
    }
  });
```

### Output Formatters

Three output formats supported:

1. **Table** (default): Human-readable ASCII tables
2. **Markdown**: AI-friendly, structured MD
3. **JSON**: Machine-parseable, for scripting

```typescript
// Selection via --format flag
octie list --format json
octie get <id> --format md
```

## Web API Architecture

### Express Server (`src/web/server.ts`)

```typescript
class WebServer {
  private app: Express;
  private server: Server;

  async start(port: number): Promise<void>;
  async stop(): Promise<void>;
}
```

### RESTful Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api` | API info |
| GET | `/api/tasks` | List tasks |
| GET | `/api/tasks/:id` | Get task |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/merge` | Merge tasks |
| GET | `/api/graph` | Graph structure |
| GET | `/api/graph/topology` | Topological order |
| POST | `/api/graph/validate` | Validate graph |
| GET | `/api/graph/cycles` | Detect cycles |
| GET | `/api/graph/critical-path` | Find critical path |
| GET | `/api/stats` | Project statistics |

### Request/Response Format

```typescript
// Success response
{
  "success": true,
  "data": { /* ... */ }
}

// Error response
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task xxx not found",
    "details": { /* optional */ }
  }
}
```

## Data Flow

### Task Creation Flow

```
CLI/API
   │
   ▼
┌─────────────────┐
│ Validate Input  │ (atomic task validation)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create TaskNode │ (auto-timestamps)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Add to Graph    │ (O(1) insertion)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update Indexes  │ (O(1) per index)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Atomic Write    │ (temp file + rename)
└─────────────────┘
```

### Graph Query Flow

```
CLI/API
   │
   ▼
┌─────────────────┐
│ Load from Disk  │ (parse JSON, build graph)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Query Index     │ (O(k) for filtered queries)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Format Output   │ (table/md/json)
└─────────────────┘
```

## Extension Points

### Adding New Output Formats

1. Create formatter in `src/cli/output/`:

```typescript
// src/cli/output/yaml.ts
export function formatTaskYAML(task: TaskNode): string {
  // Implementation
}
```

2. Add to format selection in commands.

### Adding New Graph Algorithms

1. Implement in `src/core/graph/`:

```typescript
// src/core/graph/centrality.ts
export function calculateCentrality(graph: TaskGraphStore): Map<string, number> {
  // Implementation
}
```

2. Expose via CLI and API.

### Adding New API Endpoints

1. Create route handler in `src/web/routes/`:

```typescript
// src/web/routes/analytics.ts
export function registerAnalyticsRoutes(app: Express): void {
  app.get('/api/analytics', asyncHandler(async (req, res) => {
    // Implementation
  }));
}
```

2. Register in `src/web/server.ts`.

### Custom Storage Backends

Implement the storage interface:

```typescript
interface ITaskStorage {
  load(): Promise<TaskGraphStore>;
  save(graph: TaskGraphStore): Promise<void>;
  exists(): boolean;
}
```

---

*Architecture Version: 1.0.0*
*Last Updated: 2026-02-16*
