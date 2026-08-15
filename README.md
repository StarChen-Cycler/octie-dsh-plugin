# octie-dsh-plugin

<p align="center">
  <img src="octie-harness-2.jpg" alt="Octie Harness — DSH bundle plugin" width="100%">
</p>

> **Status: 项目处于增量维护中（under incremental maintenance）** ——
> 新特性、修复与文档会以小幅增量持续合入（例如 DSH 客户端任务面板、项目活跃度排序、
> 外部变更实时同步、图物理开关、随插件预置的 Octie 任务图模式、`octie` 使用技能等）。
> 功能以「先可用、再迭代」的方式演进。

**Octie —— agent 时代的状态导向任务图内核（state-oriented task graph kernel），
重构为 DeepSeek Harness（DSH）可安装的 bundle 插件。State is derived, not set：
状态只读派生，而非手工设置——the task layer that every agent framework can call。**

Octie 是一个面向 agent 时代的**持久化任务图状态机**：节点 = 原子任务，边 = blocker 依赖，
状态**只读派生**（`ready → in_progress → in_review → completed`，唯一手动转移是 `approve`），
完成一个任务经 **BFS 自动解锁下游**；原子校验在创建时拒绝模糊任务；不可变快照（SHA-256）
保证长会话可恢复。

## 你能得到什么

- **13 个 `octie_*` 模型工具** + `octie` Cordis 服务 + `octie/*` 事件——在 DSH 会话里
  直接规划、执行、追踪任务图
- **DSH 客户端任务面板**：列表 + 分层 DAG 图视图、项目活跃度排序、实时同步、图物理开关
- **「Octie 任务图模式」agent preset**：随插件自动预置，开箱即用的任务图工作模式
- **`octie` 使用技能**：按需加载的完整用法手册（心智模型 / 不变式 / 模式库 / 陷阱）
- **独立 CLI 与 Web UI**：`octie serve` 启动随附的网页界面，脱离 DSH 也能用

## 安装（DSH）

要求 Node.js ≥ 20。

**推荐：npm 包**（预构建，秒级安装）：

```sh
dsh plugin --profile <name> add octie-cli
```

**或直接从 GitHub 安装**（仓库随附构建产物，开箱即用）：

```sh
dsh plugin --profile <name> add github:StarChen-Cycler/octie-dsh-plugin
```

安装后重启 DSH：插件会自动预置「Octie 任务图模式」（见下文），`cordis.patch.yml`
挂载 `octie-dsh` 插件行，13 个工具与 `octie` 技能即时可用。

## 客户端任务面板

- **项目活跃度排序**：项目下拉按「最近任务更新时间」排序——最近动过的项目自动浮到
  顶部并被面板默认选中；侧边栏树按子树内最新活动排名，活跃子项目会把父项目组一起
  顶上去。
- **实时同步**：会话内 `octie_*` 工具变更秒级推送到面板（列表 + 图 + 下拉同步刷新）；
  外部写入（终端 `octie` CLI、Web UI、其他 DSH 会话）也会被自动检测并实时刷新。
- **图物理开关**：图视图右上角的 `Physics` 开关——开启时小球受力（扰动后弹回平衡布局、
  拖拽带动邻居、松手回弹）；关闭时所有节点丝滑滑回整齐的无受力布局后定格。

## Octie 任务图模式

插件自带一个 DSH agent preset 模板，安装后自动预置到你的用户 preset 目录
（`$DSH_HOME/.agent-presets/octie/`），**已存在则绝不覆盖**：

- persona 直接注入 Octie 心智模型与工作流程（图是持久真相、原子任务、显式绝对
  `project` 路径、审批门、先可用再迭代）
- 要求 agent 在第一次调用 `octie_*` 工具前先读取 `octie` 技能全文
- 新建会话时在模式选择器中选择「Octie 任务图模式」即可使用

## 用法

任务图组件的完整用法（工具签名、绝对路径约定、不变式、模式库、陷阱）见
[`skills/octie/SKILL.md`](skills/octie/SKILL.md)。

## License

MIT（沿用上游）

## 给开发者

开发相关内容——环境搭建、构建与测试、CI、dist 提交策略、发布流程、架构文档索引——
请见 [`docs/development.md`](docs/development.md)。
