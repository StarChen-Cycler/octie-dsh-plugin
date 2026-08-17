# 修改 Preset 上下文 · 路径手册

> 本文记录「Octie 任务图模式」preset 上下文的修改路径。
> 原随包注册的 `octie` usage skill **已随 1.2.3 移除**（其限定的开发逻辑不够准确，
> 待重写后按 §2 的 checklist 重新引入）；本手册聚焦 preset 侧，skill 相关章节保留为
> 重写时的落地指引。

## 0. 上下文资产总览（1.2.2/1.2.3 之后）

| 资产 | 生效副本（谁在用它） | 打包模板（发布出去的） | 读取/注册点 |
|---|---|---|---|
| **Preset 组合**（`agent.cordis.yml` + `preset.yml`） | `$DSH_HOME/.agent-presets/octie/`（本机：`C:\Users\LENOVO\.dsh\.agent-presets\octie\`） | 仓库 `octie/preset/octie-mode/` | roster 实时扫描目录发现；session 创建时挂载 |
| **模板版本戳**（`.octie-template.json` 侧车） | 同上目录 | — | 插件写入；`/api/octie/preset/status` 读取比对 |
| **Skill**（原 `SKILL.md`） | — | **已移除**（1.2.3） | — |
| **预置逻辑** | 运行中的插件代码 | `octie/plugin/index.mjs` `ensureOctiePreset()` | 插件 `apply()` 时执行，幂等 |

生效语义三句话：

1. **Preset**：改了只影响**之后新建**的会话；运行中的会话留在自己挂载的旧组合上
   （换模式仅限空白会话）。
2. **模板 → 用户副本**：首次安装时复制，之后**只经用户同意才覆盖**——设置页
   「Octie 预设维护」卡片比对 `templateVersion` + SHA-256 漂移，提供「更新 / 保持当前」
   两个按钮（1.2.2 的 consent-gated 流程，覆盖是唯一入口，启动时绝不自动写）。
3. **Skill**：无——重写后再议。

## 1. 修改路径 A：改"模式"提示词（persona / 心智模型 / 工作流程）

改的是 `agent.cordis.yml` 中 `persona` 行的 `config.text`（`- id: persona` 在文件
22–55 行附近）。

**改哪一份，取决于要影响谁：**

| 目标 | 改哪里 | 生效范围 |
|---|---|---|
| 只影响本机 | `C:\Users\LENOVO\.dsh\.agent-presets\octie\agent.cordis.yml` | 本机新建会话（本机改动会被漂移检测识别，卡片给出覆盖提示，可「保持当前」） |
| 影响所有（新）装机 | 仓库 `octie/preset/octie-mode/agent.cordis.yml` | 之后安装的机器 + 老机器经设置卡片同意后 |

**流程：**

1. 编辑 persona `config.text`（YAML `>-` 折叠标量：换行折叠为空格，空行保留为换行；
   缩进必须保持在 `text:` 之下）。
2. 同步改 `preset.yml` 的 `description`（选择器里显示的描述，与 persona 口径一致）。
3. **升 `templateVersion`**（`preset.yml` 的整数字段；roster 忽略它，更新卡片靠它比较）
   ——否则老机器不会收到更新提示。
4. 挂载验证：`standingKeyFor('octie')` 必须返回成功（方式见 §4）。
5. 新会话验收：新建会话选「Octie 任务图模式」，确认首屏 persona 与工具清单。
6. 同步更新 README 的「Octie 任务图模式」章节（如果行为描述变了）。

**红线：**

- 绝不编辑 shipped 安装（`@deepseek-ai/dsh/config/agent-presets/{standard,code,minimal,cordis}`）。
- persona 以外的行保持 standard 全量结构；若新增**发布服务**的插件行，必须包在带
  `isolate` realm 的组里，否则挂载审计拒绝。
- persona 中引用的一切（工具名、技能名、路由）必须与包内实际存在的资产一致——
  引用不存在的东西会让 agent 按错误指示行动。

## 2. 修改路径 B：重写并重新引入 usage skill（待办）

旧 skill 已随 1.2.3 整体移除（代码、文件、测试、files 字段、文档引用全部清掉）。
重写后重新引入时的落地 checklist：

1. 新文件：`octie/skills/octie/SKILL.md`（frontmatter `name/description/whenToUse`）。
2. `octie/plugin/index.mjs`：恢复 `registerSkill(ctx, disposers)`（正文
   `readFileSync` + `stripFrontmatter`；`ctx.get('skills', false)` **非严格探测**——
   严格探测在 provider fiber 晚激活时静默跳过注册，见 1.2.1 修复记录）。
3. `octie/package.json` `files` 数组加回 `"skills"`。
4. `octie/tests/unit/plugin/bundle.test.ts`：恢复注册断言用例。
5. 文档：README / `docs/dsh-plugin-usage-principles.md` / `octie/docs/CORDIS-INTEGRATION.md`
   / `octie/docs/CLI-COMMAND-COVERAGE.md` 的移除注记改回。
6. **重启 DSH 后**新会话验收：技能目录里能加载，内容与新版一致。

## 3. 修改路径 C：改预置逻辑 / 模板交付

预置器在 `octie/plugin/index.mjs`：

- `PRESET_ID = 'octie'`、`PROVISION_HOOK = 'OCTIE_NO_PRESET_PROVISION'`、
  `PRESET_STAMP = '.octie-template.json'`
- `ensureOctiePreset(ctx)`：roster 探测优先（非严格 get；任何 root 已有 id=`octie`
  即跳过；`authorable === false` 不猜路径）→ 直接写 `$DSH_HOME/.agent-presets/octie/`
  （缺 `agent.cordis.yml` 才写，写前 mkdir，模板拷贝自 `preset/octie-mode/`，**写完落
  版本戳**）。
- `presetStatus()` / `updatePresetFromTemplate()`：consent-gated 更新（1.2.2）。
  状态 = provisioned / bundledVersion / installedVersion / drifted / updateAvailable；
  更新只在 `/api/octie/preset/update` 被调用时执行，覆盖两份文件并重写戳。

**规则（当前约定）：**

- **幂等**：已存在绝不自动覆盖；卸载插件不删除已预置 preset（落盘即用户数据）。
- **升级语义**（1.2.2 起）：模板更新经设置页卡片告知用户，**用户点了才覆盖**；
  「保持当前」按版本号记忆，下次 bump 再提示。用户改过副本会弹红色覆盖警告。
- **打包**：模板目录随 `package.json` 的 `files`（含 `preset/`）进 npm 包；新增/删除
  模板文件记得同步。
- **测试钩子**：`OCTIE_NO_PRESET_PROVISION=1` 跳过预置（bundle 测试套件全局设置）。

## 4. 挂载验证（每次改 preset 后必做）

`roster 的 broken 字段只是形状检查，不是可用性证明`。真实审计用 `standingKeyFor(id)`：

1. 用临时动态插件（`cordis_define`/`cordis_run`，注入 `agentPresets`，注册一个
   `preset_admin` 式工具）调 `agentPresets.standingKeyFor('octie')`。
2. 返回成功 = 全部行解析、无服务发布到全局 realm、无等待中的消费者。
3. 用完 `cordis_undefine` 卸载探针。

（上次验证记录：`mounted OK`，roster 5 项、octie 为 user trust 无 broken。）

## 5. 验证清单（每次改动对照）

- [ ] 本机挂载验证 `standingKeyFor('octie')` 通过
- [ ] `bundle.test.ts` 通过（预置 / 幂等 / roster 跳过 / 事件轮询 / 活跃度排序 /
      preset status-update 用例）
- [ ] 全量 `npm test` 通过；CI 三平台绿
- [ ] 新会话验收：13 个 `octie_*` 工具 + persona 首屏
- [ ] README「Octie 任务图模式」章节与本手册路径表同步
- [ ] 模板改动时 `templateVersion` 已 +1（否则老机器无感知）

## 6. 已知不成熟点（待定规则的清单）

1. ~~**模板 ↔ 用户副本漂移**~~ —— **已解（1.2.2）**：版本戳 + SHA-256 漂移检测 +
   consent-gated 更新卡片。
2. **persona 是 standard 的全量快照**：DSH 升级给 standard 加行，本模式不会自动继承；
   需周期性对照 shipped `standard/agent.cordis.yml` 手工同步。
3. **复制预设丢失版本戳**：roster 的「复制」会重写 `preset.yml`（只保留
   name/description/order），副本 `templateVersion` 归零 → 卡片对副本一直提示可更新
   （副本不在官方 octie 目录时无影响，属知悉项）。
4. **换模式仅限空白会话**：产品规则（防止历史工具调用无法重放），不是 bug。
5. **更新生效时机**：覆盖后仅**新建会话**吃到新模板，运行中会话不受影响——文档已注明，
   代码无热挂载通道。

## 7. DSH 升级兼容性（参考）

> 记录于 2026-08：分析基于当前 DSH 版本线（0.1.0-rc）与 octie 插件的实际依赖面。

**依赖面事实**：Node 半边（`plugin/index.mjs`）只 import Node 内置模块与自家
`../dist/index.js`，零个 `@deepseek-ai/dsh-*` 包依赖；与 DSH 的全部接触都走运行时
服务契约（`ctx.tools.register` / `ctx.provide` / `ctx.emit` / `webServer.register` /
`ctx.get('agentPresets', false)`）与客户端平台契约
（`window.__ModuleLoader__` + slot 树）。

| 组件 | 升级后命运 | 原因 |
|---|---|---|
| 安装状态（profile bundles、`cordis.patch.yml`、用户 preset、`~/.octie` 数据） | 永远在 | 都在用户 home（`$DSH_HOME`），DSH 升级只替换应用本体，不碰 profile / 数据目录 |
| Node 半边（13 工具、`octie` 服务、`/api/octie/*`、SSE、预置） | 同版本线内稳 | 零 dsh-* 包 import；预置器对 `agentPresets` 有 try/catch 直写兜底 |
| 客户端面板（`client.js`） | 皮肤级升级稳；大版本有风险 | 依赖 `window.__ModuleLoader__` 协议 + `sidebar.footer.action` / `shell.overlay` / `settings.section` 槽位；loader 协议或槽位被改/删则挂不上（工具层不受影响） |
| Octie 任务图模式 preset | 已知漂移点 | 携带 standard 全量行快照、按名引用 host 的 dsh-* 包；DSH 改名/删包 → 新会话挂载失败（运行中会话无恙）；DSH 加行则不自动继承 |
| 3456 独立前端 | 零关系 | 独立进程、独立包 |

**升级后检查清单：**

1. 重启 DSH：面板在不在、工具列表是否有 13 个 `octie_*`。
2. 新建会话选「Octie 任务图模式」：进得去 = preset 无恙；进不去 = 按 §1 的修复路径
   处理（从新版 shipped standard 重新复制 → 重贴 persona 块 → `standingKeyFor` 挂载验证）。
3. 设置页「Octie 预设维护」卡片查看模板是否有更新待确认。

**结论**：数据永不失效；能力在 DSH 同一版本线内预期稳定；大版本跳跃时最多是面板
注册点或 preset 快照需要一次对照修复，工具链始终活着。
