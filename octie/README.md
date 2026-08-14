# Octie

A graph-based task management system with CLI, web UI, and a **DeepSeek Harness (DSH)
bundle plugin** for atomic, verifiable tasks.

## DSH 插件（octie-dsh）

Octie 同时是一个可安装的 DSH bundle 插件：任务图状态机直接进入 agent 的工作循环。

### 安装

```sh
# 从 npm（发布后）
dsh plugin --profile <name> add octie-cli

# 或从 git 源
dsh plugin --profile <name> add github:<owner>/octie-dsh-plugin#<ref>
```

安装后，`cordis.patch.yml` 会挂载 `octie-dsh` 插件行：提供 `octie` 服务、注册
`octie_*` 模型工具、并发出 `octie/*` 事件。

### 工具清单（13 个）

| 工具 | 用途 |
|---|---|
| `octie_init` / `octie_open` | 初始化 / 打开项目 |
| `octie_create` | 原子创建任务（动词标题、定量 criteria、具体 deliverables） |
| `octie_list` / `octie_get` / `octie_find` | 列任务 / 查详情 / 搜索（含 withoutBlockers·orphans·leaves） |
| `octie_update` | 维护进度：勾选 criteria/deliverables/need_fix、加 need_fix、管理 blockers |
| `octie_approve` | 唯一手动状态转移（in_review → completed），BFS 解锁下游 |
| `octie_wire` / `octie_merge` / `octie_delete` | 图代数：插入依赖链 / 合并 / 删除（simple·reconnect·cascade） |
| `octie_graph` | 图统计与校验（环、拓扑、关键路径） |
| `octie_history` | 不可变快照列表 / 恢复 |
| `octie_handoff` | 子项目交接 |

### 三种消费模式

1. **模型工具**：agent 直接调用 `octie_*` 工具（工作循环主入口）。
2. **Cordis 服务**：其他插件 `inject: ['octie']`，调用 `ctx.octie.createTask()/listTasks()/…`
   程序化驱动同一张任务图（17 个方法 + `onChange` 订阅）。
3. **事件订阅**：`octie/task-created`、`octie/task-approved`、`octie/graph-changed`
   供 UI 与其他插件免轮询响应任务图变化。

### 用法心法

组件用法（不变式、模式库、陷阱）见 **`skills/octie/SKILL.md`**——通用指导，非硬性规则。

### 架构

- `octie-cli/core`（`exports["./core"]`）：DSH 无关的 octie-core 库——`TaskGraphStore`/
  `TaskNode`/`TaskStorage` + service 层（`createTask`/`listTasks`/…），CLI 与 Web UI 共用。
- 包根（`exports["."]`）：Cordis Node half（`plugin/index.mjs`）。
- `bin`：`octie` CLI。

详见仓库根 `README.md` 与 `docs/octie-dsh-plugin-refactor.md`（改造设计全文）。
