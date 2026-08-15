---
name: octie
description: >-
  Use the octie task-graph component (13 octie_* tools, the `octie` Cordis
  service, octie/* events, and the DSH client task panel) to plan, track, and
  maintain a durable DAG of atomic tasks. Covers the tool signatures and the
  absolute-project-path convention, the invariants (derived status, approve
  gate, blocker twin), a pattern library, pitfalls, and how to contribute new
  patterns. Use when working with Octie tasks, task graphs, atomic task
  planning, or combining Octie with CodeGraph, C7, interview specs, or
  subagents.
---

# Octie 任务图组件 · 使用心法

Octie 是**持久化任务图状态机**：节点 = 任务，边 = blocker（依赖），状态由任务状态**派生**。
它不规定你的工作流——它只保证任务图的状态一致、可校验、可恢复。本技能教你
**正确操作这台状态机**：哪些是工具本身的规则（不变式，必须遵守），哪些只是
别人试过的用法（模式，可参考也可自创）。

> 原则：本技能提供**通用指导，而非硬性规则**。工具是中性的，用法是多样的。

## Part 0 · 心智模型（必掌握）

- 节点 = 任务（原子、可验证）；边 = blocker（A blocks B = B 依赖 A 的交付物）。
- 状态**只读派生**：`ready → in_progress → in_review → completed`（`blocked` 由未完成
  的 blocker 派生）。完成一个任务经 BFS 自动解锁下游。
- 主循环：**找活 → 干 → 勾选完成 → approve → 传播**。
- 数据在项目目录的 `.octie/project.json`（原子写 + 备份 + 不可变快照）；全局注册表
  `~/.octie/projects.json` 只做项目索引。
- **CLI、DSH 工具、DSH 面板读写同一份数据**：在哪边操作，另一边立即可见（面板经 SSE 实时刷新）。

## Part 0.5 · 工具速查（必掌握）

13 个 `octie_*` 工具。除 `octie_init` 外，**每个工具都带 `project` 参数**：

- **传绝对路径**——每次显式传，任务落点就完全确定；不传则回退到「当前打开的项目」
  （由 `octie_init` 或最近一次显式 `project` 设置），再没有才按进程 cwd 自动探测（不可靠，别依赖）。
- `octie_init` 例外：用 `path`（绝对路径）+ `name` 初始化新项目，没有 `project`。

| 工具 | 作用 | 关键参数（除 project） |
|---|---|---|
| `octie_init` | 在指定目录初始化新项目并打开 | `name`(必)、`path`(绝对路径) |
| `octie_create` | 创建原子任务（校验通过才落盘） | `title`(必)、`description`(必)、`successCriteria`(必,数组)、`deliverables`(必,数组)、`priority`、`blockers`、`dependencyExplanation`、`relatedFiles`、`notes` |
| `octie_list` | 任务摘要列表 | `status`、`priority` |
| `octie_find` | 搜索任务 | `title`、`search`、`hasFile`、`verified`、`withoutBlockers`、`orphans`、`leaves`、`status`、`priority` |
| `octie_get` | 单个任务完整投影 | `id`(必) |
| `octie_update` | 更新任务（状态自动派生） | `id`(必)、`completeCriteria`、`completeDeliverables`、`addNeedFix`、`completeNeedFix`、`addSuccessCriteria`、`addDeliverables`、`priority`、`notes`、`blockers`(单个ID)、`dependencyExplanation`、`unblock` |
| `octie_approve` | **唯一**手动状态转移 in_review → completed | `id`(必) |
| `octie_wire` | 把任务插入两个已连接任务之间（A→C 变 A→B→C） | `id`(必)、`after`(必)、`before`(必)、`depOnAfter`(必)、`depOnBefore`(必) |
| `octie_merge` | 合并两任务（source 删除、内容并入 target） | `source`(必)、`target`(必) |
| `octie_delete` | 删任务 | `id`(必)、`mode`(simple/reconnect/cascade) |
| `octie_graph` | 图统计；`validate:true` 附加结构校验 | `validate` |
| `octie_history` | 不可变快照列表/恢复 | `action`(list/restore,必)、`snapshotId` |
| `octie_handoff` | 建子项目（`.octie/subprojects/` 下）并创建父门任务 | `subprojectName`(必)、`title`(必)、`description`(必)、`successCriteria`(必)、`deliverables`(必)、`priority` |

## Part 1 · 不变式（必掌握——违反 = 破坏状态）

| # | 不变式 | 违反的后果 |
|---|---|---|
| 1 | 状态只能派生，**唯一手动转移是 `octie_approve`**（in_review → completed）；没有 setStatus | 手动改状态会让图与实际工作脱节，下游在错误时机被解锁 |
| 2 | `blockers` 与 `dependencyExplanation` **孪生必填** | 有边无理由 → 图不可解释，审计/重构时无法判断依赖是否必要 |
| 3 | 任务必须原子：标题含动作动词、criteria 定量、deliverables 具体、范围 2–8h | 模糊任务会被创建校验**直接拒绝**——拒绝是信号，不是障碍：拆小、写具体 |
| 4 | 任务 ID 支持完整 UUID 或前 7–8 位前缀；短前缀有歧义时报错 | 用更短前缀可能命中多个任务，操作被拒 |
| 5 | `wire`/`merge`/`delete`（reconnect/cascade）是图代数，不是列表操作 | 理解成"编辑列表"会意外重连或级联删除，毁掉依赖结构 |
| 6 | 快照是状态存档（SHA-256 去重），不是 VCS 提交 | 把快照当版本控制用会制造大量语义混乱的恢复点 |
| 7 | 工具返回的是 owned JSON 投影，不是活图对象 | 改投影、或期待它"随图联动"，都是幻觉——任何变更都必须走工具 |

## Part 2 · 用法模式库（可选、多样、非约束）

每个模式只是**众多用法之一**——标注适用场景、依赖的组件与取舍。欢迎自创。

### 模式 A · 代码智能工作流（CodeGraph + C7 + Interview Specs）

- **适用**：新项目/大特性的规划与实现；需要需求澄清 + 代码智能 + 库文档校验的完整管线。
- **组合**：Interview（产出 user_spec）→ Brainstorm/C7（产出 tech_spec）→ CodeGraph
  （活代码索引）→ Octie（任务图：把 spec 分解成带依赖的原子任务，逐条实现、勾选、approve）。
- **依赖**：CodeGraph MCP、C7 MCP、interview/brainstorm 技能、spec 文件约定。
- **取舍**：规划质量高、可追踪性强；但组件多、脚手架重，小任务杀鸡用牛刀。
- **来源**：社区用户已验证的工作流（octie-init/research/dev/fix 系列技能即此模式）。

### 模式 B · 极简清单（仅 Octie 本体）

- **适用**：个人任务追踪、小型修复、不想引入任何其他组件的场景。
- **组合**：`octie_init` → `octie_create` → `octie_list`/`octie_find` → `octie_update` → `octie_approve`。
- **依赖**：无。
- **取舍**：零成本起步；没有代码智能/文档校验，任务质量全靠自己写。

### 模式 C · 任务 → 子代理扇出（Octie + subagents）

- **适用**：任务可并行、每项独立可验收的多路工作。
- **组合**：用 Octie 建"扇出层"任务图（横向分解，同层无 deliverable 依赖）；每个 ready
  任务派一个子代理执行；子代理回报后勾选 criteria、approve 解锁下一层。
- **依赖**：subagents/workflow 派发能力。
- **取舍**：并行度可控、进度可见；需要先做横向/纵向分解（见 Part 1 #3、#5）。

### 模式 D · 缺陷分诊（need_fix 反馈环）

- **适用**：review/runtime/regression 三类问题回流到任务。
- **组合**：`octie_update` 的 `addNeedFix`（带 source）→ 修复 → `completeNeedFix`；
  need_fix 未清空则无法进入 in_review。
- **依赖**：无。
- **取舍**：问题被钉在任务上、不丢；但流程比"直接修"重一档。

### 模式 E · DSH 面板实时追踪（Octie 面板）

- **适用**：在 DeepSeek Harness 里盯一个项目的执行状态，不想切终端。
- **组合**：侧栏 Octie 图标 → 面板；**List 视图**按 status→priority→title 排序，当执行队列看；
  **Graph 视图**看依赖 DAG（ready 在上、blocked 在下，节点可拖拽、松手回稳）；悬停出完整标题；
  点任务/节点开详情弹窗（criteria / deliverables / need_fix / blockers / dependencies / C7 / notes / 时间戳）。
- **数据同源**：面板经 `/api/octie/*` 读取 + SSE 推送，与 CLI/工具实时一致。
- **依赖**：DSH bundle 的 client half（面板只读，变更仍走工具/CLI）。
- **取舍**：零切换盯进度；但只能看，不能改。

## Part 3 · 陷阱（为什么不要——给后果，不喊禁令）

- **手动改状态 / 绕过 approve**：会让下游在前提未满足时启动，DAG 语义崩坏。用 `octie_approve`。
- **建模糊任务**：创建即被拒（原子校验）。被拒 = 校验器在帮你拆解——按 violations 改，别绕过。
- **混淆 `ready` 与 `without-blockers`**：前者 = 无 blocker 且前提满足（真正可开工）；
  后者只是"没设 blockers"（可能仍被前置依赖卡住）。找活用前者。
- **过度/不足分解**：同层任务复杂度要对齐（都 2–8h）；一个 2h 一个 8h 时拆大或并小。
- **把快照当 VCS**：快照是状态恢复点；代码/文档版本管理请用 git。
- **为协调而加 blocker**：blocker 必须对应"需要对方的交付物"；纯"先后顺序偏好"用 priority。
- **传相对路径 / 漏传 project**：回退到"当前项目/自动探测"可能落错项目——每次都显式传绝对路径。
- **改工具返回的投影对象**：投影是一次性快照，改了也不落盘；要变更走 `octie_update`/`octie_approve` 等工具。
- **在图视图里找活**：图视图看依赖结构；找活/定顺序看 List 视图（已按执行顺序排序）。

## Part 4 · 如何沉淀新用法

发现新用法时，先用**试金石**归类：**「换个工作流，这条还成立吗？」**

- **成立** → 工具性质 → 归入 Part 1 不变式（同时写清"违反的后果"）。
- **不成立** → 某工作流的经验 → 归入 Part 2 模式库，必须带：适用场景 + 依赖组件 + 取舍，
  并注明"这只是其中一种用法"。
- **踩坑** → 归入 Part 3，写成"为什么不要"，不要写成"禁止"。

> 守住一条底线：Part 1 只收工具性质，不收任何个人工作流偏好——否则本技能会退化成
> "某一种做法的说明书"，而不是通用指导。
