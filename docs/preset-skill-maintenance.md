# 修改 Preset 与 Skill 上下文 · 路径手册

> 本文记录「Octie 任务图模式」preset 上下文与 `octie` skill 的修改路径。
> 当前相关规则尚不成熟、定义不够明确，本文先把「改哪里、怎么生效、怎么验证」梳理清楚；
> 规则本身仍在演进，改动本手册与代码时保持同步。

## 0. 三种上下文资产总览

| 资产 | 生效副本（谁在用它） | 打包模板（发布出去的） | 读取/注册点 |
|---|---|---|---|
| **Preset 组合**（`agent.cordis.yml` + `preset.yml`） | `$DSH_HOME/.agent-presets/octie/`（本机：`C:\Users\LENOVO\.dsh\.agent-presets\octie\`） | 仓库 `octie/preset/octie-mode/` | roster 实时扫描目录发现；session 创建时挂载 |
| **Skill**（`SKILL.md`） | 无副本——仓库文件即唯一来源 | `octie/skills/octie/SKILL.md`（随 npm 包 `files` 发布） | `octie/plugin/index.mjs`：432 行 `readFileSync` → 444 行 `ctx.skills.register`（**插件加载时读一次**） |
| **预置逻辑** | 运行中的插件代码 | `octie/plugin/index.mjs` `ensureOctiePreset()` | 插件 `apply()` 时执行，幂等 |

生效语义三句话：

1. **Preset**：改了只影响**之后新建**的会话；运行中的会话留在自己挂载的旧组合上（换模式仅限空白会话）。
2. **Skill**：插件加载时读入内存，**重启 DSH 才生效**；运行中会话的模型手里是旧内容。
3. **模板 → 用户副本**：预置器只写"还不存在"的目标，**已预置的用户目录永不覆盖**——模板改动只触达尚未预置的机器。

## 1. 修改路径 A：改"模式"提示词（persona / 心智模型 / 工作流程）

改的是 `agent.cordis.yml` 中 `persona` 行的 `config.text`（`- id: persona` 在文件
22–60 行附近；关键锚点：38 行 `Mandatory first step`——强制 agent 先读 skill 的要求）。

**改哪一份，取决于要影响谁：**

| 目标 | 改哪里 | 生效范围 |
|---|---|---|
| 只影响本机 | `C:\Users\LENOVO\.dsh\.agent-presets\octie\agent.cordis.yml` | 本机新建会话 |
| 影响所有（新）装机 | 仓库 `octie/preset/octie-mode/agent.cordis.yml` | 之后安装插件并首次加载的机器 |
| 两者都要 | 两份同步改（当前两份字节一致，容易分叉——**约定：仓库模板是唯一上游**，本机副本只做临时实验） | — |

**流程：**

1. 编辑 persona `config.text`（YAML `>-` 折叠标量：换行折叠为空格，空行保留为换行；缩进必须保持在 `text:` 之下）。
2. 同步改 `preset.yml` 的 `description`（选择器里显示的描述，与 persona 口径一致）。
3. 挂载验证：`standingKeyFor('octie')` 必须返回成功（方式见 §4）。
4. 新会话验收：新建会话选「Octie 任务图模式」，确认首屏 persona 与工具清单。
5. 同步更新 README 的「Octie 任务图模式」章节（如果行为描述变了）。

**红线：**

- 绝不编辑 shipped 安装（`@deepseek-ai/dsh/config/agent-presets/{standard,code,minimal,cordis}`）。
- persona 以外的行保持 standard 全量结构；若新增**发布服务**的插件行，必须包在带
  `isolate` realm 的组里，否则挂载审计拒绝。
- persona 中的工作流要求（绝对 `project` 路径、审批门、先读 skill）必须与 skill 内容口径一致。

## 2. 修改路径 B：改 skill 内容

唯一文件：`octie/skills/octie/SKILL.md`（约 10 KB，结构：Part 0 心智模型 / Part 0.5
工具速查 / Part 1 不变式 / Part 2 模式库 A–E / Part 3 陷阱 / Part 4 沉淀）。

**流程：**

1. 编辑 `SKILL.md`（保持章节结构；Part 0/0.5 是 persona 要求 agent 必读的部分）。
2. 若工具面或定位变化，同步改 `octie/plugin/index.mjs` 417–419 行的
   `SKILL_NAME` / `SKILL_DESCRIPTION` / `SKILL_WHEN_TO_USE`（技能目录里的条目文案）。
3. 跑 `octie/tests/unit/plugin/bundle.test.ts`（技能注册在 12 个用例的覆盖链里）+ 全量 `npm test`。
4. **重启 DSH**（skill 内容在插件加载时读入内存）。
5. 新会话验收：让 agent 执行"先读 skill"步骤，确认读到的内容是新版。

**陷阱：**

- 忘了重启 DSH → 模型读到旧 skill，但 persona 说"以 skill 为准"——最典型的"改了没生效"。
- skill 里约定（绝对路径、审批门、BFS 解锁语义）改动后，persona 第 1–5 步流程要跟着改。

## 3. 修改路径 C：改预置逻辑 / 模板交付

预置器在 `octie/plugin/index.mjs`：

- `PRESET_ID = 'octie'`、`PROVISION_HOOK = 'OCTIE_NO_PRESET_PROVISION'`
- `ensureOctiePreset(ctx)`：roster 探测优先（任何 root 已有 id=`octie` 即跳过；
  `authorable === false` 不猜路径）→ 直接写 `$DSH_HOME/.agent-presets/octie/`
  （缺 `agent.cordis.yml` 才写，写前 mkdir，模板拷贝自 `preset/octie-mode/`）。

**规则（当前约定，未定案的都在这）：**

- **幂等**：已存在绝不覆盖；卸载插件不删除已预置 preset（落盘即用户数据）。
- **无升级语义**：模板更新不会推送到已预置机器。要让已装用户拿到新版，只能文档告知
  「删除本机 `.agent-presets/octie/` 后重启 DSH」或手动替换文件——**这是当前最不成熟的点**。
- **打包**：模板目录随 `package.json` 的 `files`（含 `preset/`）进 npm 包；新增/删除模板文件记得同步。
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
- [ ] `bundle.test.ts` 通过（预置 / 幂等 / roster 跳过 / 事件轮询 / 活跃度排序）
- [ ] 全量 `npm test` 通过（当前 793 例）；CI 三平台绿
- [ ] 新会话验收：13 个 `octie_*` 工具 + persona 首屏 + agent 先读 skill
- [ ] README「Octie 任务图模式」章节与本手册路径表同步

## 6. 已知不成熟点（待定规则的清单）

1. **模板 ↔ 用户副本漂移**：无版本戳、无升级路径；已预置机器拿不到模板更新。
2. **persona 是 standard 的全量快照**：DSH 升级给 standard 加行，本模式不会自动继承；
   需周期性对照 shipped `standard/agent.cordis.yml` 手工同步。
3. **skill 一次性读入**：不重启不刷新；没有热更新通道。
4. **换模式仅限空白会话**：产品规则（防止历史工具调用无法重放），不是 bug。
5. **双写分叉风险**：本机副本与仓库模板并存；约定"仓库模板为唯一上游"但没有机制强制。

## 7. DSH 升级兼容性（参考）

> 记录于 2026-08：分析基于当前 DSH 版本线（0.1.0-rc）与 octie 插件的实际依赖面。

**依赖面事实**：Node 半边（`plugin/index.mjs`）只 import Node 内置模块与自家
`../dist/index.js`，零个 `@deepseek-ai/dsh-*` 包依赖；与 DSH 的全部接触都走运行时
服务契约（`ctx.tools.register` / `ctx.provide` / `ctx.emit` / `webServer.register` /
`ctx.skills.register` / `ctx.get('agentPresets')`）与客户端平台契约
（`window.__ModuleLoader__` + slot 树）。

| 组件 | 升级后命运 | 原因 |
|---|---|---|
| 安装状态（profile bundles、`cordis.patch.yml`、用户 preset、`~/.octie` 数据） | 永远在 | 都在用户 home（`$DSH_HOME`），DSH 升级只替换应用本体，不碰 profile / 数据目录 |
| Node 半边（13 工具、`octie` 服务、`/api/octie/*`、SSE、预置、skill） | 同版本线内稳 | 零 dsh-* 包 import；预置器对 `agentPresets` 有 try/catch 直写兜底 |
| 客户端面板（`client.js`） | 皮肤级升级稳；大版本有风险 | 依赖 `window.__ModuleLoader__` 协议 + `sidebar.footer.action` / `shell.overlay` / `sidebar.workspaces` 槽位；loader 协议或槽位被改/删则面板挂不上（工具层不受影响） |
| Octie 任务图模式 preset | 已知漂移点 | 携带 standard 全量行快照、按名引用 host 的 dsh-* 包；DSH 改名/删包 → 新会话挂载失败（运行中会话无恙）；DSH 加行则不自动继承 |
| 3456 独立前端 | 零关系 | 独立进程、独立包 |

**升级后检查清单：**

1. 重启 DSH：面板在不在、工具列表是否有 13 个 `octie_*`、技能目录是否有 `octie`。
2. 新建会话选「Octie 任务图模式」：进得去 = preset 无恙；进不去 = 按 §1 / §6.2 的
   修复路径处理（从新版 shipped standard 重新复制 → 重贴 persona 块 →
   `standingKeyFor` 挂载验证）。
3. 预置器自动跳过已存在的 preset，无需任何操作。

**结论**：数据永不失效；能力在 DSH 同一版本线内预期稳定；大版本跳跃时最多是面板
注册点或 preset 快照需要一次对照修复，工具链始终活着。
