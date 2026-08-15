# 开发须知（Development Guide）

> 本文是开发者的入口文档。README 只面向用户；开发环境、构建、测试、CI、
> dist 提交策略、发布与架构文档索引都在这里。规则若与本手册冲突，以本手册为准。

## 1. 仓库布局

| 路径 | 是什么 |
|---|---|
| `octie/` | 插件包本体：`plugin/index.mjs`（DSH Node half）、`client.js`（DSH 面板）、`src/`（octie-core + CLI + web 路由）、`skills/octie/SKILL.md`、`preset/octie-mode/`（预置 preset 模板）、`web-ui/`（独立前端） |
| 根 `package.json` | **facade 包**：镜像 `octie/package.json` 的 exports / dsh.bundle / bin 契约并把路径指进 `octie/`，让 `dsh plugin add github:…` 能解析到插件；不含 workspaces，避免影响 `octie/` 内的 `npm ci` |
| `docs/` | 开发文档（本文件 + `preset-skill-maintenance.md`；`docs/*` 默认 gitignore，逐个白名单放行） |
| `.github/workflows/ci.yml` | CI：ubuntu / windows / macos 三平台矩阵 |

## 2. 环境与日常命令

要求 Node.js ≥ 20。所有命令在 `octie/` 下执行：

```sh
cd octie
npm install
npm run build            # 全量：build:cli（tsc → dist）+ build:web（vite → dist/web-ui）
npm run build:cli        # 只重建 Node 侧产物
npm run typecheck        # tsc --noEmit
npm run test:core        # 快速核心子集（302 例）
npm run test:smoke       # 存储 / web-api 子集
npm test                 # 全量门禁（793 例）
node dist/cli/index.js --help
```

改 `client.js` 无需构建（浏览器直读）；改 `plugin/index.mjs` 无需构建（Node 直读，但 DSH
需重启）；改 `src/**` 需要 `npm run build:cli`。

## 3. dist 提交策略（重要）

**`octie/dist/` 是提交进仓库的**，排除 `.map` 调试文件。原因：

- npm 的 git 依赖安装只打包 **git 已跟踪的文件**（`prepare` 在克隆里建的产物会被丢弃），
  这是本仓库实测确认的 npm 10 行为。
- 要让 `dsh plugin add github:StarChen-Cycler/octie-dsh-plugin` 开箱即用，dist 必须在
  仓库里。社区同类做法：无发布设施的小工具 / 需要 bootstrapping 的仓库（如 TypeScript
  提交 lib/）会提交构建产物；有 npm 发布的库才不提交。

**纪律**：

1. 改了 `src/**`（或影响构建输入的任何文件）后：`npm run build` 并把 `octie/dist/`
   一起提交。
2. **CI 防漂移门禁**：build 之后 `git diff --exit-code -- octie/dist`，产物与提交不一致
   即红——依赖它兜底，不要手动绕过。
3. 行尾：根 `.gitattributes` 强制 `*.html/*.js/*.css/*.ts/*.md/*.yml` 以 LF 入库。
4. 只提交产物本身，不提交 `.map`（`octie/.gitignore` 内有 `dist/**/*.map`）。
5. **不提交 `dist/web-ui/`**（vite 产物）：其 html 输出跨平台/跨 Node 版本不逐字节
   确定（vite 保留源码行尾），进提交会让漂移门禁必红。只有 `octie serve` 的网页界面
   需要它；npm tarball 发布时 `prepack` 会重建并带上它，GitHub 直装则不带（serve 无
   UI，DSH 插件与 CLI 不受影响）。
6. 发布 npm 时 `prepack` 会重新构建，tarball 走 `files` 白名单——与提交 dist 不冲突，
   两路并存。

## 4. CI

`.github/workflows/ci.yml`：`strategy.matrix.os` = ubuntu / windows / macos，
`fail-fast: false`；每平台依次：`npm ci`（octie）→ `npm ci`（web-ui，独立包）→
typecheck → build → test:smoke → `npm test` → **dist 漂移门禁**。

本地全量 ≈ 3 分钟，CI 三平台 ≈ 3–5 分钟。

## 5. 发布

- **npm**（推荐给最终用户，秒级安装）：`cd octie && npm publish`（`prepublishOnly`
  会先 build + 全量测试；tarball 已实测 991 KB / 133 文件，含 dist/plugin/client/
  preset/skills）。发布后：DSH 用户 `dsh plugin add octie-cli`；CLI 用户
  `npm install -g octie-cli`（同一包，两条接口共用）。
- **GitHub Releases**（无 npm 账号时的备选）：把 `npm pack` 产物 tgz 挂到 Release，
  用户以 tarball URL 安装。
- **GitHub 直装**：随附 dist，直接可用（见 README）。

## 6. 架构与专题文档索引

| 文档 | 内容 |
|---|---|
| `docs/preset-skill-maintenance.md` | preset / skill 上下文的三条修改路径、挂载验证、验证清单、已知不成熟点、DSH 升级兼容性 |
| `docs/cli-usage-principles.md` | CLI 项目使用基本原则（源自 `.agents/skills/octie-*` 的提炼）：建任务 / 建依赖 / 图操作 / 执行审批 / need_fix 规范 |
| `docs/dsh-plugin-usage-principles.md` | DSH 插件（13 个 `octie_*` 工具）使用原则：CLI 原则的工具层对应版 + 对照速查表 |
| `docs/octie-dsh-plugin-refactor.md` | 从原 Octie 到 DSH 插件的完整改造设计（选型、API 设计、长期架构） |
| `octie/docs/USABILITY.md` | 易用性评估（9 条发现，3 条已修复） |
| `octie/docs/AUDIT.md` | 发布前 5 面审计记录（5/5 通过） |
| `octie/docs/CORDIS-INTEGRATION.md` | Cordis 接入机制与踩坑记录 |

## 7. 与上游的关系

本仓库派生自 `StarChen-Cycler/octie`（v1.1.0，`3dabe98`），在独立分支
`octie-dsh-plugin` 上完成插件化改造；**上游仓库未做任何改动**。CLI 行为与上游逐字节
兼容（全量测试零期望改动）。推送一律走
`git push https://github.com/StarChen-Cycler/octie-dsh-plugin.git octie-dsh-plugin:main`，
**严禁推送到上游 origin**。
