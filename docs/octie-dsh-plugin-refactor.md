# Octie → DSH 插件化改造方案

> 本文是 Octie（`I:\ai-automation-projects\task-driver`）专属的独立设计文档：
> 讨论如何把本项目的任务图能力“炼化”成 DeepSeek Harness（DSH）可安装插件。
> 通用插件制作方法（三种形态、编码规则、动态插件工作流等）见技能
> `dsh-plugin-authoring`，本文只保留与 Octie 直接相关的结论，不重复通用内容。

## 1. 背景与目标

**目标**：让 DSH agent 能高效调用 Octie 来**创建新任务**和**维护任务图**（找活、接线、更新、审批、环检测），并把 Octie 固化为一个**可直接 `dsh plugin add` 安装**的插件。

**调研结论**（详见第 2、3 节）：Octie 的能力最佳存在形式是 **DSH bundle 插件**——因为 bundle 的 Node half 是完整 Node 模块、**可以 `import`**，能直接把 Octie 的核心库变成一等 API；而动态插件和预设都不能 `import`，只能 shell 调 CLI。

## 2. Octie 项目现状

`octie-cli@1.1.0`（已全局安装）是一个 **DAG 任务状态机**，三层层级：

- **CLI**（`src/cli/`，Commander，15+ 命令）—— 权威操作面。
- **核心库**（`src/core/`：`TaskGraphStore` / `TaskNode` / `TaskStorage` + 图算法）—— 纯图/存储/模型。
- **Web UI**（`web-ui/`，Kanban + 图视图）+ 只读 REST API（`src/web/`）。

### 2.1 状态模型（派生 + BFS 传播）

```
ready → in_progress → in_review → completed
  ↑         ↓             ↓
  └── blocked ←───────────┘
```

状态由任务状态**派生**，唯一手动转移是 `approve`（`in_review → completed`）；`blockers` 边沿依赖图 **BFS 自动传播**。

### 2.2 原子校验（创建时强制）

| 字段 | 规则 |
|---|---|
| `title` | 必填，≤200 字，须含动作动词 |
| `description` | 必填，50–10000 字 |
| `success_criteria` | 1–10 条，须**定量** |
| `deliverables` | 1–10 条，须具体路径/产物 |
| `priority` | `top` / `second`(默认) / `later` |
| `blockers` + `dependency-explanation` | 孪生特性，二者必须成对 |

### 2.3 存储与权威写路径

- 存储：`.octie/project.json`（原子写 + 备份轮换 + SHA-256 快照 + 索引重建），全局注册表 `~/.octie/projects.json`。
- **权威写路径是 CLI**：Web API 的 mutation 路由只改内存不落盘（README 明确）。
- 可调用性实测：`node dist/cli/index.js --version` → `1.1.0`；`list --format json` 返回干净 JSON 数组；`create` 输出人类文本（任务 UUID 嵌入 stdout）。

## 3. DSH 插件形态与选型

| 形态 | 能否 `import` | 安装/激活 | 生命周期 | 适合 |
|---|---|---|---|---|
| **Bundle 插件**（社区标准） | ✅ 完整 Node ESM | `dsh plugin add <spec>` | 随 profile 持久 | **分发 / 长期复用 / 需 import 库** |
| Agent 预设 | ❌ | 开对应会话 | 每会话挂载 | 单一 agent 工具/人格 |
| 动态 Cordis 插件 | ❌ 禁 import | `cordis_run` | 进程内重启即丢 | 临时验证 |

**选型结论：Bundle 插件。** 关键差异在于 bundle 能 `import`（`node:*`、npm 依赖、`process.env` 均可用），因此能直接 `import { createTask, … } from 'octie-cli'`，无子进程、无文本解析、类型安全。

Bundle 契约（来自 `deepseek-ai/deepseek-harness` + 社区 `vlln/whale-girl` 实测）：

- 仓库根 `package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web" } }`，`main`/`exports` 指向 Node half（`index.mjs`）与 client half（`client.js`）。
- `cordis.patch.yml` 用 `- insert: [{ id, name }]` 把插件行插进 composition。
- Node half 是完整 Cordis 插件：`export const name` / `export const inject = [...]` / `export function apply(ctx)`。

## 4. 炼化的四个阻碍

