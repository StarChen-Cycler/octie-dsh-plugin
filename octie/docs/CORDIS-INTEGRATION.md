# Octie × DSH/Cordis：机制与踩坑记录

本文档回答两个问题：

1. **机制** —— octie-dsh 这个 bundle 插件是怎么“接入” DeepSeek Harness 的
   Cordis 核心的（`apply` / 服务 / 工具注册 / 事件 / 生命周期），以及 DSH 工具定义契约的**两种形态**。
2. **踩坑** —— 在让插件真正跑通的过程中踩到的坑、报错原文、根因与修法。

配套的可复用学习路径见技能 `dsh-plugin-authoring`（`SKILL.md` 第 2/5/6/10 节）；本文聚焦 octie 这个真实案例。

---

## 1. Bundle 插件的接入面（谁调谁）

octie-dsh 采用 DSH 的 **bundle 插件形态**：npm 包 + `dsh.bundle.patch` + `cordis.patch.yml`。

```
package.json                      cordis.patch.yml            plugin/index.mjs
  "main": ./plugin/index.mjs        - insert:                   export const name  = 'octie-dsh'
  "dsh.bundle.patch":                - id: octie-dsh            export const inject = ['tools']
    ./cordis.patch.yml                 name: octie-cli          export function apply(ctx) { ... }
```

- `cordis.patch.yml` 只是**组合补丁**：把一行 `{ id: octie-dsh, name: octie-cli }` 插进 profile 的
  composition。它不写代码，只决定“这个插件挂进哪个 profile”。
- `plugin/index.mjs` 是**完整的 Cordis Node half**（bundle 形态里能 `import` 任何东西）：
  它 `import { … } from '../dist/index.js'` 直接调 octie-core 的服务层。
- 安装：`dsh plugin --profile web add <spec>`，安装器把 `dsh.profile.bundles` 与依赖对齐。

### 1.1 `apply(ctx)` 里做的事（都在当前 Fiber 内、可撤销）

```js
export function apply(ctx) {
  const service = new OctieService(ctx)
  const disposers = []

  // ① 提供服务：别的插件可 inject: ['octie'] 拿到同一个任务图引擎
  disposers.push(ctx.provide('octie', service))

  // ② 注册模型工具：13 个 octie_*，交给 ctx.tools.register
  for (const tool of buildTools(service)) disposers.push(ctx.tools.register(tool))

  // ③ 注册 Web 路由：/api/octie/{projects,state,task,graph,events}（events 为 SSE 长连接）
  // ④ 注册 skill：ctx.skills.register('octie')，正文读自包内 skills/octie/SKILL.md
  // ⑤ 幂等预置 agent preset：ensureOctiePreset(ctx)（best-effort，见 §8.3）

  // 统一 teardown：stop/update/undefine 时全部反向执行
  ctx.effect(() => () => disposers.forEach(d => d()))
  return {}
}
```

- **服务**（`ctx.provide`）→ 跨插件共享能力。
- **工具**（`ctx.tools.register`）→ 变成模型可调用的函数。
- **事件**（`service._notify` 里 `ctx.emit('octie/task-created', …)`）→ 别的插件可 `ctx.on` 订阅。
- **生命周期**（`ctx.effect(() => disposer)`）→ 每个副作用都能被回收。

---

## 2. 工具定义契约：DSH 里有两套“参数写法”（关键，务必分清）

这是本次踩坑的**根因所在**。DSH 有两个注册入口，对 `parameters` 的处理**不一样**：

| | 入口 | `parameters` 传什么 | 谁把它变成 JSON Schema |
|---|---|---|---|
| **动态插件** | `harness.registerTool(ctx, harness.defineTool({…}))` | **裸映射** `{ id: { type:'string', required:true } }` | `defineTool` 内部 `parameterSchemaSpecToJsonSchema()` 自动转换 |
| **Bundle 插件** | `ctx.tools.register({…})` | **完整 JSON Schema** `{ type:'object', properties:{…}, required:[…] }` | **无人转换，原样透传给模型 API** |

**证据**（DSH 源码）：

- 动态路径 `defineTool`（`@deepseek-ai/dsh-tools/lib/types/schema.js`）：
  ```js
  const parameters = parameterSchemaSpecToJsonSchema(options.parameters)  // 裸映射 → {type:'object',properties,required}
  const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema) // 输出 schema 也转换
  ```
- Bundle 路径 `ctx.tools.register` → 注册表 `schemaOf()`（`dsh-tools/lib/types/index.js`）：
  ```js
  const detached = snapshotJsonValue(parameters)  // 只做“lossless JSON”检查，不转 schema
  return { name, description, parameters: detached }
  ```
- 模型 API 侧（OpenAI SDK `lib/transform.js`）才强制校验：
  ```js
  throw new Error(`Root schema must have type: 'object' but got type: ${schema.type …}`)
  ```

