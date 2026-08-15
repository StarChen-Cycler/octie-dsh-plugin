# DSH 插件使用原则（octie_* 工具层）

> 本文是 `docs/cli-usage-principles.md`（CLI 原则）在 DSH 插件工具层的对应版：
> **同一套不变式，换成 13 个 `octie_*` 工具的表达**。CLI 命令 → 工具的完整映射另见
> `octie/docs/CLI-COMMAND-COVERAGE.md`；不变式与心智模型的权威是 `octie/skills/octie/SKILL.md`。
>
> 注意：**CLI 是与插件并行的一等接口**（独立安装、终端驱动、同一份任务图存储），
> 本文只是插件侧的原则视图，不是 CLI 的替代文档。

## 1. 会话内前置约定

- **先读 skill**：「Octie 任务图模式」preset 的 persona 要求 agent 在第一次调用 `octie_*`
  工具前，先用 `skill` 工具加载 `octie`（该 skill 由插件安装时自动注册进技能目录）。
- **绝对路径铁律**：除 `octie_init` 外，**每个工具都带 `project` 参数**——一律传显式
  **绝对路径**，绝不依赖 cwd 自动探测（落错项目的第一根源）。
- **`octie_init` 例外**：用 `path`（绝对路径）+ `name` 初始化新项目，没有 `project`。
- **工具返回是 lossless JSON 投影**：可安全序列化，但不落盘——要变更必须走
  `octie_update` / `octie_approve` 等变更工具。

## 2. 工具总览（13 个 → CLI 对应）

| 工具 | 对应 CLI | 用途 |
|---|---|---|
| `octie_init` | `octie init` | 初始化项目（`path` + `name`） |
| `octie_create` | `octie create` | 原子创建任务 |
| `octie_list` / `octie_get` / `octie_find` | `octie list/get/find` | 列任务（status/priority 过滤）/ 详情 / 搜索（withoutBlockers·orphans·leaves·hasFile·verified） |
| `octie_update` | `octie update` | 维护进度与图：completeCriteria/completeDeliverables/completeNeedFix、addNeedFix/addSuccessCriteria/addDeliverables、notes、blockers、priority |
| `octie_approve` | `octie approve` | 唯一手动状态转移（in_review → completed），BFS 解锁下游 |
| `octie_wire` | `octie wire` | 插链：A→C 变为 A→B→C（after/before + depOnAfter/depOnBefore） |
| `octie_merge` | `octie merge` | 合并 source → target |
| `octie_delete` | `octie delete` | 删除（mode：simple / reconnect / cascade） |
| `octie_graph` | `octie graph` | 图统计（validate:true 附加完整性校验） |
| `octie_history` | `octie history` | 不可变快照 list / restore |
| `octie_handoff` | `octie handoff create` | 建子项目（`.octie/subprojects/`）并创建父门任务 |

## 3. 建任务原则（`octie_init` / `octie_create`）

- **原子性**：单任务 2–8 小时、具体、可执行、可验证；`title` = 「动作动词 + 对象 + 语境」；
  `description` 写 What + Why + How。
- **定量 criteria**：`successCriteria` ≤10 条，每条可独立判定（yes/no）——「Response time
  < 200ms」✅，「Works well」❌。
- **具体 deliverables**：`deliverables` ≤10 条，条条是具体产物路径——`src/api/auth/login.ts` ✅，
  「Code」❌。
- **priority 表紧急度**：`top` / `second` / `later`，不表复杂度。
- **`notes` 放上下文**：假设、约束、环境变量等装不下的信息。
- **孪生铁律**：带 `blockers` 就必须同时带 `dependencyExplanation`（创建时同一次调用内成对）。

## 4. 建依赖原则（create 的 blockers / `octie_update` / `octie_wire` / `octie_merge`）

- **blocker 成立三条件**（缺一不加边）：前置任务产出被依赖任务需要的交付物；依赖不可避免；
  理由写进 `dependencyExplanation`。
- **插链**：`octie_wire(id, after, before, depOnAfter, depOnBefore)`——两个方向的理由同样成对。
- **加一个 blocker**：`octie_update(id, blockers, dependencyExplanation)`；**纯顺序偏好**用
  `priority`，不造假依赖。
