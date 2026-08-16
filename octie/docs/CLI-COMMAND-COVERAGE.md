# Octie CLI 命令 → Bundle 工具覆盖对照

本文记录 octie CLI 的完整命令面，与 `octie-dsh` bundle 插件暴露的 13 个 `octie_*`
模型工具之间的对应关系：哪些命令被转成了工具，哪些没有、为什么，以及部分覆盖的缺口。

## 1. 结论速览

- CLI 共注册 **19 个顶层命令**。
- 其中 **13 个** 被转成了 bundle 模型工具（`plugin/index.mjs` 的 `TOOL_NAMES`）。
- **6 个** 未转换。
- 另有 2 处**部分覆盖**（已转换命令里未暴露的子能力）。
- **反向**：DSH 插件还有一批 CLI 没有的能力（面板、实时同步、preset 预置、服务/事件等），
  即 CLI 与 DSH 是**双向差异**，不是超集关系——见 §7 双向能力差异总表。

## 2. 全量命令 → 工具映射

| CLI 命令 | 作用 | Bundle 工具 | 状态 |
|---|---|---|---|
| `init` | 初始化新项目 | `octie_init` | ✅ 已转换 |
| `create` | 创建原子任务 | `octie_create` | ✅ 已转换 |
| `list` | 列出任务（过滤） | `octie_list` | ✅ 已转换 |
| `get` | 查看任务详情 | `octie_get` | ✅ 已转换 |
| `find` | 高级搜索/过滤 | `octie_find` | ✅ 已转换 |
| `update` | 更新任务进度 | `octie_update` | ✅ 已转换 |
| `approve` | 审批 in_review 任务 | `octie_approve` | ✅ 已转换 |
| `wire` | 在链上插入任务 | `octie_wire` | ✅ 已转换 |
| `merge` | 合并两个任务 | `octie_merge` | ✅ 已转换 |
| `delete` | 删除任务 | `octie_delete` | ✅ 已转换 |
| `graph` | 图统计/校验 | `octie_graph` | ⚠️ 部分（缺 `chain`） |
| `history` | 快照 list/restore | `octie_history` | ✅ 已转换 |
| `handoff` | 子项目 handoff | `octie_handoff` | ✅ 已转换 |
| `export` | 导出项目数据到文件 | — | ❌ 未转换 |
| `import` | 从 JSON/Markdown 导入任务 | — | ❌ 未转换 |
| `serve` | 启动 web UI 服务器 | — | ❌ 未转换 |
| `panel` | 只读概览项目+子项目 | — | ❌ 未转换 |
| `config` | 读写项目级配置 | — | ❌ 未转换 |
| `registry` | 查看/清理全局注册表 | — | ❌ 未转换 |

（注：`guides` 不是顶层命令，而是 `--guide-*` 帮助标志，见 §4。）

## 3. 未转换的 6 个命令（及原因）

| CLI 命令 | 作用 | 为什么没做成模型工具 |
|---|---|---|
| `panel` | 只读概览当前项目及其子项目 | 只读汇总，模型可用 `octie_list` + `octie_graph` 自行拼出 |
| `serve` | 启动 web UI 服务器（任务可视化） | 长驻 HTTP 进程，不是一次性的任务变更操作 |
| `export` | 把项目数据导出到文件 | 文件 I/O，模型经 `fs` 工具即可完成 |
| `import` | 从 JSON/Markdown 批量导入任务 | 批量文件入库，非图状态机核心操作 |
| `config` | 读写项目级配置（`format` 键） | 琐碎，模型无需改动输出格式 |
| `registry` | 查看/清理全局项目注册表（`prune`） | 宿主全局维护，非单项目任务图 |

## 4. 部分覆盖的缺口

### 4.1 `graph` 子命令

CLI 的 `graph` 有 3 个子命令：