**结论**：把动态插件的示例（裸映射）直接照抄进 bundle 的 `ctx.tools.register`，就会在**模型请求时**
（而非注册时）炸出 `type: null`。octie 就是踩了这个坑。

### 2.1 正确的 bundle 写法（octie 修好后）

```js
function objectSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, value] of Object.entries(spec)) {
    const { required: isRequired, ...property } = value
    properties[key] = property
    if (isRequired) required.push(key)
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) }
}

function makeTool(service, name, description, parameters, execute, options = {}) {
  return {
    name,
    description,
    parameters: objectSchema(parameters),          // ← 裸映射 → 完整 JSON Schema
    output: { schema: {}, render: renderJson },    // ← {} = 无约束 JSON；render 负责展示
    async execute(args) { /* … */ },
  }
}
```

---

## 3. 输出契约：工具返回值必须是 “lossless JSON”

DSH 对工具返回值有硬约束：**lossless JSON = 对象、数组、字符串、数字、布尔、`null`**；
**禁止** `undefined`、函数、`Date`、`Map`/`Set`、类实例。

出处（`@deepseek-ai/dsh-cordis-host-runner/lib/index.js`）：

> must be lossless JSON data (objects, arrays, strings, numbers, booleans, null) —
> not a class instance, function, Map/Set, Date, or `undefined`.

同时，`output.schema` 会在**首次成功返回时**校验返回值。octie 的两个相关坑：

1. **投影里带了 `undefined`** → 报 `value is not lossless JSON`。
   octie-core 的 `toTaskProjection` 原样透传了可选字段 `evidence` / `source` / `file_path`，
   这些字段未设置时是 `undefined`。
   **修法**：把可选字段用条件展开省略（`...(c.evidence ? { evidence: c.evidence } : {})`），
   把 `notes/dependencies/created_at/updated_at` 用 `?? ''` 兜底。
2. **`output.schema` 写错类型** → `{ type:'string' }` 但工具返回对象/数组，会在成功返回时抛
   `ToolOutputError`。**修法**：返回类型不固定时写 `{}`（无约束 JSON）。

---

## 4. 踩坑全记录（报错原文 → 根因 → 修法）

| # | 报错 / 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | `Invalid schema for function 'octie_approve': schema must be a JSON Schema of 'type: "object"', got 'type: null'` | bundle 的 `ctx.tools.register` 不转换参数，裸映射 `{ id:{…} }` 缺顶层 `type:'object'`，模型 API 读到 `parameters.type === undefined` → 序列化成 `null` | 新增 `objectSchema()`，把每个工具的裸映射包成 `{type:'object',properties,required}`（一处覆盖全部 13 个工具） |
| 2 | `tool "octie_create" returned invalid output: value is not lossless JSON` | 投影透传了 `undefined`（`evidence`/`source`/`file_path`/时间戳） | `projections.ts` 里省略未设置的 optional 字段 + `?? ''` 兜底字符串/时间戳 |
| 3 | （潜伏）首次成功调用会抛 `ToolOutputError` | `output.schema: { type:'string' }` 与“返回对象/数组”不符 | `output.schema` 改为 `{}`（无约束 JSON） |
| 4 | 传了 `project` 参数却总是读“当前项目”，甚至报 `No Octie project open` | `resolveProject()` 对显式 path 只 `return` 字符串、不 `openProject` 也不设 `service.current`；且 execute 回调忽略第二个参数 | `resolveProject()` 对显式 path 也 `openProject().then(handle => service.current = handle)`，并把 `project` 参数注入所有非 init 工具 |
| 5 | 第一次调工具就误入 `openProject()` 自动探测 | `octie_init` 的参数字段是 `path` 不是 `project`，但旧 wrapper 对**所有**工具都先 `resolveProject` | `octie_init` 标记 `resolveProject:false`，跳过项目解析 |
| 6 | 本地改完代码，`dist` 没进 git | `octie/dist/` 在 `.gitignore` 里，`prepack` 时才 `build` 重建 | **已反转（2026-08）**：npm git 依赖只打包 git 已跟踪文件，`prepare` 建的 dist 会被丢弃，GitHub 直装因此装完即坏。现改为 `octie/dist`（除 `.map` 与 `dist/web-ui/`）**提交进仓库**，根 facade 镜像运行时依赖，CI 加 `git diff --exit-code -- octie/dist` 漂移门禁。细节见 `docs/development.md` §3 |

---

## 5. 验证清单（每次改完都跑）

```bash
cd octie
npm run build:cli          # 重建 dist（dist 已提交进 git；CI 漂移门禁会校验产物新鲜度）
npm run test:core          # 快测：service + plugin + core + shared-helpers
```

回归测试落在 `tests/unit/plugin/bundle.test.ts`：

- 13 个工具每个 `parameters.type === 'object'`、`properties` 是对象、`required` 是数组或省略；
- 非 init 工具都带 `project` 参数；
- `octie_create/list/get` 的返回值 `isLosslessJson()` 为真（复现坑 #2 的守卫）。

