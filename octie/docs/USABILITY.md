# Octie 易用性评估报告（USABILITY.md）

> 来源：在「把 Octie 重构成 DSH bundle 插件」的过程中，以真实用户身份驱动 Octie
> CLI（创建/维护任务图、跑测试、发版准备）所收集的摩擦点。
> 每条含严重度（High/Medium/Low）与影响说明；「已修复」指本分支已实现的改进。

## 已修复（本分支实现）

### F1 · 原子写瞬时锁重试不足 — High
- **现象**：Windows 上 AV/备份流瞬时锁定 `project.json` 时，`rename` 报 EPERM 导致
  `octie update`/`approve` 直接失败（本次开发中真实撞到 2 次，测试套件中也偶发）。
- **影响**：一次瞬时锁 = 一条命令失败，用户必须手动重试；脚本管道会中断。
- **修复**：`renameWithRetry` 从「3 次 50ms 起」加强为「5 次 100ms 起、倍增、上限 1.6s」，
  并抽成可单测的纯函数（`tests/unit/core/storage/rename-retry.test.ts`）。
- **兼容性**：纯内部策略加强，CLI 行为不变。

### F2 · 全局注册表只增不减 — Medium
- **现象**：`~/.octie/projects.json` 会积累删除过的项目、改名目录、以及工具/测试注册的
  临时项目。本次开发中发现真实注册表被撑到 **451 条**，其中 **407 条指向已删除的
  Temp 目录（90% 是垃圾）**。
- **影响**：Web UI 首页/侧栏切换列表被垃圾淹没；无法分辨真实项目。
- **修复**：新增 `pruneStaleProjects()` + **`octie registry prune`** 命令：扫描并移除
  路径已不存在的条目，仅在确有删除时落盘（`tests/unit/core/registry/prune.test.ts`）。
- **兼容性**：纯新增命令；真实项目（路径存在）永不被触碰。

### F3 · 无服务器时仍空等缓存失效探测 — Medium
- **现象**：每条写命令尾部都会向 `localhost:3456` 发 `/api/cache/invalidate` 探测；
  从未运行过 `octie serve` 时这是**纯空等**（750ms 超时），每命令累加延迟；若端口上
  有遗留/挂死的进程，延迟更严重（本次全量测试的不稳定主因之一）。
- **影响**：脚本/测试里每条写命令白付 ~750ms；慢机器上加剧超时抖动。
- **修复**：`invalidateProjectCache` 在「无 `OCTIE_SERVER_URL` 且无
  `~/.octie/.last-server-url` 文件」时**直接跳过探测**；默认超时 750ms→250ms
  （`tests/service/engine-cache.test.ts`）。
- **兼容性**：有服务器运行时行为不变；从未运行过服务器时不再有无效网络探测。

## 待观察 / 建议后续处理

### F4 · `create` 与 `update` 的 blockers 语义不对称 — Medium
- `octie create` 接受逗号分隔多 blockers；`octie update --blockers` 一次只接受一个
  （错误信息不错，但 `create -h` 未说明两者差异）。
- **影响**：脚本作者按 create 的习惯写 update 会踩错；心智模型不统一。
- **建议**：在 `update -h` 与 `create -h` 中互相注明差异，或长期统一为「一次一个、
  每个带各自 explanation」。

### F5 · 标题动词白名单（197 个）只能靠报错发现 — Medium
- `Author`/`Run` 等常见动词被拒，用户只能在**被拒之后**从错误信息里看到完整列表。
- **影响**：第一次创建任务的用户几乎必然撞一次；报错路径是唯一的文档。
- **建议**：`octie create -h` 中内联动词列表（或前 50 个 + 指向完整列表）；service 层
  返回结构化 violations 以便 bundle 工具给模型更友好的提示。

### F6 · `delete`/`merge` 在非交互终端静默取消 — Medium
- 非 TTY 下 `confirmPrompt` 读到 EOF → 按「否」处理 → `exit(0)`，**静默 no-op**。
- **影响**：CI/脚本里误用无 `--force` 的 delete 会「成功但不做任何事」，很难排查。
- **建议**：非 TTY 且无 `--force` 时改为报错并提示加 `--force`（显式破坏比静默成功安全）。

### F7 · `octie.ps1` shim 把 banner/chalk 输出写到 stderr — Low
- Windows 下全局 shim 的 banner 与部分 chalk 输出进 stderr，污染脚本的 stderr 捕获。
- **影响**：日志聚合里噪音；`2>&1` 抓输出时掺杂 ANSI。
- **建议**：shim 层面避免 banner（或仅在 TTY 显示）；核心库输出统一 stdout。

### F8 · `ready` 与 `--without-blockers` 语义易混 — Low
- `ready` = 无 blocker 且前提满足；`without-blockers` = 只是没设 blockers。两者名字
  相近但含义不同（octie-dev skill 里要专门写一段解释）。
- **影响**：找活时可能选中实际被前置依赖卡住的任务。
- **建议**：文档/usage skill 强调；`find` 输出中可附「真正可开工」标记。

### F9 · 全量测试套件与本地环境的相互作用 — Low
- execSync 型 CLI 测试在本机 3456 端口有遗留 `octie serve` 时会变慢/超时；全量并行
  + 慢磁盘偶发超时。
- **缓解**：`vitest.config` 注入 `OCTIE_CACHE_INVALIDATE_TIMEOUT_MS=50`、超时 10s→30s、
  新增 `npm run test:core`（15s/279 例进程内核心子集）作为迭代门禁。

## 统计

- 记录发现：9 条（High 1 / Medium 5 / Low 3）。
- 本分支已修复：3 条（F1/F2/F3），全部带测试且保持 CLI 表面向后兼容。
- 建议后续：6 条（F4–F9），其中 F6 属于破坏性 UX 变更，需单独评估后再动。

## 维护期后记（2026-08）

本报告写成后的易用性增量：DSH 面板的项目下拉改为按最近任务更新时间排序（解决
「项目多时难找活跃项目」）、外部变更 3 秒轮询实时刷新（解决「终端改了面板不更新」）、
图视图 Physics 开关（解决「力反馈不可见/不可控」）、随插件预置「Octie 任务图模式」。
F9 的测试数已更新（`test:core` 302 例、全量 793 例），见 `docs/development.md`。