| CLI 子命令 | Bundle 是否覆盖 |
|---|---|
| `graph`（默认，图统计） | ✅ `octie_graph` 返回 `graphStats`（taskCount/byStatus/roots/orphans/cycles/hasCycle/topologicalOrder/connectedComponents） |
| `graph validate`（校验环/引用） | ✅ `octie_graph(validate:true)` 附加 `validation` |
| `graph cycles`（检测环） | ✅ cycles 已内嵌在 `graphStats.cycles` 里 |
| `graph chain <id>`（某任务的 blocker/dependent 链） | ❌ **未暴露**，`octie_graph` 没有 per-task 链视图 |

### 4.2 `guides` 标志

`guides.ts` 提供的 `--guide-*` 标志（对应 7 个 `right-way-to-*.md` 指南）是 CLI 帮助文档，
不是任务图操作，未做成工具。

## 5. `panel` 的三件事别混淆

1. **CLI `panel`** —— 只读终端概览（本项目第 3 节那条），未转工具。
2. **CLI `serve`** —— 才是 web UI（`dsh` 之外独立的 Express 可视化服务器），也未转工具。
3. **DSH 侧栏任务面板** —— 这是**另一件事**：bundle 的 client half（`sidebar.footer.action` +
   `shell.overlay` + SSE），与 CLI 的 `panel`/`serve` 无关。**已交付**并持续迭代
   （任务 `46cf7e0e` 起，后续增量：活跃度排序 `1102041`、实时同步与物理开关 `1ca3d2a`、
   自愈与竞态修复 `16555d8`/`28070b2`）；其能力清单见 §7.2。

## 6. 相关文档

- 机制与踩坑：`octie/docs/CORDIS-INTEGRATION.md`
- 可用性评估：`octie/docs/USABILITY.md`
- 审计：`octie/docs/AUDIT.md`

## 7. 双向能力差异总表

CLI 与 DSH 插件不是"CLI 超集"关系，而是**双向差异**：两条接口共享同一引擎与不变式，
各自有对方没有的能力面。

### 7.1 CLI 有、DSH 工具没有

| CLI 能力 | 说明 |
|---|---|
| `serve` / `panel` / `export` / `import` / `config` / `registry` | §3 未转换的 6 个命令 |
| `graph chain <id>` | per-task blocker/dependent 链视图未进 `octie_graph`（§4.1） |
| `get --fields` | `octie_get` 返回完整投影，无字段裁剪 |
| `list --tree` / `--summary` | 树视图与一行精简输出未进工具 |
| `create -i` 交互模式、`--notes-file`、env 注入（`OCTIE_TASK_TITLE` 等） | 终端交互便利项 |
| `--right-way-to-*` 7 个内置指南 flag | CLI 帮助文档，非图操作 |

### 7.2 DSH 插件有、CLI 没有

| 能力 | 落点 |
|---|---|
| 客户端任务面板（List + DAG 图、barycenter 布局、拖拽回稳、Physics 开关） | `client.js`（`exports["./client"]`，slot 注册） |
| 项目活跃度排序（`.octie/project.json` mtime 信号，下拉 + Web API 同步） | 面板 + `/api/octie/projects` + web-ui |
| 实时同步：会话内工具事件 SSE 秒级 + 外部写入 fs.watch（~100ms）+ 3s 轮询兜底 + 客户端自愈 | `/api/octie/events` + `client.js` |
| 随插件预置的「Octie 任务图模式」agent preset（幂等、绝不覆盖） | `preset/octie-mode/` + `ensureOctiePreset()` |
| `octie` 使用技能（按需加载，随包注册） | `ctx.skills.register` |
| `octie` Cordis 服务（17 方法 + `onChange`）与 `octie/*` 事件 | `plugin/index.mjs` |
| `/api/octie/{projects,state,task,graph,events}` Web 路由 | Node half 注册于 DSH webServer |

### 7.3 已对齐的部分

工具与 CLI 共享同一 octie-core / service 层：状态派生、原子校验（1–10 criteria/deliverables）、
孪生校验（blockers ↔ dependency-explanation）、BFS 解锁、不可变快照等**不变式完全一致**；
CLI 的 13 个核心命令与 13 个工具一一对应（§2 映射表）。
