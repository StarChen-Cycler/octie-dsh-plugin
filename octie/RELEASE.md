# Octie CLI 发布指南

## 发布流程

### 1. 准备发布

```bash
cd octie

# 确保代码是最新的
git pull

# 测试（构建会在发布时由根目录 prepack 自动执行）
npm test
```

### 2. 更新版本号（三处必须同步）

发布的是根 package.json（`files: ["octie"]`），但运行时版本来自 `octie/package.json`，
openapi.yaml 的 `info.version` 也要同步，否则会漂移（历史上曾停在 1.2.0）。

```bash
# 在仓库根目录执行
V=1.2.4
npm pkg set version=$V                       # 根 package.json
npm --prefix octie pkg set version=$V        # octie/package.json
sed -i "s/^  version: .*/  version: $V/" octie/openapi.yaml   # 只匹配 info.version（两空格缩进）
```

### 3. 发布到 NPM

**从仓库根目录执行**（不是 `octie/` — 发布的是根 package.json，`files: ["octie"]`）:

```bash
cd ..   # 回到仓库根目录
npm publish --access public
```

注意：不要加 `--ignore-scripts`。根 package.json 的 `prepack` 会在打包前自动执行
`npm --prefix octie run build`（含 web-ui 的 vite 构建），保证 `octie/dist/web-ui`
一定进入 tarball。加 `--ignore-scripts` 会跳过这一步，导致 `octie serve` 没有
网页界面可服务（见仓库根目录 octie-serve-webui-bug-report.md）。

### 4. 推送到 GitHub

```bash
git add .
git commit -m "chore(release): octie-cli 1.3.0"
git push dsh-plugin HEAD:main   # 发布线是 octie-dsh-plugin 仓库的 main；不要推 origin（旧线仓库）
```

### 5. 创建 GitHub Release（tag + release 都在 octie-dsh-plugin 仓库）

```bash
git tag -a v1.3.0 -m "Release v1.3.0"
git push dsh-plugin v1.3.0
gh release create v1.3.0 -R StarChen-Cycler/octie-dsh-plugin --title "v1.3.0" --notes "..."
```

---

## 下次发布

下次发布版本号: 1.3.1（patch）/ 1.4.0（有新功能时）

---

## 常见问题

### NPM Token 设置

如果遇到 403 错误，需要设置 NPM token:

```bash
npm config set //registry.npmjs.org/:_authToken 你的token
```

Token 需要在 https://www.npmjs.com/settings/tokens 创建，需启用 "Publish" 权限。

### 包名

- 当前包名: `octie-cli`
- 安装命令: `npm install -g octie-cli`
- 使用命令: `octie`

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-02-22 | 首次发布 |
| 1.0.1 | 2026-02-22 | 移除未使用依赖，53MB → 11MB |
| 1.0.2 | 2026-02-20 | 修复 web UI 过滤器，CLI 优化 |
| 1.0.3 | 2026-02-24 | 与 GitHub 同步 |
| 1.0.4 | 2026-02-24 | 结构化 README，token-efficient md 格式，knowledge graph 模式 |
| 1.1.0 | 2026-07-22 | octie-dsh-plugin 线首次发布（DSH bundle 插件化，13 个 octie_* 工具） |
| 1.2.0 | 2026-08-15 | 面板 DAG 视图、交叉最小化布局、GitHub 直装、预设预置 |
| 1.2.1 | 2026-08-17 | 面板实时同步强化、图物理死循环修复 |
| 1.2.2 | 2026-08-17 | 预设模板版本戳与设置页更新同意卡片 |
| 1.2.3 | 2026-08-17 | 修复 npm tarball 缺 dist/web-ui 导致 octie serve 302（.npmignore + prepack） |
| 1.2.4 | 2026-08-27 | 预设 persona 行迁移到 0.1.5 契约 |
| 1.3.0 | 2026-09-18 | 收敛轮：need_fix 三态（open/done/withdrawn，旧数据读时迁移）、approve 刷新 completed_at、原子校验报错带条目位置并透出 DSH 工具、blockers 单值类型报错、octie_get 字段过滤、octie_update 删除验收标准/交付物、快照恢复文档 |
