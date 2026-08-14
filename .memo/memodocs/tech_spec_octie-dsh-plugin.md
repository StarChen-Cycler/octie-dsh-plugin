# Tech Spec: octie-dsh-plugin

完整设计见 `docs/octie-dsh-plugin-refactor.md`（§8 长期架构、§9 组件定位与 API 设计、§10 Usage Skill）。

## 1. Architecture (three layers)

- **octie-core**（DSH 无关 TypeScript）: `TaskGraphStore` / `TaskNode` / `TaskStorage` + 新 service 层（`src/service/*`）。
- **octie-dsh bundle**（Cordis Node half, `octie/plugin/index.mjs`）: `OctieService`（`octie` 服务）+ 13 个 `octie_*` 模型工具 + `octie/*` 事件。
- **Consumers**: octie CLI（薄壳）、Web UI、DSH 模型与其他插件。

## 2. API surface（见设计文档 §9.4–9.7）

- Service 方法: `init` / `open` / `createTask` / `listTasks` / `getTask` / `updateTask` / `approveTask` / `findTasks` / `wireTask` / `mergeTasks` / `deleteTask` / `graph` / `validateGraph` / `listSnapshots` / `restoreSnapshot` / `createHandoff` / `onChange`。
- 工具: `octie_init` / `octie_create` / `octie_list` / `octie_get` / `octie_find` / `octie_update` / `octie_approve` / `octie_wire` / `octie_merge` / `octie_delete` / `octie_graph` / `octie_history` / `octie_handoff`。
- 事件: `octie/task-created`、`octie/task-approved`、`octie/graph-changed`。
- 不变量: 状态只读派生（`approve` 是唯一手动转移）；`blockers` 与 `dependency-explanation` 孪生；只回传 JSON 投影。

## 3. Packaging

- `octie/package.json`: `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`；`exports` 同时指向库入口与 `./cordis.patch.yml`。
- `octie/cordis.patch.yml`: `- insert: [{ id: octie-dsh, name: octie-dsh }]`。
- 安装: `dsh plugin --profile <p> add <pkg-or-git-spec>`。

## 4. Build & Test

- TypeScript（tsc）产出库入口 `dist/core/index.js` 与 CLI `dist/cli/index.js`；vitest 覆盖 service 层（statement coverage ≥ 80%）。
- 现有 CLI 行为零回归（既有测试全部通过）。

## 5. Non-goals

- `octie-core` 内不得出现 `cordis`/`ctx`/`dsh` 依赖。
- 不得在插件里重写存储/校验/状态派生。
- 不重画 Octie 自带 Web UI（可视化沿用 `octie serve`）。
