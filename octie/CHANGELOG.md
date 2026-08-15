# Changelog

## 维护期增量（2026-08，octie-dsh-plugin 分支）

- DSH 客户端任务面板：列表 + 分层 DAG 图视图（barycenter 交叉最小化 + 力导向微调）
- 项目活跃度排序（`.octie/project.json` mtime 信号，面板下拉与 Web API 同步）
- 实时同步：会话内 SSE 秒级推送 + 外部写入 3 秒 mtime 轮询
- 图物理开关（Physics）：开启受力/扰动回弹，关闭丝滑滑回整齐布局
- 随插件预置的「Octie 任务图模式」agent preset（幂等，`OCTIE_NO_PRESET_PROVISION=1` 退出）
- GitHub 直装可用：`octie/dist` 提交进仓库（除 .map 与 web-ui）+ 根 facade 镜像运行时依赖 + CI 漂移门禁
- CI 三平台矩阵（ubuntu/windows/macos）；文档重构（README 用户向 + docs/development.md + docs/preset-skill-maintenance.md）

## v1.1.0 (2026-08)

- 重构为 DeepSeek Harness（DSH）bundle 插件：`octie` Cordis 服务（17 方法 + `onChange`）、
  13 个 `octie_*` 模型工具、`octie/*` 事件、DSH 客户端任务面板、`octie` 使用技能
- 提炼 DSH 无关的 service 层（`src/service/`），CLI 与插件同源
- 发布前 5 面审计通过（见 `octie/docs/AUDIT.md`）

## v1.0.4 (2026-02-24)

- Structured README with actual implementation details
- Token-efficient markdown output format
- Knowledge graph visualization export (PNG/SVG)
- Snapshot history pruning and retention
- Deliverable validation capped at 10
- Git Bash path normalization across commands

## v1.0.3 (2026-02-24)

- Synced with GitHub repository
- Web UI project registry improvements

## v1.0.2 (2026-02-20)

- Fixed web UI filter panel behavior
- CLI output formatting optimizations

## v1.0.1 (2026-02-22)

- Removed unused dependencies (53MB -> 11MB)
- Package size optimization

## v1.0.0 (2026-02-22)

- Initial public release
- CLI for graph-based task management
- File-backed storage under `.octie/`
- Automatic task status calculation
- Web server with React UI (Kanban + Graph views)
- Import/export for JSON and Markdown
- Snapshot history with restore
- Global project registry
