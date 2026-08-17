# Octie CLI 项目使用基本原则

> 本文提炼自仓库内 5 个 CLI 工作流 skills（`.agents/skills/octie-{init,research,dev,fix,refine}/`）
> 中关于「如何使用 Octie 项目」的硬性规则与惯例，整理成一份可直接查阅的原则清单。
> 不变式（派生状态、approve 门、阻断孪生）以本文与 `docs/dsh-plugin-usage-principles.md`
> 为准（原 usage skill 已移除，待重写）。
>
> 定位说明：**CLI（`octie` 命令 + `octie serve`）是 Octie 的一等独立接口**——可全局安装、
> 终端/脚本驱动，不依赖 DSH；DSH 插件是与之共享同一任务图存储的另一条接口，其工具层原则见
> `docs/dsh-plugin-usage-principles.md`。

## 1. 项目与任务模型

- **项目 = 一个 `.octie/` 目录**（`octie init` 创建），任务图持久化在 `.octie/project.json`。
- **节点 = 原子任务，边 = blocker 依赖**；状态由依赖与进度**只读派生**，不存在手动设置状态的命令。
- **短 ID 约定**：引用任务用 UUID 的**前 7–8 位**（错误提示会要求 ≥7 位）。
- **一次一个任务**：把当前任务的全部 criteria / deliverables / need_fix 做完（并提交）之后才进入下一个；
  保证每个任务对应干净的 git 提交历史、依赖解锁走正规 `approve`。

## 2. 创建任务的规范（`octie create`）

| 字段 | 规范 |
|---|---|
| `--title` | 「动作动词 + 对象 + 语境」，如 `Implement JWT login endpoint` |
| `--description` | What + Why + How，≥50 字符 |
| `--success-criterion` | ≤10 条，**定量、可独立判定**（yes/no）：如「Returns 200 with JWT」；反例「Works well」「Fast」 |
| `--deliverable` | ≤10 条，**具体产物**（文件/接口/测试/文档路径）：如 `src/api/auth/login.ts`；反例「Code」 |
| `--priority` | `top` / `second` / `later`——表示**紧急度**，不是复杂度 |
| `--notes` | 放 criteria/deliverables 装不下的上下文：假设、约束、环境变量等 |
| `--related-files` | 关联文件路径，逗号分隔 |

- **原子性**：单任务 2–8 小时、具体、可执行、可验证。超过范围会被原子校验拒绝——按 violations 拆解，不要绕过。
- **复杂度对齐**：同一层的任务 scope 应相近；一个 2h 一个 8h 时，拆大的或并小的。
- **分解方式**：水平分解 = 同级并行（同复杂度）；垂直分解 = 逐层递进（每个基于上一个）。
- **好/坏对照**：

| 类型 | ❌ 坏 | ✅ 好 |
|---|---|---|
| Criterion | "Works well" | "Returns 200 status code" |
| Criterion | "Fast" | "Response time < 200ms" |
| Deliverable | "Code" | "src/api/auth/login.ts handler" |
| Notes | — | "Assumes PostgreSQL, requires env vars: JWT_SECRET" |

## 3. 依赖（blockers）创建的规范

- **孪生铁律**：`--blockers` 与依赖说明**必须成对**——创建时用 `--dependencies`，更新时用
  `--dependency-explanation`。只给其一会被拒绝。
- **blocker 成立的三个条件**（缺一不加边）：
  1. 前置任务产出被依赖任务**需要的交付物**；
  2. 依赖**不可避免**（没有绕行方案）；
  3. 关系**写明在说明里**（为什么需要）。
- **纯先后偏好不加 blocker**：用 `--priority` 表达顺序偏好，而不是制造假依赖。
- **已存在项目必须先研究再动**：`.octie/` 已有任务时，先 `/research`（技术边角/集成点），
  再 `octie list --graph` + `octie graph validate` 分析现状，最后才 create/merge/wire。

## 4. 图操作规范（wire / merge / priority）

- **wire（插链）**：`octie wire <task-id> --after <src> --before <tgt> --dep-on-after "<理由>" --dep-on-before "<理由>"`——两个方向的理由同样成对（孪生）。
- **merge（合并）**：`octie merge <source-id> <target-id>`，先 `octie get` 两个任务看清内容再并。
- **priority**：`octie update <id> --priority <top|second|later>`。
- **加一个 blocker**：`octie update <id> --blockers <blocker-id> --dependency-explanation "<理由>"`（逐个加）。
- **`--unblock` 的边界**：它会**绕过依赖校验**强制移除 blocker，下游可能在前提未满足时启动、
  破坏 DAG 语义。**执行流程中一律禁止**——依赖满足后由 `octie approve` 自动解锁下游；
  仅在重构图结构（octie-refine）时按需使用，且事后必须 `octie graph validate` + `octie graph cycles` 复查。
- **每轮图操作后验证**：`octie list --graph`（看结构）→ `octie graph validate`（完整性）→
  `octie graph cycles`（环）→ `octie find --orphans`（游离节点，用 wire 接回）。
- **批量建节点：先画依赖再落子**（2026-08 实战教训）：一次 create 多个任务前先想清它们之间
  以及它们与既有节点的 blocker 关系——本次实战 5 个节点全无 blockers，`octie graph` 立刻暴露
  5 个 orphans，补了 7 条边才闭合。正确姿势：create 时就带 `--blockers` + `--dependencies`
  （孪生），建完必查 `octie graph`，**orphans 必须为 0**。

