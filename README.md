# octie-dsh-plugin

<p align="center">
  <img src="octie-harness-2.jpg" alt="Octie Harness — DSH bundle plugin" width="100%">
</p>

**Octie，重构为 DeepSeek Harness（DSH）可安装的 bundle 插件。**

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
  （17 方法 + `onChange`）、注册 **13 个 `octie_*` 模型工具**、发出 `octie/*` 事件。
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

## 开发

```sh
cd octie
npm install
npm run build:cli        # tsc → dist/
npm run test:core         # 快速核心子集（~15s，289 例）
npm test                  # 全量门禁（780 例）
node dist/cli/index.js --help
```

## 文档

- [`docs/octie-dsh-plugin-refactor.md`](docs/octie-dsh-plugin-refactor.md) —— 从原 Octie 到 DSH 插件的完整改造设计（选型、API 设计、长期架构）。
- [`octie/docs/USABILITY.md`](octie/docs/USABILITY.md) —— 易用性评估（9 条发现，3 条已修复）。
- [`octie/docs/AUDIT.md`](octie/docs/AUDIT.md) —— 发布前 5 面审计记录（5/5 通过）。
- [`.memo/memodocs/`](.memo/memodocs/) —— 本改造的 user/tech specs 与 Octie 任务图规划。

## 与上游的关系

本仓库派生自 `StarChen-Cycler/octie`（v1.1.0，`3dabe98`），在独立分支 `octie-dsh-plugin`
上完成插件化改造；**上游仓库未做任何改动**。CLI 行为与上游逐字节兼容（全量测试零期望改动）。

## License

MIT（沿用上游）
