# Mermaid 架构复审与存量问题核查台账

## 背景

- 核查基线: `main` / `72fa7a1 merge: add Mermaid editing and preview modes`
- 首轮修复基线: `main` / `924e10f docs: add project badges to README`
- 核查日期: 2026-08-09
- 范围: Mermaid 新增架构、三套 UI Adapter 对等性、依赖与打包边界、测试覆盖，以及复审中提出的 Toolbar 复制、CI、诊断和公共 API 等存量问题。
- 非范围: 本轮不直接重构业务代码，先确认问题是否成立、影响范围和处置优先级。

## 状态定义

- `PENDING`: 待核查。
- `CONFIRMED`: 问题成立，需要进入后续迭代。
- `PARTIAL`: 部分成立，原表述或优先级需修正。
- `CLOSED`: 已有充分防护或证据，当前不需要修改。
- `DEFERRED`: 问题成立，但需要数据或更合适的重构窗口。

## 问题清单

| ID | 待验证问题 | 初始风险 | 核查方法 | 通过 / 处置标准 | 状态 |
|---|---|---:|---|---|---|
| AUD-01 | `FindReplacePanel` 和 `SlashCommandMenu` 在三套 Adapter 中存在可抽取的业务逻辑复制 | 中 | 对比 `<script setup>`、模板与 UI 库依赖，确认差异是否仅为 Adapter 原语 | 只把纯状态/命令组装下沉 core，不共享 UI 组件和模板 | CLOSED |
| AUD-02 | `useProEditor.ts` 达 1478 行，可能是责任过度集中的 god composable | 中 | 盘点顶层责任、已抽取模块、命令区块大小和共享闭包 | 只在能形成稳定领域边界时拆分，不以行数为唯一依据 | CONFIRMED |
| AUD-03 | `mermaid` 作为 core 硬依赖增加不使用 Mermaid 的消费者安装成本 | 中 | 检查 core exports、默认扩展开关、构建 chunk 和字面量动态 import；评估 optional peer 可行性 | 按需加载与安装体积分开判定；不得用 optional peer 制造消费者构建失败 | CONFIRMED |
| AUD-04 | 缺少 `mermaidNodeView.test.ts`，组合层生命周期可能没有直接覆盖 | 中低 | 建立 core 单测、Adapter 组件测试和 Playwright 行为的覆盖矩阵 | 只在存在未覆盖的高风险生命周期行为时新增直接单测 | PARTIAL |
| AUD-05 | Ant Design Vue 版 Mermaid NodeView 行数明显更少，可能存在功能或样式对等性缺口 | 中 | 对比三套模板行为、UI 原语、CSS 变量，并运行三 Adapter 浏览器指标断言 | 视图切换、错误、加载、暗色、移动端、只读和可访问性行为一致 | CLOSED |
| AUD-06 | Mermaid 的 SSR 安全、XSS 防护、按需加载和异步竞态防护需要独立确认 | 高 | 静态检查 import 时机、`securityLevel`、parse/render 路径、队列和 version guard；执行 Node 端 import、构建与回归测试 | 服务端 import 不访问 DOM，用户源码不以宽松模式渲染，过期结果不覆盖新结果 | CLOSED |
| AUD-07 | 三套 `Toolbar.vue` 存在大量可共享的 headless 逻辑，行为漂移风险高 | 高 | 统计 script/template/style，对比函数清单和脚本 diff，核对 core 已有 Toolbar helper | 只下沉稳定领域 controller，不把一个 Adapter god-file 搬成 core god-composable | PARTIAL |
| AUD-08 | GitHub Actions 没有 typecheck / test 质量门禁 | 高 | 检查 `.github/workflows` 触发条件与命令 | PR 和 main push 至少阻挡未通过 typecheck、unit test 与 build 的变更 | CLOSED |
| AUD-09 | 异步上传/裁剪失败诊断覆盖不完整 | 中 | 跟踪 Toolbar、`useProEditor`、paste/drop 与 crop 错误路径 | 主入口必须有用户通知；debug 模式能定位关键异步失败 | CLOSED |
| AUD-10 | core 根入口公共 API 面积过大，增加兼容性负担 | 低 | 用 TypeScript AST 统计命名导出，核对 Adapter 和文档用途 | 先区分消费者 API、Adapter SDK 和内部实现，不盲目删除已被 Adapter 使用的符号 | PARTIAL |

## 执行记录

### AUD-01 共享面板逻辑复制

**结论: `CLOSED`。FindReplace 已按边界抽取，Slash Command 经核查不宜整块下沉 core。**

