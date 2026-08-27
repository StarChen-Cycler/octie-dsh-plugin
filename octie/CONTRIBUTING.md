# Contributing to Octie

Thank you for your interest in contributing to Octie! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Adding New Commands](#adding-new-commands)
- [Documentation](#documentation)

## Code of Conduct

Be respectful and inclusive. We welcome contributions from everyone.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/StarChen-Cycler/octie.git
cd octie

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

### Verify Setup

```bash
# Run TypeScript type checking
npm run typecheck

# Run linting
npm run lint

# Run all tests
npm test

# Run CLI
node dist/cli/index.js --help
```

## Project Structure

```
octie/
├── src/
│   ├── cli/                    # CLI interface
│   │   ├── commands/           # CLI commands
│   │   │   ├── init.ts         # octie init
│   │   │   ├── create.ts       # octie create
│   │   │   ├── list.ts         # octie list
│   │   │   ├── get.ts          # octie get
│   │   │   ├── update.ts       # octie update
│   │   │   ├── delete.ts       # octie delete
│   │   │   ├── merge.ts        # octie merge
│   │   │   ├── export.ts       # octie export
│   │   │   ├── import.ts       # octie import
│   │   │   ├── graph.ts        # octie graph
│   │   │   └── serve.ts        # octie serve
│   │   ├── output/             # Output formatters
│   │   │   ├── json.ts
│   │   │   ├── markdown.ts
│   │   │   └── table.ts
│   │   ├── utils/              # CLI utilities
│   │   └── index.ts            # CLI entry point
│   ├── core/                   # Core functionality
│   │   ├── graph/              # Graph algorithms
│   │   │   ├── index.ts        # TaskGraphStore
│   │   │   ├── cycle.ts        # Cycle detection
│   │   │   ├── sort.ts         # Topological sort
│   │   │   ├── traversal.ts    # BFS/DFS traversal
│   │   │   └── operations.ts   # Graph operations
│   │   ├── models/             # Data models
│   │   │   └── task-node.ts    # TaskNode class
│   │   └── storage/            # Storage layer
│   │       ├── file-store.ts   # TaskStorage
│   │       ├── indexer.ts      # IndexManager
│   │       └── atomic-write.ts # AtomicFileWriter
│   ├── types/                  # TypeScript types
│   │   └── index.ts
│   └── web/                    # Web server
│       ├── server.ts           # Express server
│       ├── routes/
│       │   ├── tasks.ts        # Task API routes
│       │   └── graph.ts        # Graph API routes
│       └── middleware/
├── web-ui/                     # React web UI
├── test/                       # Tests
│   └── graph/                  # Graph algorithm tests
├── tests/
│   ├── benchmark/              # Performance benchmarks
│   ├── integration/            # Integration tests
│   └── unit/                   # Unit tests
├── dist/                       # Compiled output (gitignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write code following the [Code Style](#code-style) guidelines
- Add/update tests for your changes
- Update documentation if needed

### 3. Run Checks

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code
npm run format

# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run tests with coverage
npm run test:coverage
```

### 4. Commit Changes

Follow the [Commit Messages](#commit-messages) guidelines.

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### TypeScript

- Use ES2022 features (top-level await, private fields, etc.)
- Use ESM imports/exports (`import { x } from './y.js'`)
- Prefer `interface` over `type` for object shapes
- Use `const` for variables that don't change
- Use meaningful variable names

### File Naming

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### Import Order

```typescript
// 1. Node.js built-ins
import fs from 'node:fs';
import path from 'node:path';

// 2. External packages
import chalk from 'chalk';
import { Command } from 'commander';

// 3. Local imports (use .js extension for ESM)
import { TaskGraphStore } from './graph/index.js';
import type { TaskNode } from './types/index.js';
```

### Error Handling

- Throw custom error classes from `src/types/index.ts`
- Provide actionable error messages
- Use `try/catch` for async operations
- Never silently catch errors without handling

```typescript
// Good
if (!task) {
  throw new TaskNotFoundError(taskId);
}

// Bad
try {
  await doSomething();
} catch (e) {
  // Silent failure - don't do this
}
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `style`: Code style changes (formatting, etc.)

### Scopes

Common scopes:
- `cli`: CLI commands
- `graph`: Graph algorithms
- `storage`: File storage
- `api`: Web API
- `web`: Web UI

### Examples

```bash
feat(cli): add --json flag to list command
fix(graph): handle self-loops in cycle detection
test(storage): add concurrent access tests
docs(readme): update installation instructions
chore(deps): update dependencies
```

## Pull Request Process

1. **Update Documentation**: If your change affects behavior, update README.md or relevant docs

2. **Add Tests**: All new features and bug fixes should have tests

3. **Run All Checks**: Ensure typecheck, lint, and tests pass

4. **PR Description**: Include:
   - What changes were made
   - Why they were made
   - How to test them
   - Any breaking changes

5. **Link Issues**: Reference any related issues

```markdown
Closes #123
```

6. **Wait for Review**: A maintainer will review your PR

## Testing

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/unit/core/models/task-node.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage
```

### Test Guidelines

- Use Vitest's `describe`, `it`, `expect` syntax
- One test file per source file
- Test file location mirrors source location
- Test edge cases and error conditions
- Use descriptive test names

```typescript
describe('TaskNode', () => {
  describe('setStatus', () => {
    it('should throw error for invalid transition', () => {
      const task = new TaskNode({ /* ... */ });
      task.setStatus('completed');
      expect(() => task.setStatus('not_started')).toThrow(ValidationError);
    });
  });
});
```

### Benchmarks

```bash
# Run all benchmarks
npm run bench

# Run specific benchmark
npm run bench -- tests/benchmark/graph-operations.bench.ts

# UI mode
npm run bench:ui
```

## Adding New Commands

1. Create a new file in `src/cli/commands/`:

```typescript
// src/cli/commands/mycommand.ts
import { Command } from 'commander';

export const myCommand = new Command('mycommand')
  .description('Description of my command')
  .option('-f, --flag <value>', 'Flag description')
  .action(async (options) => {
    // Implementation
  });
```

2. Register in `src/cli/index.ts`:

```typescript
import { myCommand } from './commands/mycommand.js';
// ...
program.addCommand(myCommand);
```

3. Add tests in `tests/unit/cli/commands/mycommand.test.ts`

4. Update README.md with command documentation

## Documentation

### Code Comments

- Use JSDoc for public APIs:

```typescript
/**
 * Detects all cycles in the graph using DFS with coloring.
 * @param graph - The task graph to analyze
 * @returns Object containing cycle information
 */
export function detectCycle(graph: TaskGraphStore): CycleDetectionResult {
  // ...
}
```

### README Updates

When adding features, update:
- Features list
- CLI command reference
- Examples if applicable

### API Documentation

The OpenAPI spec is in `openapi.yaml`. Update it when adding/modifying API endpoints.

---

Thank you for contributing to Octie!
