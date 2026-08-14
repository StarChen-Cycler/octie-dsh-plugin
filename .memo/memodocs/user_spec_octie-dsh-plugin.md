# User Spec: octie-dsh-plugin

## 1. Overview

Turn Octie（DAG 任务状态机）into a first-class DeepSeek Harness (DSH) plugin, publishable as a
bundle（`dsh plugin add`）and positioned as the **durable execution-state layer** for agents.

## 2. User Stories

- As a **DSH agent**, I can create/list/get/find/update/approve tasks through `octie_*` model tools without shelling out to a CLI.
- As a **plugin author**, I can `inject: ['octie']` and drive the same task graph programmatically.
- As a **UI/plugin author**, I can subscribe to `octie/*` events and react to graph changes without polling.
- As a **DSH user**, I can install the whole component with one `dsh plugin add` command.
- As a **maintainer**, the engine stays DSH-agnostic so CLI / Web UI / other runtimes keep working.

## 3. Core Requirements

- All work happens on a NEW worktree + branch `octie-dsh-plugin`; **zero changes pushed to the original task-driver repository** (`StarChen-Cycler/octie` must remain untouched).
- Octie's usability is evaluated and improved; findings are documented in `docs/USABILITY.md`.
- The refactored plugin is published to a NEW GitHub repository under StarChen-Cycler.
- A companion usage skill is authored per design doc §10 (mental model + invariants + pattern library + pitfalls + contribution entry).

## 4. Edge Cases

- The global octie registry (`~/.octie/projects.json`) already contains the original project — the new project name must not collide.
- A clean `npm install && npm run build` in the worktree must produce a working CLI and a consumable library entry.
- The original repo's remotes/config must remain untouched; publish must target the new repo only.