- 三个 `FindReplacePanel.vue` 的 `<script setup>` 业务逻辑一致: `state`、`total`、`current`、`query`、`replacement`、`caseSensitive`、Escape 关闭和大小写切换。
- FindReplace 差异只在 UI 组件 import、输入框实例类型和 Ant 适配层的可选 `focus()` 签名。
- 适合抽取 `useFindReplacePanelState(ctx)`，返回共享 computed 绑定和纯命令动作。输入框 ref、`nextTick` 聚焦和模板继续留在 Adapter。
- 三个 `SlashCommandMenu.vue` 的脚本也高度相似，但剩余内容主要是 lucide 图标映射、viewport 定位和菜单点击，属于 UI 渲染行为。core 已经提供 `isSlashCommandItemExecutable` 和 command 协议。
- 不建议为减少约 50 行 Adapter 脚本，让 UI 无关 core 接管 `window.innerWidth`、lucide 组件或菜单样式定位。
- 已新增 `useFindReplacePanelState()`，共享查询、替换值、大小写状态和命中计数；三个 Adapter 只保留输入框类型、打开后聚焦、Escape 事件和 UI 模板。
- 新增 core 定向单测，三套 Find/Replace 浏览器流程全部通过。

### AUD-02 `useProEditor` 责任边界

**结论: `CONFIRMED`，但应渐进处理。**

- 文件共 1478 行，行数本身不是唯一判据。
- 表格几何、拖动、选区和行列命令约占 305-766 行，是最大单一领域。
- 资源标准化与文件/视频/音频插入约占 777-979 行。
- `rawCommands` 约占 980-1312 行，同时依赖 editor、locale、notify、上传回调和表格辅助函数。
- 已有 `handleImageUpload`、`handleAssetUpload`、`markdown`、`mediaSelection` 等领域模块，说明当前文件也是编排层，不是全部逻辑都未抽取。
- 不建议直接拆成 `useEditorLifecycle` / `useEditorCommands` 等同层小 composable，这会把闭包依赖变成大量参数传递。下次修改表格或资源域时，优先抽取领域 controller / command builder。

### AUD-03 Mermaid 依赖与打包边界

**结论: `CONFIRMED`。首屏风险已解决，安装体积风险真实存在。**

- core 产物保留 `import("mermaid")` 和 CodeMirror 的动态 import，Playground 构建将 `mermaid.core` 拆为独立约 608 KiB 文件。
- `playground/dist/index.html` 初始只引用主 JS 和 CSS，没有 preload Mermaid chunk。不存在 Mermaid 块时不会执行加载；初始文档已有 Mermaid 块时会在 `onMounted` 后立即加载。
- 本地 pnpm 非压缩目录体积: `mermaid` 约 83 MiB，`@mermaid-js/parser` 约 12 MiB，五个 CodeMirror 直接包合计约 2.4 MiB。该数据不等于注册表下载流量，但能证明消费者安装成本不可忽略。
- `createDefaultExtensions()` 默认启用 `mermaidBlock`，core 根入口也直接导出 renderer / CodeMirror / NodeView API。即使通过 registry 关闭 Mermaid，依赖仍会安装。
- 不能只把 `mermaid` 改成 optional peer: bundler 仍需解析字面量 import，缺包时可能直接构建失败。
- 后续需先做产品决策: Mermaid 是否保持默认能力。如果需要轻量核心包，应设计独立子入口或独立扩展包，并让 Adapter 工具栏根据能力注册。

### AUD-04 NodeView 测试覆盖

**结论: `PARTIAL`。缺直接单测，但当前不是发布阻塞缺口。**

| 层级 | 已覆盖行为 |
|---|---|
| `mermaidRenderer.test.ts` | stale result 丢弃、无效源码保留上次 SVG、reset、错误行号 |
| `mermaidCodeEditor.test.ts` | 懒加载、外部源码同步、冷加载聚焦、ARIA、undo/redo、暗色、只读、错误行 |
| `useProEditor.test.ts` | 插入、自定义默认值、三态持久化、HTML/JSON/Markdown 往返 |
| Adapter 组件测试 | NodeView renderer 注册、工具栏与 Slash Command 入口 |
| Playwright | 三态切换与重挂载、焦点、编辑渲染、undo/redo、错误/空状态、暗色、只读、移动端、三 Adapter 对等性 |

- 未直接覆盖的主要场景是: CodeMirror 和 Mermaid 异步加载期间整个 NodeView 卸载，以及挂载期间连续切换主题/只读状态。
- 建议在下次修改 NodeView 生命周期前补一个定向测试，不需要为了文件存在而重复 Playwright 已覆盖的行为。

### AUD-05 三套 Adapter 对等性

**结论: `CLOSED`。没有发现对等性缺口。**

