# octie-dsh-plugin 发布前审计报告（AUDIT.md）

> 用户要求：push 前至少 5 次审计。以下 5 个独立审计面，每面含范围、方法、结论与发现。
> 审计对象：worktree 分支 `octie-dsh-plugin`（HEAD 与本文同一提交链）。
> 结论：**5/5 通过（1 个正确性缺陷在审计中发现并已修复）。**

## Pass 1 · 正确性审计（CLI ↔ service 行为一致性）

- **范围**：`src/cli/commands/*` 与 `src/service/*` 是否双轨、行为是否一致。
- **方法**：
  - 静态核查：8 个核心命令（update/approve/wire/merge/delete/list/get/find）的
    action 中是否残留 `loadGraph`/`saveGraph`（应全部为 0，逻辑在 service 层）。
  - 动态核查：全量测试 `npm test`（780/780，exit 0，零测试期望改动）；
    `npm run test:core`（289/289）。
- **发现**：
  - ✅ 静态核查：8/8 命令无 `loadGraph`/`saveGraph`，全部经 service import 取数。
  - 🐛 **B-1（已修复）**：bundle 工具包装层对 `octie_init` 也先调 `resolveProject`，
    而该工具的参数名是 `path` 而非 `project`——首次调用时 `args.project` 为 undefined，
    落入 `openProject()` 自动探测。在 worktree 里测试侥幸通过（worktree 本身就是
    octie 项目），在干净目录中确定性复现失败。**修复**：`makeTool` 增加
    `resolveProject: false` 选项，`octie_init` 不再前置解析项目。
    修复后在干净副本中 `test:core` 289/289。
- **结论**：通过。

## Pass 2 · DSH 契约审计（bundle manifest + Cordis 插件规则）

- **范围**：`package.json` 的 `dsh.bundle`、`cordis.patch.yml`、Node half 契约。
- **方法**：`scripts/audit-contract-check.mjs` + bundle 单测（5 例）+ 人工核对。
- **结果**：
  - `dsh.bundle.patch` → `./cordis.patch.yml`；`main` → `./plugin/index.mjs`；
    `exports` 含 `.`（插件）/`./core`（库）/`./package.json`/`./cordis.patch.yml`。
  - `cordis.patch.yml`：单个 `insert` 行，`id: octie-dsh`，`name: octie-cli`（合法 YAML）。
  - Node half：named-exports `name`/`inject:['tools']`/`apply` ✓；13 个 `octie_*` 工具经
    `ctx.tools.register` 注册 ✓；`octie` 服务经 `ctx.provide` 提供（17 方法 + onChange）✓；
    所有副作用挂 `ctx.effect` 返回 disposer ✓（bundle.test 断言）。
  - 纯 JS `.mjs`：无 TS/JSX/import 受禁全局 ✓。
- **发现**：无。
- **结论**：通过。

## Pass 3 · 安全审计（原仓库零触碰 + 无密钥泄漏）

- **范围**：原 `task-driver` 仓库是否被改动；worktree 提交中是否含密钥。
- **方法**：`git log`/`status`/`remote` 核查 + 针对 worktree 全量 diff 的密钥模式扫描
  （`ghp_`/`gho_`/PEM 头/`api_key=`，词边界收紧版）。
- **结果**：
  - 原仓库：`HEAD = 3dabe98`（与本工作开始时一致）；working tree 仅有一个**预先存在**的
    未跟踪文件（`octie/active-task-refinement-design.md`，非本工作产生）；remotes 未变；
    **零 push 至 `StarChen-Cycler/octie`**。
  - 密钥扫描：无真实命中（曾因 `sk-` 过宽误报 `ta**sk-**created`，收紧后为 0）。
  - 发布将只推送到**新建**的 `octie-dsh-plugin` 仓库，且以「按 URL push」方式执行
    （不修改共享 git 配置的 remote）。
- **结论**：通过。

## Pass 4 · 打包审计（npm pack 载荷 + 干净安装构建测试）

- **范围**：发布包内容完整性；从零安装 → 构建 → 核心测试。
- **方法**：
  - `npm pack --dry-run --ignore-scripts`：核对 `cordis.patch.yml`、`plugin/index.mjs`、
    `dist/index.js`、`bin/octie.cjs`、`README.md`、`LICENSE` 均在包内（共 125 文件）。
  - **干净副本测试**：把 `package*.json`/`tsconfig`/`vitest.config`/`src`/`tests`/`test`/
    `plugin`/`bin`/`scripts`/`cordis.patch.yml` 复制到全新临时目录 → `npm ci`（351 包）
    → `npm run build:cli`（tsc 产出 `dist/index.js`）→ `npm run test:core`。
- **结果**：干净副本 `test:core` **289/289**（修复 B-1 后）；build 成功；`dist/index.js` 存在。
- **发现**：B-1 正是本面（干净环境）才被确定性暴露的——**打包审计价值验证**。
- **结论**：通过。

## Pass 5 · 易用性与文档审计

- **范围**：USABILITY.md 发现闭环；usage skill 四层结构；README 完整性；文档互链。
- **方法**：文件存在性 + 结构核验 + 一致性检查。
- **结果**：
  - `octie/docs/USABILITY.md`：9 条发现（High 1/Medium 5/Low 3），3 条已修复
    （原子写重试加强、`registry prune`、缓存探测跳过——各有测试），6 条明确列为
    后续建议（F6 标记为破坏性 UX 变更，需单独评估）。
  - ~~`skills/octie/SKILL.md`~~（**已随 1.2.3 移除**，待重写）：Part 0 心智模型 / Part 1 不变式（带后果）/ Part 2 模式库
    （CodeGraph+C7+Interview 标为 one-of-many，含适用/依赖/取舍）/ Part 3 陷阱
    （为什么不要）/ Part 4 沉淀入口（试金石）——当时符合设计文档 §10.3 四层结构。
  - `octie/README.md`：安装命令、13 工具表、3 种消费模式、`octie-cli/core` 架构说明齐全。
  - 已知环境性抖动（Windows AV 文件锁、遗留 `octie serve` 占用 3456、execSync 测试
    负载超时）已在 USABILITY.md F1/F3/F9 与 vitest 配置（超时 30s、fast-fail env、
    `test:core` 迭代门禁）中记录与缓解。
- **结论**：通过。

## 汇总

| Pass | 审计面 | 结论 | 发现 |
|---|---|---|---|
| 1 | 正确性（CLI↔service） | ✅ 通过 | B-1 已修复 |
| 2 | DSH 契约 | ✅ 通过 | 无 |
| 3 | 安全（原仓库/密钥） | ✅ 通过 | 无 |
| 4 | 打包（pack + 干净安装） | ✅ 通过 | B-1 由此暴露并验证修复 |
| 5 | 易用性与文档 | ✅ 通过 | 无阻塞项 |

**唯一阻塞级缺陷 B-1 已在修复后于干净环境复测通过。全部 5 个审计面通过，允许发布。**

---

## 维护期后记（2026-08）

发布后按「先可用、再迭代」持续合入增量：客户端任务面板（列表 + DAG 图 + 物理开关）、
项目活跃度排序、SSE 实时同步与外部变更轮询、随包 agent preset 预置、GitHub 直装
（dist 提交 + 漂移门禁）、CI 三平台矩阵、文档重构。当前门禁状态见
`docs/development.md`（测试数、CI 布局、dist 策略）与 `docs/preset-skill-maintenance.md`
（修改路径与验证清单）。本报告各 Pass 的结论与发现保持审计时的历史原貌。