## 5. 执行与状态流转规范

- **找活顺序**：`octie list --status in_progress` 优先（续做）→ `octie list --status ready` 按
  top>second>later → `octie find --without-blockers` 区分「没设 blockers」与「真正可开工」
  （前者仍可能被前置依赖卡住，找活用 ready）。
- **进度维护**：`octie update <id> --complete-criterion <criterion-id> [--evidence "<证据>"]`、
  `--complete-deliverable <deliverable-id>`；批量用逗号 `id1,id2`。
- **审批（唯一手动状态转移）**：全部 criteria/deliverables/need_fix 完成后
  `octie approve <id>`——approve 会校验完成度，通过才把任务置为 completed 并 BFS 解锁下游。
  **禁止** `--unblock` 代替 approve（见 §4）。
- **提交时机**：每个任务完成后立即 git 提交（per-task 干净历史）。

## 6. 缺陷处理（need_fix 反馈环）

- **三个来源**：review（评审）/ runtime（运行错误）/ regression（回归）。加缺陷时带来源与文件：
  `octie update <id> --add-need-fix "<问题>" --need-fix-source <review|runtime|regression> --need-fix-file "<path>"`。
- **闭环**：修复 → `--complete-need-fix <need-fix-id>`；need_fix 未清空不能进入 in_review。
- **实战补充（2026-08）**：`--add-need-fix` 会把已 `in_review` 的任务**打回 in_progress**
  （实测）——这是特性不是 bug：只要还有未闭环缺陷，任务就不该被审批。缺陷记录要带
  **根因 + 复现/验证方法**（如"tasksKey 只含 id → useMemo 复用旧模拟"），修复提交推送后
  `--complete-need-fix` 关闭，任务才重新进入 in_review。
- **来源指引**：特性/缺陷准备（octie-fix 阶段）用 C7 MCP 验证技术选型后建任务，
  「最小变更修根因 + 沿用现有模式 + 与 C7 对齐」。

## 7. 工作流阶段与验证清单

```
octie-init      Phase 1：项目结构 + user_spec/tech_spec + 编码规则（不建任务）
octie-research  Phase 1.5：octie init + 从 specs 建任务 + 图验证
octie-dev       Phase 2：实现循环（找活 → 实现 → update → approve → commit）
octie-fix       Phase 3：新特性/缺陷准备（C7 验证 → 建任务 → 交回 dev）
octie-refine    Phase 2.5：图重构（wire/merge/priority/unblock 重组依赖）
```

每个阶段的通用纪律：

- 动手前先 `octie -h`（及各子命令 `-h`）确认语法，CLI 选项可能变化；
- 读输出一律 `--format md`（token 高效）；
- 图有任何修改 → 跑 §4 的验证四连；发现不一致 → create/merge/wire/update 修正并重新验证；
- Octie 不可用 → 中止并告知用户。

## 8. 命令正误对照（来自 skills 的 INVALID 清单）

```bash
# ❌ WRONG                                     # ✅ CORRECT
octie update <id> --status <status>            # 状态自动派生，没有手动设置命令
octie create --blockers <ids>                  # 必须同时给 --dependencies
octie update <id> --blockers                   # 必须带 --blockers <ids>（+ --dependency-explanation）
octie update <id> --unblock <id>（执行流程中）  # 用 octie approve 走正规解锁
```

## 9. 常见报错 → 修法

| 报错 / 现象 | 修法 |
|---|---|
| "violates atomic task" | 拆分任务（标题动词化、criteria 定量化、2–8h 范围） |
| "twin required" | 同时提供 blockers 与依赖说明（create 用 `--dependencies`，update 用 `--dependency-explanation`） |
| "Cycle detected" | 移除成环的一个 blocker，重新 validate |
| "Task not found" | 用 7 位以上 UUID 前缀 |
| "orphaned task" | 用 `octie wire` 接回图 |

## 10. 与其他文档的关系

- **不变式与心智模型**（状态派生 / approve 门 / 孪生 / 原子校验）：本文与
  `docs/dsh-plugin-usage-principles.md`。
- **DSH 插件工具层版本**（同一套原则换成 13 个 `octie_*` 工具的表达）：`docs/dsh-plugin-usage-principles.md`。
- **开发与维护**：`docs/development.md`、`docs/preset-skill-maintenance.md`。

## 11. 实战沉淀（2026-08 · 面板实时修复）

> 一次真实 bug 修复周期的经验，已回写进上文对应章节，这里作速览：

1. **先画依赖再批量建节点**：5 个新节点忘记 blockers → `octie graph` 的 orphans 立刻报警；
   补 7 条边（`--blockers` + `--dependency-explanation` 孪生）后 orphans 归零、连通分量 8→4。
2. **"看起来没更新"先验数据再验界面**：面板颜色不更新时，先 `octie get/list` 确认落盘状态
   已变，再怀疑界面层——数据是真相，界面只是投影。
3. **缺陷走 need_fix 而非口头**：评审发现的问题 `--add-need-fix`（带根因与验证方法）入图，
   修复提交后 `--complete-need-fix` 闭环；期间任务被自动打回 in_progress，天然挡住提前审批。
4. **审批门照常生效**：即便全部工作完成、CI 全绿，任务也只停在 in_review，等用户裁决后才
   `octie approve` 转 completed。