- **`unblock` 的边界**：`octie_update` 的 `unblock` 参数会绕过依赖校验强制移除 blocker
  （对应 CLI `--unblock`），下游可能在前提未满足时启动。**执行流程一律不用**——
  依赖满足后由 `octie_approve` 自动解锁下游；仅在重构任务图时按需使用，事后必跑
  `octie_graph(validate:true)` 复查。
- **合并**：先 `octie_get(source)` + `octie_get(target)` 看清内容，再 `octie_merge`。
- **删除**：`octie_delete` 的 `mode` 语义——`simple` 删自身并清理引用；`reconnect` 把
  前后节点接上；`cascade` 连下游一起删。选错 mode 会破坏图结构。

## 5. 找活与执行原则（`octie_list` / `octie_find` / `octie_update` / `octie_approve`）

- **找活顺序**：`octie_list(status:'in_progress')` 优先（续做）→ `octie_list(status:'ready')`
  按 priority → `octie_find(withoutBlockers:true)` 只回答「没设 blockers」，真正可开工看
  `ready`（两者语义不同，别混淆）。
- **一次一个任务**：completeCriteria / completeDeliverables / completeNeedFix 全部完成
  后才进入下一个；每个任务对应一次干净的提交。
- **进度维护**：`octie_update` 的 `completeCriteria` / `completeDeliverables`（传 id 数组，
  来自 `octie_get` 的投影，别自己编 id）。
- **审批门（DSH 版铁律）**：任务做到全部完成即进入 `in_review`，**由用户裁决是否
  `octie_approve`**——不自批、不绕过。仅当用户明确授权自治循环时，agent 才在
  全部 criteria/deliverables/need_fix 完成的前提下自己调用 `octie_approve`。
  approve 通过后下游经 BFS 自动解锁，无需任何 unblock。

## 6. 缺陷与图维护原则（need_fix / graph / history / handoff）

- **need_fix 三来源**：review / runtime / regression——`octie_update(addNeedFix: [...])`，
  每条带来源与文件；修复后 `completeNeedFix`；未清空不能进 in_review。
- **图完整性**：任何图操作（create/wire/merge/delete/update blockers/unblock）之后，
  跑 `octie_graph(validate:true)` 检查环与引用；`octie_find(orphans:true)` 找到游离节点用
  `octie_wire` 接回。
- **快照语义**：`octie_history` 是状态恢复点（恢复前先 list 看快照链），不是版本管理——
  代码/文档版本用 git。
- **handoff 语义**：`octie_handoff` 建立的父子关系是**松散备注型**（notes-only），不加
  跨项目边、不建 sub_items/related_files 硬链接；父门任务在子项目 backlog 完成前不得 approve。

## 7. CLI 原则 → 工具表达对照速查

| CLI 原则（`docs/cli-usage-principles.md`） | 工具表达 |
|---|---|
| `octie create --blockers … --dependencies "…"` | `octie_create({ blockers, dependencyExplanation })` 同次成对 |
| `octie update <id> --blockers <id> --dependency-explanation "…"` | `octie_update({ id, blockers, dependencyExplanation })` |
| `octie wire … --dep-on-after "…" --dep-on-before "…"` | `octie_wire({ id, after, before, depOnAfter, depOnBefore })` |
| `octie update --complete-criterion <id> --evidence "…"` | `octie_update({ id, completeCriteria: [cid] })`（证据写入 `notes`） |
| `octie approve`（全部完成才可） | `octie_approve`（DSH 约定：先交用户裁决） |
| 禁止 `--unblock`（执行流程） | 不用 `octie_update.unblock`（重构除外，事后 validate） |
| `octie graph validate / cycles` | `octie_graph({ validate: true })` |
| `octie find --without-blockers / --orphans / --leaves` | `octie_find({ withoutBlockers / orphans / leaves })` |
| `--format md`（token 高效） | 工具返回即精简 JSON 投影，无需格式开关 |
| `octie -h` 先查语法 | 工具 schema 即文档；细节以 `octie` skill 为准 |

## 8. 与其他文档的关系

- **不变式权威**：`octie/skills/octie/SKILL.md`（Part 0 心智模型 / Part 0.5 工具速查 /
  Part 1 不变式 / Part 3 陷阱）——冲突时以它为准。
- **CLI 版本**：`docs/cli-usage-principles.md`。
- **命令覆盖对照**：`octie/docs/CLI-COMMAND-COVERAGE.md`。
- **开发与维护**：`docs/development.md`、`docs/preset-skill-maintenance.md`。