---

## 6. 技能注入（让模型「会用」API）

工具 schema 只教模型「怎么调」（签名 / 参数 / 返回）。octie 的「使用心法」（不变式 /
模式库 / 陷阱）太长，塞不进 description，也不该每轮都进 prompt（烧 token）。正解是注册成
一个**技能（skill）**，让模型在真正要干活时用 `skill` 工具按需加载。

DSH 有 `ctx.skills` 服务（`@deepseek-ai/dsh-skill` 的 `SkillRegistry`）。bundle 插件在
`apply()` 里注册即可，用户无需手动往 `.agents/skills/` 拷文件：

```js
const skills = ctx.get('skills')            // 可选服务，别硬 inject
if (skills !== undefined) {
  disposers.push(skills.register({
    name: 'octie',                          // kebab-case，唯一
    description: '...',                     // 目录里显示的短描述
    whenToUse: '...',                       // 可选：路由提示
    source: 'bundled',                      // 来源标签（prompt 可见）
    content: '<markdown 正文，不含 frontmatter>',
    // invocation 省略 = 默认 { modelInvocable: true, userInvocable: true }
  }))
}
```

octie 的实现：正文放在包内 `octie/skills/octie/SKILL.md`（`package.json` 的 `files` 已含
`skills`），`apply()` 里用 `readFileSync` + `import.meta.url` 读文件、`stripFrontmatter()`
去掉 YAML frontmatter，再 `register()`。这样 SKILL.md 保持单一事实来源，且随 npm 包分发。

三条通道别混：**工具 description（总是、短）｜ skill（按需、长心法）｜ prompt 段（总是、
硬规则、有 token 成本）**。

---

## 7. 一句话记忆

> **动态插件 = `defineTool`（裸映射，自动转 schema）；bundle 插件 = `ctx.tools.register`（完整 JSON Schema，原样透传）。**
> **工具返回值永远是 lossless JSON——不许有 `undefined`。**

---

## 8. 维护期新增的接入面（2026-08）

### 8.1 客户端面板（slot 注册）

`client.js` 是 `window.__ModuleLoader__.load` 工厂，`apply` 里经 `ctx.get('slots')` 注册：

- `sidebar.footer.action`（面板开关按钮，owner prop `{wide}`）
- `shell.overlay`（面板本体）
- `sidebar.workspaces`（single 槽）

面板是纯 React + `fetch('/api/octie/*')`，样式全部自带（`octie-` 前缀），不依赖主题 token。
换 DSH 皮肤级前端无需改动；若换掉整个 slot 树则需要把注册点移植到新壳（数据层零改动）。

### 8.2 实时同步（SSE + 外部变更检测）

- 会话内：`OctieService._notify` → `service.onChange` 订阅 → `/api/octie/events` 写 SSE 帧。
- 外部写入（终端 CLI / Web UI / 其他会话）不经过本进程，两条通道：
  1. **fs.watch（即时）**：SSE 连接按 `?project=` 监听当前项目 `.octie` 目录——project.json /
     history/ / config.json 任一文件变动（120ms 防抖）立即推 `external-change` 事件，
     因为这些是唯一会改变图表的文件（不监听项目根目录的无关文件，避免噪声）。
  2. **3 秒 mtime 轮询（兜底）**：覆盖注册表文件、watcher 出错、目录暂缺等场景。
- 客户端：`connectSse(project)` 随项目切换重连；`es.onmessage` / `es.onerror` → `refresh()`；
  页面从后台恢复可见（`visibilitychange`）强制 `refresh()`——旧标签页自愈，
  一次刷新列表 + 图 + 项目下拉。

### 8.3 agent preset 预置（宿主平面写用户 root）

`ensureOctiePreset(ctx)`：`ctx.get('agentPresets')`（可选服务）→ roster 探测（任何 root
已有 id=`octie` 即跳过；`authorable=false` 不猜路径）→ 直写 `$DSH_HOME/.agent-presets/octie/`。
幂等、best-effort、卸载不删除；`OCTIE_NO_PRESET_PROVISION=1` 退出（测试用）。
创作/修改/验证路径见 `docs/preset-skill-maintenance.md`。

### 8.4 安装形态与仓库布局

- 根 facade `package.json`：镜像 `octie/package.json` 的 exports / dsh.bundle / bin 契约 +
  运行时依赖，让 `dsh plugin add github:…` 能解析并携带依赖；无 workspaces，不影响
  `octie/` 内 `npm ci`。
- `octie/dist`（tsc 产物）提交进仓库：npm git 依赖只打包已跟踪文件（坑 #6 的反转）。
- `dist/web-ui/`（vite 产物）不进仓库：html 输出跨平台/跨 Node 版本不逐字节确定，
  进提交会让漂移门禁必红；仅 `octie serve` 需要，npm tarball 仍会带。
