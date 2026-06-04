# Octie Project

**Git Root**: `I:\ai-automation-projects\task-driver` (current directory)
**Working Directory**: `octie/`

## Directory Structure

```
task-driver/              # Git root
├── .Codex/             # AI coding rules
├── .memo/               # Project documentation
│   └── memodocs/
│       ├── spec_octie.md
│       ├── tech_octie.md
│       ├── dev-stages.md
│       └── proj-progress-checklist.md
├── octie/               # Source code location
│   ├── src/             # Main source files
│   ├── cli.js           # CLI entry point
│   ├── server.js        # Web UI server
│   └── package.json
└── AGENTS.md            # This file
```

## Development Context

Run commands from git root (`task-driver/`), code happens in `octie/`.

```bash
cd octie
# ... work on code ...
```

## Project Overview

**Octie** is a graph-based task management system with:
- CLI tool for task management
- Web UI for visualization
- Directed graph structure (DAG with optional loops)
- JSON file-based storage
- Dual output formats (MD for AI, JSON for visualization)

## Key Commands

```bash
# From git root
cd octie

# Install dependencies
npm install

# Run CLI
node cli.js --help

# Start web UI
npm run serve

# Run tests
npm test
```