- 三套 Adapter 使用同一 `useMermaidNodeView` 和相同模式数据，各自只保留 Element Plus / Naive UI / Ant Design Vue 原语按钮组、Tooltip 和 Adapter 本地主题变量。
- Ant 版 80 行与 Element Plus / Naive UI 的 120 / 118 行差异不只是“格式化”，还包括主题 token 映射和 Adapter 原语；但没有行为缺失。
- Playwright 三套全部通过: toolbar 44px，按钮 28x28，图标 14x14，水平/垂直中心偏差为 0，分屏宽度一致。
- 浏览器流程同时通过错误、暗色、只读、移动端堆叠和无横向溢出断言。

### AUD-06 SSR、安全与异步竞态

**结论: `CLOSED`。当前防护与回归证据充分。**

- 在显式删除 `globalThis.window` 和 `globalThis.document` 后，Node 直接 import `packages/core/dist/index.js` 成功。
- Mermaid 仅在 `renderMermaidSvg()` 被调用时动态 import；NodeView 的首次 render 在 Vue `onMounted` 中触发。
- 渲染配置使用 `securityLevel: 'strict'`，并在 `render()` 前执行 `parse()`。
- 真实浏览器注入包含 `<img onerror=...>` 的 Mermaid 标签后: SVG 正常生成，攻击标记未执行，`script` 为 0，DOM 事件属性为 0。保留了无事件属性的图片元素。
- 全局 render queue 避免 Mermaid 全局 initialize/render 交叉；controller version 防止过期成功或失败结果回写。对应 stale-result 单测通过。
- NodeView 使用 `codeEditorVersion`、controller `destroy()` 和 render `cancel()` 处理模式切换与卸载。

### AUD-07 Toolbar 共享逻辑复制

**结论: `PARTIAL`。本轮计划中的四个稳定领域已完成抽取，剩余重复继续按领域评估。**

- 初始 Toolbar `<script setup>` 行数为 Element Plus 784、Naive UI 902、Ant Design Vue 787。模板行数少部分来自压缩排版，不能用“模板只有 38 行”推导 95% 都是纯逻辑。
- Element Plus 与 Ant 脚本的文本 diff 只有约 13 行，绝大部分逻辑直接重复。Naive UI 因 dropdown render API 不同有更多适配代码，但核心状态和流程仍一致。
- 初始重复领域包括: 图片裁剪队列与拖动、图片/媒体上传选择、Markdown 导入导出、打印、表格网格、链接对话框状态、当前字体/颜色/代码语言状态。
- core 已经提供 `runToolbarCommand`、`resolveToolbarOptions`、`toolbarActions` 和 command registry，因此“2350 行全都未共享”的表述过度。Adapter 中仍有明确且大量的共享编排逻辑。
- 未创建巨型 `useToolbar(ctx)`；已分别完成 `useImageCropController()`、`useToolbarResourceInputs()`、`useToolbarLinkController()` 和 `useToolbarDocumentActions()`。
- 图片裁剪 controller 集中队列、对象 URL 生命周期、缩放、拖动、裁剪确认/跳过和失败诊断，三个 Toolbar 各删除 157 行脚本。
- 资源输入 controller 集中 image/video/file input 触发、单/多选、串行上传、清空和裁剪分流，三套合计再减少 125 行脚本。
- 链接 controller 集中选区快照、已有链接范围、校验、target、插入/更新/移除、通知和诊断，三套合计再减少 211 行脚本。
- 文档动作 controller 复用既有 `toolbarActions.ts`，集中 Markdown 导入/导出和打印编排，三套合计再减少 88 行脚本。
- Toolbar `<script setup>` 最终为 Element Plus 477、Naive UI 621、Ant Design Vue 480；相对初始 784 / 902 / 787，三套合计减少 895 行。
- 剩余重复主要是表格网格、字体/字号/行高、颜色/高亮、代码语言和部分菜单派生状态。它们与 Adapter dropdown/popover API 耦合更深，不在本轮继续扩大范围。

### AUD-08 CI 质量门禁

**结论: `CLOSED`。质量检查与文档部署已串成同一门禁。**

- `.github/workflows/ci.yml` 现在覆盖 pull request、main push 和手动触发。
- `quality` job 按干净工作区所需顺序执行 frozen install、包构建、全仓 typecheck 和单元测试。先构建 core 可确保 Adapter 能从包导出读取最新声明文件。
- main push 和手动触发的 docs build / deploy 显式依赖 `quality`；质量检查失败时不会继续部署。PR 只执行质量门禁，不生成 Pages artifact。
- Playwright 脚本仍依赖外部 `visual-compare` 目录，需先改成仓库自包含依赖再进入 CI；当前不影响 unit/type/build 门禁闭环。

