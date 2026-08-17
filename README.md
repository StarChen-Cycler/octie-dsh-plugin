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

## 两种使用方式

Octie 同时是**两条并行的一等接口**，共享同一份任务图存储（`.octie/project.json`），
可随时互换使用：

| 方式 | 形态 | 适合 |
|---|---|---|
| **独立 CLI / Web UI** | 全局安装 `octie` 命令 + `octie serve` 网页界面 | 终端驱动、脚本管道、不需要 DSH 的场景 |
| **DSH bundle 插件** | 13 个 `octie_*` 模型工具 + Cordis 服务 + 任务面板 + 预置 agent preset | 让 DSH agent 直接在会话里规划、执行、追踪任务图 |

## 你能得到什么

- **独立 CLI（`octie`）与 Web UI（`octie serve`）**：不装 DSH 也能用，见下文
  「CLI 独立使用」
- **13 个 `octie_*` 模型工具** + `octie` Cordis 服务 + `octie/*` 事件——DSH 会话里
  直接规划、执行、追踪任务图
- **DSH 客户端任务面板**：列表 + 分层 DAG 图视图、项目活跃度排序、实时同步、图物理开关
- **「Octie 任务图模式」agent preset**：随插件自动预置，开箱即用的任务图工作模式
- **`octie` 使用技能**：按需加载的完整用法手册（心智模型 / 不变式 / 模式库 / 陷阱）

## CLI 独立使用

要求 Node.js ≥ 20。

```sh
# 安装（npm，已发布）
npm install -g octie-cli

# 或从源码构建（开发向，详见 docs/development.md）
git clone https://github.com/StarChen-Cycler/octie-dsh-plugin
cd octie-dsh-plugin/octie && npm install && npm run build:cli
```

快速上手：

```sh
octie init                                   # 初始化项目（创建 .octie/）
octie create \
  --title "Implement login endpoint" \
  --description "POST /api/auth/login：校验凭据、签发 JWT。" \
  --success-criterion "Returns 200 with JWT for valid credentials" \
  --deliverable "src/api/auth/login.ts"
octie list --format md                        # 查看任务
octie update <id> --complete-criterion <cid>  # 维护进度
octie approve <id>                            # 审批：BFS 解锁下游
octie serve                                   # 网页界面（默认 3456 端口）
```

CLI 的完整使用原则（建任务 / 建依赖 / 图操作 / 执行审批 / need_fix）见
[`docs/cli-usage-principles.md`](docs/cli-usage-principles.md)。

## 安装（DSH）

要求 Node.js ≥ 20。

**推荐：npm 包**（预构建，秒级安装）：

```sh
dsh plugin --profile <name> add octie-cli
```

**或直接从 GitHub 安装**（仓库随附构建产物，开箱即用；不含 `octie serve` 的网页界面
资源，如需使用自行构建）：

```sh
dsh plugin --profile <name> add github:StarChen-Cycler/octie-dsh-plugin
```

安装后重启 DSH：插件会自动预置「Octie 任务图模式」（见下文），`cordis.patch.yml`
挂载 `octie-dsh` 插件行，13 个工具与 `octie` 技能即时可用。

DSH 插件层的使用原则（13 个 `octie_*` 工具的用法规范）见
[`docs/dsh-plugin-usage-principles.md`](docs/dsh-plugin-usage-principles.md)。

## 更新（Update）

两条接口各自更新，**先全局 CLI、再 DSH 插件**（顺序反了有旧全局包遮蔽问题，见下）：

```sh
# ① 独立 CLI（终端 + octie serve）
npm update -g octie-cli
octie --version                        # 确认 ≥ 1.2.1

# ② DSH bundle 插件
dsh plugin --profile <name> update octie-cli

# ③ 验证挂载形态（应为 bundle 层，而非 plain dependency）
dsh --profile <name> --dump-config | grep -i octie

# ④ 重启 DSH 后刷新网页（Node 侧改动必须重启才生效）
```

两个已知坑：

- **旧全局包遮蔽**：全局 `octie-cli` 若停留在 1.2.0 之前（尚无 `dsh.bundle` 声明的
  版本），DSH 会读到旧 manifest 并把插件当普通依赖安装——面板与工具静默失效。先更新
  全局 CLI，再 `dsh plugin ... update` 一次即可恢复；完整排查见
  [`octie/TROUBLESHOOTING.md`](octie/TROUBLESHOOTING.md)。
- **git URL 安装**：当初用什么来源 `add`，`update` 就带同一个来源（
  `dsh plugin --profile <name> update github:StarChen-Cycler/octie-dsh-plugin`），
  否则两条安装路径会并存。

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
[`skills/octie/SKILL.md`](skills/octie/SKILL.md)。分接口的使用原则：

- **CLI**：[`docs/cli-usage-principles.md`](docs/cli-usage-principles.md)
- **DSH 插件工具**：[`docs/dsh-plugin-usage-principles.md`](docs/dsh-plugin-usage-principles.md)

## License

MIT（沿用上游）

## 给开发者

开发相关内容——环境搭建、构建与测试、CI、dist 提交策略、发布流程、架构文档索引——
请见 [`docs/development.md`](docs/development.md)。