1. **库入口没构建**：`octie/package.json` 写 `"main": "dist/core/index.js"`，但 `dist/core/index.js` 实测不存在（只有 `dist/cli/index.js`）→ `import` 库会失败。
2. **业务逻辑耦合在 CLI 层**：create/update/approve 等操作逻辑在 `src/cli/commands/`（`shared-helpers.ts` 只抽了 `init`/`create` 的 preflight/execute），`src/core/` 只有纯图/存储/模型 → 缺可复用的 service 层。
3. **权威写路径在 CLI**：bundle 要么 import service 层，要么 shell 调 CLI。
4. **缺 `dsh.bundle` + `cordis.patch.yml`**：装了也不会被当插件挂载。

## 5. 改造方案（三档，推荐 B）

### 档 A · 零改动 wrapper（今天就能上）
bundle 的 Node half `inject: ['shell']`，每个工具 shell 调 `node dist/cli/index.js <cmd> --format json`，解析 stdout。
- 优点：不动 Octie 源码、立即可用、零漂移。
- 缺点：每命令一个子进程 + 文本解析；受限于 CLI 已暴露面。

### 档 B · 提炼 service 层 + import（推荐）
1. 抽 `src/service/`：`initProject` / `createTask` / `listTasks` / `getTask` / `updateTask` / `approveTask` / `findTasks` / `wireTasks` / `mergeTasks` / `deleteTasks` / `graphStats`。CLI 变成它的薄壳。
2. 修 `dist/core` 构建，让 `src/index.ts`（或新 `src/service/index.ts`）导出这些函数，`main`/`exports` 真能解析。
3. 加 `dsh.bundle` + `cordis.patch.yml` + Node half：`import { createTask, … } from 'octie-cli'`，`inject: ['tools']`，`apply` 里注册 `octie_create`/`octie_list`/`octie_get`/`octie_find`/`octie_graph`/`octie_update`/`octie_approve` 等细粒度工具。
4. `npm publish` 后 `dsh plugin --profile <p> add octie-cli` 安装验证。
- 优点：无子进程、类型安全、任务图操作变成一等 API；CLI / Web UI 原样保留。

### 档 C · 做成 Cordis Service（最重）
Octie 提供 `taskDriver` 服务（`class TaskDriverService extends Service`）供其他插件 `inject: ['taskDriver']` 共享同一图。
- 仅在“多插件要共享/扩展 Octie 图”时值得；首发不建议。

> 关键洞察：bundle 能 `import`，档 B 让 Octie 核心库直接成为一等 API——这正是“炼化为可直接作为插件使用”的本质。可视化交给 Octie 自带的 `octie serve`，不必在 DSH 里重画。

## 6. 档 B 落地步骤（文件级）

1. **抽 service 层**：把 `octie/src/cli/commands/shared-helpers.ts` 的 `preflightTaskCreation` / `executeTaskCreation` / `preflightProjectInit` / `executeProjectInit` 等迁到 `octie/src/service/`，并补齐 update/approve/find/wire/merge/delete/graph 的纯函数版本（复用 `octie/src/core/` 的 `TaskGraphStore`/`TaskStorage` + `cli/utils/helpers.ts` 的 `loadGraph`/`saveGraph`）。
2. **导出库入口**：改 `octie/src/index.ts`（或新 `src/service/index.ts`）导出 service 函数；确保 `npm run build`（`tsc`）产出 `dist/core/index.js`，`octie/package.json` 的 `main`/`types`/`exports` 指向真实产物。
3. **加 bundle 清单**：`octie/package.json` 加 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 与 `"exports": { ".": "./dist/core/index.js", "./cordis.patch.yml": "./cordis.patch.yml" }`。
4. **写 `cordis.patch.yml`**：`- insert: [{ id: octie-driver, name: octie-driver }]`。
5. **写 Node half**（`octie/plugin/index.mjs`）：`import { createTask, listTasks, … } from '../dist/core/index.js'`，`export const name='octie-driver'`，`export const inject=['tools']`，`export function apply(ctx)` 里 `ctx.tools.register(...)` 注册工具；工具参数含 `project`（默认当前工作区，映射到 CLI 的 `--project`/`getProjectPath`）。
6. **发布 + 安装**：`npm publish` 后 `dsh plugin --profile <p> add octie-cli`，验证 `octie_create`/`octie_list`/`octie_find`/`octie_graph` 可被模型调用并形成“创建 → 找活 → 接线 → 审批”闭环。

## 7. 附：关键接口/命令参考（已实测）

