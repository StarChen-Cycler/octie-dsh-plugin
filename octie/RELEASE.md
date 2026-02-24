# Octie CLI 发布指南

## 发布流程

### 1. 准备发布

```bash
cd octie

# 确保代码是最新的
git pull

# 构建并测试
npm run build
npm test
```

### 2. 更新版本号

编辑 `package.json`，修改 version:
```json
"version": "1.0.4"
```

### 3. 发布到 NPM

```bash
npm publish --access public --ignore-scripts
```

### 4. 推送到 GitHub

```bash
git add .
git commit -m "release: v1.0.3"
git push
```

### 5. 创建 GitHub Release

1. 打开 https://github.com/StarChen-Cycler/octie/releases
2. 点击 "Draft a new release"
3. 选择标签 (v1.0.2)
4. 填写发布说明
5. 发布

---

## 下次发布

下次发布版本号: 1.0.3

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