### AUD-09 异步失败诊断

**结论: `CLOSED`。原报告低估了已有诊断，两条确认的旁路已补齐。**

- `useProEditor` 的图片和媒体上传已记录 `upload/*:start`、`success`、`error`，并有 image success/error 单测。
- `withDebugCommands` 对同步和 Promise 命令统一记录 run/result/error。上传失败也会通过 Adapter `notify` 告知用户。
- `useImageDropPaste` 已接入 Adapter debug logger，记录 paste/drop 来源、文件数、校验失败、上传失败和完成事件，同时保留用户通知。
- `useImageCropController` 在裁剪开始、成功、失败、跳过和取消时写入 `upload` channel；失败日志保留原始 error，并继续按既有行为上传原图。
- 纯校验与 canvas 裁剪函数仍不直接依赖 logger，诊断保持在业务编排层。

### AUD-10 core 公共 API 面积

**结论: `PARTIAL`。入口很宽，但“明显内部实现”尚未得证。**

- TypeScript AST 统计 `packages/core/src/index.ts` 当前共有 242 个命名导出，包含值和类型，比原报告的 69 个更多；本轮新增的 9 个 controller 值/类型符号属于 Adapter SDK。
- core 根入口同时是最终用户 API 和三个独立 Adapter 包的 SDK，因此 toolbar config、command registry、NodeView context、selection helper 等导出存在真实跨包用途。
- `FALLBACK_TOOLBAR` 是 Adapter 本地常量，并未从 core 导出。`toolbarConfigData` 也不是对外符号，导出的是被 Adapter 使用的配置常量和解析器。
- 入口面积增加 semver 负担的风险成立，但不应在 0.1.x patch 中直接删导出。应先建立 API inventory，标记 consumer public / adapter SDK / internal，再设计 `./adapter` 等子路径导出。

## 最终行动项

1. **已完成: CI 质量门禁。** PR/main push 执行 frozen install、build、typecheck 和 unit test；main 文档部署依赖质量检查通过。
2. **已完成本轮 P1: 按领域抽取 Toolbar 共享逻辑。** 图片裁剪、资源输入、链接编辑和文档动作 controller 已完成；剩余表格/样式/菜单状态继续按收益和 UI 耦合度逐项评估。
3. **已完成: FindReplace 共享状态绑定。** computed 状态和纯命令已下沉，输入框聚焦、UI 原语和模板仍在 Adapter。
4. **P2: 对 Mermaid 安装体积做产品决策。** 若要保持默认开箱即用，维持现状；若要轻量 core，先设计独立入口/扩展包，不直接改 optional peer。
5. **P2: 按领域渐进缩减 `useProEditor`。** 等下次表格或资源功能迭代时抽取 controller / command builder，不单独发起全量拆分。
6. **P3: 建立 API inventory。** paste/drop 和 crop 诊断已补齐；在 1.0 前区分 consumer / adapter / internal 导出。
7. **P3: 在下次 NodeView 生命周期修改前补定向测试。** 重点覆盖异步挂载期间卸载/连续状态切换。
8. **不处理: Slash Command 整块下沉、Ant 行数对齐、Mermaid 运行安全重写。** 当前没有足够收益或已有充分防护。

## 核查命令与结果摘要

- `node --input-type=module ... import('./packages/core/dist/index.js')`: 通过，无 DOM 全局时可 import。
- `pnpm build && pnpm typecheck && pnpm test`: 四个包构建和全仓 typecheck 通过，共 68 个测试文件 / 686 项通过。
- Core 为 34 个测试文件 / 366 项通过；资源输入、链接编辑和文档动作均有直接 controller 单测。
- 三套 Adapter typecheck 和 unit test 全部通过: Element Plus 105、Naive UI 106、Ant Design Vue 109 项。
- `node scripts/image-crop-playwright-smoke.mjs`: 三套 Adapter 的弹窗、缩放、拖动、跳过和确认流程通过。
- `node scripts/find-replace-playwright-smoke.mjs`: 三套 Adapter 的搜索、导航、替换、焦点和切换流程通过。
- `node scripts/mermaid-playwright-smoke.mjs`: Element Plus、Naive UI、Ant Design Vue 全部通过。
- `pnpm docs:build`: VitePress 和 Playground 生产构建通过，Mermaid 生成独立动态 chunk。
- Toolbar 脚本结构 diff: Element Plus 与 Ant 仅约 13 行文本差异；Naive 存在 UI API 适配差异。
- `.github/workflows/ci.yml`: PR/main 质量门禁已启用，main Pages 部署依赖 quality job。
- TypeScript AST 统计: core 根入口 242 个命名导出（含类型）。