- CLI 入口：`node <repo>\octie\dist\cli\index.js`（全局 `octie` 解析为 `.ps1` shim；bundle 内建议直连 JS 入口）。
- 全局选项：`--project <path>`、`--format json|md|table`。
- 命令面：`init` `create` `list`（`--graph`/`--tree`/`--summary`）`get` `update` `approve` `find` `delete` `merge` `wire` `graph` `history` `handoff` `export` `import` `serve` `config`。
- 读命令用 `--format json` 拿结构化数据；`create` 从 stdout 正则 `Task created:\s+([0-9a-f-]{36})` 取任务 id 供后续串联。
- 项目路径解析：`getProjectPath` 从 cwd 向上探测 `.octie`，或显式 `--project`；子项目用父目录（含 `.octie/`）。

## 8. 长期架构与最高扩展性（战略建议）

> 从长期看，最高扩展性的集成不是“把 Octie 做成一个工具集”，而是“拆成三层，
> 其中面向 DSH 的适配层同时提供 Cordis Service + 模型工具”。

### 8.1 结论

架构上做三层分解（DSH 无关的核心库 → 薄 Cordis 适配层 → CLI/Web 消费层），适配层
**同时「提供一个 Service（供其他插件组合）」和「注册工具（供模型调用）」**，打包用
标准 bundle 形态分发。

### 8.2 扩展性四轴对照

| 轴 | 只注册工具 | Service + 工具（推荐） |
|---|---|---|
| 谁能消费 | 只有模型 | 模型 + 任何其他插件（`inject:['octie']`） |
| 跨运行时复用 | 逻辑耦合在插件里，DSH 专用 | 核心库零 DSH 耦合，CLI/Web/Codex/headless 通用 |
| 与其他插件组合 | ❌ 无注入面 | ✅ 选任务/侧栏进度/子代理派发都能 inject 同一服务 |
| 可替换性（存储/校验/状态派生） | 内联难替换 | 接口化，可换后端 |

### 8.3 目标架构（三层）

```text
octie-core（纯 TS，零 DSH 依赖）
  TaskNode / TaskGraphStore / TaskStorage(接口) / 图算法 / 原子校验 / 状态派生
  + service 函数：createTask · listTasks · updateTask · approveTask · wire …
        │ import（bundle 能 import）
octie-dsh  bundle（薄 Cordis 适配层，index.mjs）
  class OctieService extends Service  → 提供 `octie` 服务（CRUD + graph/validate + 事件/订阅）
  + 注册模型工具 octie_create / list / find / approve / wire …
  + 可选：webServer 只读路由 + client Slot UI（看板/图）
        │ 消费
octie CLI / Web UI  —— 变成 core 的薄壳
```

### 8.4 关键设计决策

1. **核心库与 DSH 零耦合**：`octie-core` 不得出现 `cordis`/`ctx`/`dsh`。把
   `src/cli/commands/` 里的业务逻辑（`shared-helpers.ts` 的 preflight/execute）下沉到
   service 层；CLI、Web UI、任何 agent 运行时都吃同一份 core。
2. **适配层提供 Service，而非只注册工具**：工具只服务模型这一个消费者；`octie` Service
   是组合点，让“挑下一个任务”“进度条”“子代理按图派发”等插件都能注入。
3. **暴露反应式变更面**：Service 提供订阅/事件（如 `octie/task-created`、`octie/task-completed`
   或 `onChange` 回调），UI 与其他插件**无需轮询**即可响应状态变化。
4. **存储/校验/状态派生接口化**：把 `TaskStorage` 抽象成 `ITaskStorage`，未来可无痛换
   后端（文件 → SQLite → 远程），这是长期扩展性的底气。

### 8.5 打包与生态

