# octie-dsh-plugin

<p align="center">
  <img src="octie-harness-2.jpg" alt="Octie Harness — DSH bundle plugin" width="100%">
</p>

> **Status: 项目处于增量维护中（under incremental maintenance）** ——
> 新特性、修复与文档会以小幅增量持续合入（例如 DSH 客户端任务面板、交叉最小化的
> DAG 图布局、项目活跃度排序、外部变更实时同步、图物理开关、随插件预置的
> Octie 任务图模式、`octie` 使用技能等）。功能以「先可用、再迭代」的方式演进。

**Octie —— agent 时代的状态导向任务图内核（state-oriented task graph kernel），
重构为 DeepSeek Harness（DSH）可安装的 bundle 插件。State is derived, not set：
状态只读派生，而非手工设置——the task layer that every agent framework can call。**

Octie 是一个面向 agent 时代的**持久化任务图状态机**：节点 = 原子任务，边 = blocker 依赖，
状态**只读派生**（`ready → in_progress → in_review → completed`，唯一手动转移是 `approve`），
完成一个任务经 **BFS 自动解锁下游**；原子校验在创建时拒绝模糊任务；不可变快照（SHA-256）
保证长会话可恢复。

本仓库把 Octie 炼化成了 DSH 生态组件：

- **`octie-cli/core`**（`exports["./core"]`）——DSH 无关的 octie-core 库：
  `TaskGraphStore`/`TaskNode`/`TaskStorage` + service 层（`createTask`/`listTasks`/`updateTask`/
  `approveTask`/`wireTask`/`mergeTask`/`deleteTask`/`graphStats`/`createHandoff`/…），
  CLI 与 Web UI 共用同一引擎。
- **包根（`exports["."]`）**——Cordis Node half（`plugin/index.mjs`）：提供 `octie` 服务
  （17 方法 + `onChange`）、注册 **13 个 `octie_*` 模型工具**、发出 `octie/*` 事件，
  并在加载时幂等预置「Octie 任务图模式」agent preset（见下文）。
- **`exports["./client"]`** —— DSH 客户端任务面板（`client.js`）：列表视图 + 分层 DAG
  图视图（barycenter 交叉最小化 + 力导向微调）、按任务图 mtime 活跃度排序的项目下拉、
  SSE 实时同步、图物理开关。
- **`bin`** —— 完整 `octie` CLI（薄壳）。

## 安装（DSH）

```sh
# npm 发布后
dsh plugin --profile <name> add octie-cli

# 或从本仓库 git 源
dsh plugin --profile <name> add github:StarChen-Cycler/octie-dsh-plugin
```

`cordis.patch.yml` 会挂载 `octie-dsh` 插件行。用法见 [`skills/octie/SKILL.md`](skills/octie/SKILL.md)
（通用指导：心智模型 / 不变式 / 用法模式库 / 陷阱 / 沉淀入口）。

安装后重启 DSH，插件会自动预置「Octie 任务图模式」agent preset（见下文），
新建会话时在模式选择器中即可选用。

## 客户端任务面板

- **项目活跃度排序**：项目下拉与 Web UI 侧边栏按「最近任务更新时间」排序。信号是
  `.octie/project.json` 的 mtime——每次任务增删改 / 审批 / 连线 / 合并 / 回滚都会经
  原子写重写该文件，所以它精确等于"最近任务更新时间"（注册表的 `lastAccessed` 不覆盖
  任务编辑，仅作回退）。最近动过的项目自动浮到顶部并被面板默认选中；侧边栏树按子树内
  最新活动排名，活跃子项目会把它的父项目组一起顶上去。
- **实时同步**：会话内 `octie_*` 工具变更经 SSE 秒级推送到打开的面板（列表 + 图 + 下拉
  同步刷新）；外部写入（终端 `octie` CLI、Web UI、其他 DSH 会话）由 Node half 每 3 秒
  比对当前项目 `project.json` 与注册表的 mtime 自动检测，同样实时刷新。
- **图物理开关**：图视图右上角的 `Physics` 开关。开启时小球受力——加载/切换时扰动后
  弹回平衡布局，拖拽带动邻居涟漪、松手回弹；关闭时所有节点丝滑滑回整齐的无受力布局
  后定格，之后拖拽为纯静态位移。

## Octie 任务图模式（随插件预置的 agent preset）

插件包内附带一个 DSH agent preset 模板（`preset/octie-mode/`）。插件加载时把它幂等地
预置到用户 preset 根目录（`$DSH_HOME/.agent-presets/octie/`）：

- 该模式的 persona 直接注入 Octie 心智模型与工作流程（图是持久真相、原子任务、
  显式绝对 `project` 路径、审批门、先可用再迭代），并**要求 agent 在第一次调用
  `octie_*` 工具前先用 `skill` 工具读取 `octie` skill 全文**——bundle 安装时已把该
  skill 自动注册进技能目录，`skill-filesystem` + `tool-skill` 行保证模式内可调用它。
- **幂等**：任何 root 已存在 id 为 `octie` 的 preset（包括用户手动创建或改过的）都
  不会被覆盖；部署无可写 preset root 时不猜测路径。卸载插件不会删除已预置的模式——
  它从落盘那一刻起就是用户数据。
- **退出开关**：环境变量 `OCTIE_NO_PRESET_PROVISION=1` 跳过预置（测试套件使用）。
- 使用：重启 DSH 后，新建会话时在模式选择器中选择「Octie 任务图模式」。

## 开发

```sh
cd octie
npm install
npm run build:cli        # tsc → dist/
npm run test:core         # 快速核心子集（~15s，302 例）
npm test                  # 全量门禁（793 例）
node dist/cli/index.js --help
```

## 文档

- [`docs/octie-dsh-plugin-refactor.md`](docs/octie-dsh-plugin-refactor.md) —— 从原 Octie 到 DSH 插件的完整改造设计（选型、API 设计、长期架构）。
- [`octie/docs/USABILITY.md`](octie/docs/USABILITY.md) —— 易用性评估（9 条发现，3 条已修复）。
- [`octie/docs/AUDIT.md`](octie/docs/AUDIT.md) —— 发布前 5 面审计记录（5/5 通过）。
- [`octie/docs/CORDIS-INTEGRATION.md`](octie/docs/CORDIS-INTEGRATION.md) —— Cordis 接入机制与踩坑记录。

## 与上游的关系

本仓库派生自 `StarChen-Cycler/octie`（v1.1.0，`3dabe98`），在独立分支 `octie-dsh-plugin`
上完成插件化改造；**上游仓库未做任何改动**。CLI 行为与上游逐字节兼容（全量测试零期望改动）。

## License

MIT（沿用上游）