- 标准 **bundle 形态**：仓库根 `package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，
  `cordis.patch.yml` 用 `insert` 挂载 `octie-dsh` 行。
- **单包多入口**起步：`exports["./core"]` → 无关核心、`exports["."]` → Cordis Node half、
  `bin` → CLI。分层靠导出面划清；需独立版本节奏时再拆 `octie-core` / `octie-dsh`。
- 打 `dsh-plugin` 主题、进 `dsh-external/hub` / `dsh-market`，让 `dsh plugin add octie-dsh` 与市场搜索可命中。

### 8.6 反模式（会封死扩展性）

1. 业务逻辑写进 Cordis 插件体（`index.mjs` 里堆实现）→ 引擎被锁死在 DSH。
2. 只注册工具、不提供服务 → 只有模型能用，其他插件无法组合。
3. 在插件里重写存储/校验/状态派生 → 与 CLI 双源漂移、破坏原子性。
4. 让 core 依赖 Cordis/DSH → 失去跨运行时能力。

### 8.7 落地节奏

- **阶段 1（炼化）**：抽 `octie-core`，CLI 改薄壳，补 `dist/core` 构建与类型导出（唯一真正要改 Octie 源码的一步）。
- **阶段 2（适配）**：`octie-dsh` bundle：`OctieService` 服务 + 注册工具 + 可选只读路由。
- **阶段 3（扩展）**：按需加 client 看板面板、事件订阅、其他插件作为 `octie` 服务消费者。

## 9. 组件定位与 API 设计

### 9.1 一句话定位

Octie 在 DSH 中的角色是 **「持久化任务图状态机组件」**——为 agent 提供跨会话的、带依赖结构、
可校验、可恢复的执行状态层。它既不是“写作工具”，也不是又一个 TODO 列表，而是 DSH 目前缺失的
**durable execution-state layer（持久化执行状态层）**。

### 9.2 与 DSH 原生能力的边界（互补，不替代）

| 关注点 | DSH 原生能力 | Octie（本组件） |
|---|---|---|
| 单轮内临时清单 | `todo_write` | 不做 |
| 单一同会话目标 | `goals` | 不做 |
| 扇出派发 | `workflow` / `subagents` | 互补：任务可触发子代理 |
| 后台作业 | `jobs` | 互补：任务进度可映射到 job |
| 计划模式 | `planMode` | 互补：plan 产物可落到任务图 |
| **跨会话任务图** | ❌ | ✅ `octie` |
| **派生状态 + 原子校验** | ❌ | ✅ |
| **DAG 依赖 BFS 传播** | ❌ | ✅ |
| **不可变快照 / 恢复** | ❌ | ✅ |

**分工原则**：Octie 只做“任务图状态机”；代码智能交给 CodeGraph、文档检索交给 C7、
人格/规则交给 spec/rules、派发交给 subagents。各司其职，互不越界。

### 9.3 组件形态（bundle 内三样）

一个 `octie-dsh` bundle 同时提供：

1. **`octie` Cordis Service**（`class OctieService extends Service`）—— 供其他插件注入组合。
2. **`octie_*` 模型工具** —— 供 agent 直接调用（薄壳，转调同一 Service）。
3. **`octie/*` 事件** —— 供 UI / 其他插件反应式订阅。

三者共享同一个 `octie-core` 引擎（DSH 无关的纯 TS 库），保证 CLI / Web / DSH 三端状态一致。

### 9.4 `OctieService` 接口面

```ts
class OctieService extends Service {
  // 项目
  init(name: string, opts?: { path?: string }): Promise<ProjectHandle>
  open(path?: string): Promise<ProjectHandle>   // 自动探测或显式路径

  // 任务查询（返回 JSON 投影，非 live 对象）
  listTasks(filter?: ListFilter): Promise<TaskSummary[]>
  getTask(id: string): Promise<Task | null>     // 支持完整 UUID 或 7–8 位前缀
  findTasks(filter?: FindFilter): Promise<TaskSummary[]>

  // 任务变更（原子校验 + 派生状态）
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(id: string, patch: UpdateTaskPatch): Promise<Task>
  approveTask(id: string): Promise<Task>        // 唯一手动状态转移 in_review → completed

  // 图操作
  wireTask(id: string, opts: WireOpts): Promise<GraphResult>
  mergeTasks(source: string, target: string): Promise<GraphResult>
  deleteTask(id: string, mode?: 'reconnect' | 'cascade' | 'orphan'): Promise<GraphResult>

  // 图分析
  graph(): Promise<GraphStats>                  // 统计 + 根/孤 + 关键路径 + 拓扑
  validateGraph(): Promise<GraphValidation>     // 环检测 + 结构完整性

  // 快照
  listSnapshots(): Promise<SnapshotSummary[]>
  restoreSnapshot(id: string): Promise<GraphResult>

  // 子项目交接
  createHandoff(input: HandoffInput): Promise<Task>

  // 反应式订阅（返回 disposer）
  onChange(listener: (change: ChangeEvent) => void): () => void
}
```

**核心不变量**（沿用 Octie 现有语义）：
- 状态**只读派生**，唯一手动转移是 `approve`；永不暴露 `setStatus`。
- `blockers` 与 `dependencyExplanation` 孪生必填。
- 所有写操作经原子写 + 备份 + 快照，落盘前先校验。

### 9.5 模型工具面（`octie_*`）

工具是 Service 的薄壳，参数即 Service 入参，返回 JSON（`render` 输出 markdown 摘要给界面看）。

| 工具 | 用途 | 关键参数 |
|---|---|---|
| `octie_init` | 初始化项目 | `name`, `path?` |
| `octie_create` | 原子创建任务 | `title`, `description`, `successCriteria[]`, `deliverables[]`, `priority?`, `blockers[]?`, `dependencyExplanation?`, `relatedFiles[]?`, `notes?` |
| `octie_list` | 列任务 | `status?`, `priority?`, `project?` |
| `octie_get` | 单任务详情 | `id` |
| `octie_find` | 找活/搜任务 | `withoutBlockers?`, `orphans?`, `text?`, `file?`, `priority?` |
| `octie_update` | 维护进度 | `id`, `completeCriteria[]?`, `completeDeliverables[]?`, `completeNeedFix[]?`, `addNeedFix[]?`, `notes?`, `priority?` |
| `octie_approve` | 审批完成 | `id` |
| `octie_wire` | 插入依赖链 | `id`, `after?`, `before?`, `depOnAfter?`, `depOnBefore?` |
| `octie_merge` | 合并任务 | `source`, `target` |
| `octie_delete` | 删除/重连 | `id`, `mode?` |
| `octie_graph` | 图健康 | `validate?`, `cycles?`, `criticalPath?` |
| `octie_history` | 快照 | `list?` / `restore?` + `snapshotId?` |
| `octie_handoff` | 子项目交接 | `subprojectName`, `title`, `description`, `successCriteria[]`, `deliverables[]` |

### 9.6 数据形状（JSON 投影，仅叶子字段）

```ts
interface TaskSummary {
  id: string
  title: string
  status: 'ready' | 'in_progress' | 'in_review' | 'completed' | 'blocked'
  priority: 'top' | 'second' | 'later'
  blockers: string[]
}

interface Task extends TaskSummary {
  description: string
  successCriteria: Criterion[]   // { id, text, completed, completedAt?, evidence? }
  deliverables: Deliverable[]    // { id, text, completed }
  needFix: NeedFix[]             // { id, text, source: 'review'|'runtime'|'regression', file?, completed }
  relatedFiles: string[]
  notes: string
  dependencies: string
  createdAt: string; updatedAt: string; completedAt: string | null
}

interface GraphStats {
  taskCount: number
  byStatus: Record<TaskStatus, number>
  byPriority: Record<TaskPriority, number>
  roots: string[]; orphans: string[]
  cycles: string[][]; criticalPath: string[]; topologicalOrder: string[]
}
```

### 9.7 反应式事件面

粗粒度：`ctx.octie.onChange(cb)` —— 任意变更触发，回调携带最小变更描述。
细粒度（Cordis 事件，供 `ctx.on` 订阅）：

- `octie/task-created` `{ task: TaskSummary }`
- `octie/task-approved` `{ taskId, taskTitle }`
- `octie/graph-changed` `{ reason: 'wire' | 'merge' | 'delete' | 'restore' }`

订阅者拿的是**投影后的叶子字段**，绝不传 live `TaskNode`/graph 对象。

### 9.8 三种消费模式

1. **模型**：直接调 `octie_*` 工具（agent 工作循环的主入口）。
2. **其他插件**：`inject: ['octie']` → `ctx.octie.listTasks()` / `ctx.octie.approveTask()` 组合。
3. **响应式 UI**：`ctx.on('octie/graph-changed', …)` 或 `ctx.octie.onChange(…)` 免轮询刷新看板/进度条。

### 9.9 与现有 octie-* skills 的关系

`octie-init` / `octie-research` / `octie-dev` / `octie-fix` 从“Bash 调 `octie` CLI”改为
“调 `octie_*` 工具 / `inject:['octie']`”，消除每个 skill 里重复的
`octie -h → list → get → update → approve` 样板；而 interview / C7 / CodeGraph / spec 编排仍留在 skill 里。

### 9.10 CLI → Service/工具 迁移映射

| 现有 CLI | Service 方法 | 模型工具 |
|---|---|---|
| `octie init` | `init()` | `octie_init` |
| `octie create` | `createTask()` | `octie_create` |
| `octie list` | `listTasks()` | `octie_list` |
| `octie get` | `getTask()` | `octie_get` |
| `octie find` | `findTasks()` | `octie_find` |
| `octie update` | `updateTask()` | `octie_update` |
| `octie approve` | `approveTask()` | `octie_approve` |
| `octie wire` | `wireTask()` | `octie_wire` |
| `octie merge` | `mergeTasks()` | `octie_merge` |
| `octie delete` | `deleteTask()` | `octie_delete` |
| `octie graph` | `graph()` / `validateGraph()` | `octie_graph` |
| `octie history` | `listSnapshots()` / `restoreSnapshot()` | `octie_history` |
| `octie handoff create` | `createHandoff()` | `octie_handoff` |

### 9.11 设计原则

1. **返回 JSON 投影，不泄漏 live 对象**：Service/工具只回传叶子字段拼出的最小 owned JSON。
2. **引擎 DSH 无关**：`octie-core` 零 `cordis`/`ctx` 依赖，CLI/Web/DSH 三端同源。
3. **可替换后端**：存储（`ITaskStorage`）/校验/状态派生保持接口化，未来可换文件→SQLite→远程。
4. **副作用可撤销**：Service 的一切订阅/事件/路由都挂当前 Fiber，stop/卸载自动拆除。
5. **状态只读派生**：永不暴露手动 setStatus，唯一转移是 `approve`，保住 DAG 语义不被破坏。

## 10. 配套 Usage Skill 的设计

### 10.1 判断：仍需维护，但只需「一个」usage skill

组件（Service + 工具）装好后，模型直接看到的是 `octie_*` 工具的 schema（名称/参数/返回），
但 Octie 的价值几乎全在**「怎么正确用这些按钮」**——工具 schema 承载不了：

- 状态是派生的，唯一手动转移是 `approve`（不能 setStatus）；
- `blockers` 与 `dependency-explanation` 孪生必填；
- 原子任务怎么写（动词 / 定量 criteria / 2–8h 范围）；
- 找活循环（in_progress 优先 → ready 按 top>second>later → in_review 全过则 approve）；
- 陷阱（`--unblock` 破坏 DAG、短 id 用 7–8 位前缀、ready ≠ without-blockers）；
- need_fix 三来源反馈环。

结论：**保留一个低层 usage skill**，与 `dsh-plugin-authoring`（造插件的 authoring skill）分开；
4 个 phase skill（`octie-init`/`octie-research`/`octie-dev`/`octie-fix`）降级为「编排层」，
把「如何用好 octie」委托给该 usage skill。

### 10.2 核心原则：通用指导，而非硬性规则

工具是**中性的**，用法是**多样的**。「CodeGraph + C7 + Interview Specs」只是**其中一种**用法，
不应被写成唯一答案。因此 usage skill 必须**分层**，把「工具本身的性质」与「某工作流的经验」分开：

| 层 | 性质 | 是否必须掌握 | 呈现方式 |
|---|---|---|---|
| 不变式 / 契约 | 工具的性质（违反 = 破坏状态） | ✅ 必掌握 | 规则 + 「违反的后果」 |
| 用法模式库 | 经验的样本（众多之一） | ❌ 可选参考 | 配方 + 「适用场景 / 取舍」+ 显式标注「这只是其中一种」 |
| 陷阱 / 反模式 | 派生的「为什么不要」 | ✅ 应知道 | 反例 + 「为什么」 |
| 心智模型 | 一句话的本质理解 | ✅ 必掌握 | 图 = 节点 + 边，状态派生 |

**试金石**（判断一条经验该放哪层）：**「换个工作流，这条还成立吗？」**
- 成立 → 不变式（工具性质，如「状态派生」）。
- 不成立 → 模式（某工作流经验，如「用 CodeGraph 做代码智能」）。

### 10.3 建议的 SKILL.md 结构

```text
octie/ （usage skill，单一目录）
└── SKILL.md
    ├── Part 0  心智模型：一句话说清「任务图状态机」（节点=任务，边=blocker，状态派生）
    ├── Part 1  不变式与契约（必掌握）：派生状态/approve 门、孪生必填、原子任务写法、
    │           短 id 前缀、图操作语义（wire/merge/delete 的图后果）
    ├── Part 2  用法模式库（可选、多样、非约束）：
    │           · 模式 A「代码智能工作流」= CodeGraph + C7 + Interview Specs
    │           · 模式 B「极简清单」= 仅 octie 本体
    │           · 模式 C「任务→子代理扇出」= octie + subagents
    │           · …（每个标注「当需要 X 时可选；欢迎自创」）
    ├── Part 3  陷阱与反模式（避免，而非禁止）：
    │           · 手动改状态 / --unblock · 建模糊任务 · 混淆 ready 与 without-blockers
    │           · 过度/不足分解 · 把快照当 VCS
    └── Part 4  如何沉淀新用法：按「不变式 / 模式 / 陷阱」三栏归类贡献，试金石过滤
```

### 10.4 陷阱要包含，但写成「为什么不要」而非「禁止」

陷阱是必要的（它直接映射不变式），但每条都要带**后果**，让 agent 自己判断而非盲从：

- ❌ 命令式：「不要用 `--unblock`」（只给禁令）
- ✅ 后果式：「`--unblock` 绕过依赖校验，会让下游在前提未满足时启动，破坏 DAG 语义——用 `approve` 代替」

### 10.5 如何让新用法持续沉淀

1. **贡献入口**：任何新经验，先过 10.2 的试金石，归入「不变式 / 模式 / 陷阱」其中一栏。
2. **模式带元数据**：每个 pattern 写「适用场景 + 依赖的其它组件 + 取舍」，而非「正确流程」。
3. **不变式极简**：不变式只收「工具性质」，不收任何「某工作流偏好」——这是防止 usage skill
   腐化回「4 个 phase skill 各说各话」的关键。

## 11. 交付后的增量（2026-08 维护期）

> 本节记录 §1–§10 设计定稿之后、维护期合入的能力与机制；§1–§10 保持设计时的原貌。

| 增量 | 内容 | 落点 |
|---|---|---|
| 客户端任务面板 | 列表 + 分层 DAG 图视图（barycenter 交叉最小化 + 力导向微调 + 拖拽回稳） | `client.js`（`exports["./client"]`），经 `sidebar.footer.action` / `shell.overlay` / `sidebar.workspaces` 槽注册 |
| 项目活跃度排序 | 信号 = `.octie/project.json` mtime（最近任务更新时间）；面板下拉、`/api/projects`、侧边栏子树排名统一使用 | `getProjectLastUpdated`（core/registry）、`buildProjectTree`（core/utils）、web 路由 |
| 实时同步 | 会话内工具变更走 SSE 秒级推送；外部写入（CLI / Web UI / 其他会话）由 SSE 连接的 3 秒 mtime 轮询检测 | `/api/octie/events`（Node half）、`connectSse(project)`（client） |
| 图物理开关 | 图视图右上角 `Physics`：开启时扰动后受力回弹、拖拽涟漪；关闭时节点滑回整齐布局后定格 | `client.js` GraphView |
| 随包 agent preset | 「Octie 任务图模式」模板随包（`preset/octie-mode/`），插件 `apply()` 幂等预置到用户 preset 根（任何 root 已有同 id 即跳过、`authorable=false` 不猜路径）；persona 注入心智模型并强制先读 `octie` skill | `plugin/index.mjs` `ensureOctiePreset()`；创作/验证路径见 `docs/preset-skill-maintenance.md` |
| GitHub 直装 | npm git 依赖只打包 git 已跟踪文件 → `octie/dist`（除 `.map` 与 `dist/web-ui/`）提交进仓库；根 facade `package.json` 镜像 exports/dsh/bin 契约 + 运行时依赖，`dsh plugin add github:StarChen-Cycler/octie-dsh-plugin` 开箱即用；CI `git diff --exit-code -- octie/dist` 门禁防漂移 | 根 `package.json`、`octie/.gitignore`、`.gitattributes`、`.github/workflows/ci.yml` |
| 文档重构 | README 纯用户向；开发事项下沉 `docs/development.md`；preset/skill 修改路径与升级兼容性在 `docs/preset-skill-maintenance.md` | 仓库根 / `docs/` |

**安装形态对照（与 §3 选型结论一致，落地补充）**：bundle 仍是唯一正确形态；agent preset
（模式）作为提示词层叠加在宿主平面的 bundle 之上，而不是把 bundle 移进 preset——bundle 的
`octie` 服务发布、面板路由与技能注册属于宿主平面，进 preset 会被挂载审计拒绝。
