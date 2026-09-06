# 数学公式（KaTeX）技术设计

> 归属：iteration-plan-2026-09.md（仓库内部迭代计划，未随文档站发布）阶段一第 1 项。
>
> 定稿时间：2026-09-06；当前状态：待技术评审。本文是数学公式功能的唯一正式设计来源。
>
> 审查记录：math-katex-design-revised.md（评审版工作稿，未入库）已合并到本文，不再单独作为实现依据。

---

## 一、方案结论

本功能采用两个原子节点：`mathInline` 和 `mathBlock`。LaTeX 保存在 `latex` attr 中；编辑器内由三个 adapter 各自提供 Vue NodeView 和弹层，core 只负责 schema、命令、输入规则、渲染契约、Markdown 规则和打印前转换。

v1 支持：

- KaTeX 屏幕渲染；
- `$...$` 行内输入规则；
- 独占行 `$$...$$` 块级输入规则；
- `/公式` 块级 slash command；
- 工具栏“公式”块级插入按钮；
- 公式气泡菜单中的编辑、删除；
- HTML/JSON 往返；
- 块级 `$$...$$` Markdown 导入导出；
- 打印前把公式转换为 MathML，避免打印 iframe 的 KaTeX CSS 和字体依赖。

v1 不支持：

- 光标进入公式节点的内联编辑；
- MathQuill 和可视化公式编辑器；
- `\(`、`\)`、`\[`、`\]`、`equation` 环境自动识别；
- 公式编号、对齐、多行编辑器；
- DOCX/OMML 转换；
- 行内 `$...$` Markdown 往返（留到 v1.x）。

---

## 二、与现有方案的对齐

官方 `@tiptap/extension-mathematics` 已采用 atom + attr + 点击回调的架构，与本方案一致。当前项目仍自研节点，原因是：

1. 官方输入规则采用 `$$` 行内、`$$$` 块级，与本项目目标的 `$` / `$$` 不一致；
2. 官方 NodeView 静态 import KaTeX，而本项目需要动态 import、Promise 缓存、memo 和可注入 renderer；
3. 项目需要与现有 Mermaid 的 core/adapter 分层、三套 UI 弹层和打印管线保持一致。

官方扩展的源码和版本必须在实现时固定到可复现的链接或 commit；当前仓库锁定的 Tiptap 版本为 3.27.1，不能把未锁定的上游行为当作本地代码事实。

需要保留一项互操作能力：`parseHTML()` 同时接受本项目自己的 `math-inline` / `math-block` selector，以及官方扩展使用的 `inline-math` / `block-math` selector。两种格式统一还原为本项目的 `mathInline` / `mathBlock`。

---

## 三、现有代码边界

### 1. Core / adapter 分层

参考现有 Mermaid 实现：

- core 提供 Node、renderer、NodeView composable、配置和命令；
- adapter 提供 `VueNodeViewRenderer`、UI 组件、气泡菜单和弹层；
- `ProEditor*.vue` 负责把 adapter NodeView 注入 core；
- 三个 adapter 的行为和测试必须对等。

公式不得在 core 引入 Element Plus、Naive UI 或 Ant Design Vue。

### 2. 自定义 `extensions`

当前 `useProEditor()` 传入 `extensions` 后会完全覆盖默认扩展包。公式遵循同一规则：

- 未传 `extensions`：默认加载 math 扩展；
- 传入自定义 `extensions`：用户自行加入 `MathInline`、`MathBlock` 或组合扩展；
- adapter 的 NodeView 注入仍然存在，但不保证用户自定义扩展一定包含公式节点；
- 文档必须说明：自定义 extensions 不会自动补齐 math、slash 或 Markdown 能力。

---

## 四、依赖与 CSS

### 1. KaTeX 依赖

采用 **core 直接依赖 KaTeX + 运行时异步加载**。这是对迭代规划“重依赖可选化”原则的明确例外，原因是默认扩展包直接提供公式能力，避免 optional peer 的缺失、降级和测试分支。

需要修改：

- `packages/core/package.json`：增加 `katex` dependency；
- `packages/core/vite.config.ts`：将 `katex` 加入 external；
- `pnpm-lock.yaml`；
- `packages/core/THIRD_PARTY_NOTICES.md`：补充 KaTeX 许可声明。

### 2. 屏幕 CSS

不能只要求业务宿主手工寻找 KaTeX CSS；也不能直接把 `katex/dist/katex.min.css` 合入 `style.css`——实测 vite lib 模式会把 CSS 引用的资源强制 base64 内联(`assetsInlineLimit: 0` 也不生效),全部 60 个字体文件(三格式,约 1.1MB)会被打进 `style.css`(+953KB gzip),页面无论是否使用公式都要全量下载。

实现(2026-09-06 落定):adapter 构建后由 `scripts/copy-katex-assets.mjs` 产出 `dist/katex.css`(仅保留 woff2 源,现代浏览器全覆盖)与 `dist/katex-fonts/`(20 个 woff2),包内新增 `./katex.css` 导出。宿主在 `style.css` 之外多引一行 `import 'xxx/katex.css'`,字体由浏览器按需加载(实际命中通常几十 KB)。`katex` 以 adapter `devDependencies` 保证 pnpm 解析,runtime 仍只打包在 core。playground 走应用侧 bundler,直接引 `katex/dist/katex.min.css`(应用模式会正常产字体文件)。构建 smoke 与 PDF 冒烟覆盖该产物。

### 3. mhchem 说明

KaTeX 核心不内置 `\ce`。如未来支持化学方程式，必须单独接入 KaTeX mhchem 扩展或由宿主注入安全 renderer，不能宣称只靠 KaTeX `macros` 即可启用。

---

## 五、节点模型与公开契约

### 1. Schema

`mathInline`：

- `inline: true`；
- `group: 'inline'`；
- `atom: true`；
- `selectable: true`；
- `latex: string` attr，默认空字符串；
- `marks: ''`。

`mathBlock`：

- `group: 'block'`；
- `atom: true`；
- `selectable: true`；
- `isolating: true`；
- `latex: string` attr，默认空字符串；
- `marks: ''`。

HTML 序列化只保存可逆源码，不在 `renderHTML()` 中异步渲染：

```html
<span data-type="math-inline" data-latex="x^2"></span>
<div data-type="math-block" data-latex="\frac{1}{2}"></div>
```

`parseHTML()` 从 `data-latex` 恢复 attr，并兼容官方扩展的 `inline-math` / `block-math` 标签。JSON/HTML 测试必须覆盖空字符串、引号、反斜杠和 Unicode。

`editor.getHTML()` 只表示可逆源码，不承诺包含 KaTeX 展开后的 HTML；打印使用第十节的独立转换器。

### 2. Core 命令

扩展声明并聚合到 `ProEditorCommands`：

- `insertMathInline(latex?: string)`；
- `insertMathBlock(latex?: string)`；
- `updateMath(latex: string)`；
- `deleteMath()`。

插入命令沿用 Mermaid/表格行为：`focus()`、`scrollIntoView()`，并通过 adapter 的 `prepareInsert()` 处理编辑器从未获得焦点的情况。插入后把选区设到新节点（NodeSelection），气泡菜单立即可用。工具栏/slash 的插入入口走「先弹层、确认才落文档」（与插入链接一致）：弹层预填示例公式(E = mc^2),LaTeX 输入框下提供「行内公式」勾选项(插入模式默认不勾 = 块级;编辑模式按节点当前类型初始化,变更即原地转换——行内→块级整段独占时整段替换、混排时插到段落后,块级→行内替换为含公式的段落,单步撤销),确认时按用户输入调用插入命令(新节点自动选中),取消不落任何节点——不会把示例公式留在文档里。

编辑弹层打开后不能依赖浏览器 DOM selection。应保存公式的 `{ from, to, type }`，确认时按保存位置调用 `updateAttributes` 或 `insertContentAt`。

### 3. 配置

新增：

```ts
interface MathExtensionOptions {
  HTMLAttributes: Record<string, unknown>
  render?: MathRenderer
  katexOptions?: SafeKatexOptions
}
```

`ProEditorOptions` 增加 `math?: Partial<MathExtensionOptions>`；`EditorExtensionConfig` 和 `DEFAULT_EXTENSION_CONFIG` 增加 `math: boolean`，行为与 `mermaid` 一致。

core 对外暴露 `MathRenderer`、`MathRenderOptions`、`MathRenderState` 和经过安全裁剪的 `SafeKatexOptions`，不直接暴露允许任意 HTML/URL 信任的配置面。

---

## 六、异步渲染器

### 1. Renderer 契约

动态 import 决定 renderer 必须是异步的：

```ts
type MathRenderer = (
  latex: string,
  options: ResolvedMathRenderOptions,
) => Promise<string>
```

公开 API `renderMathToString()` 也返回 `Promise<string>`，不得提供看似同步的返回值。

实现要求：

- 模块级 `katexPromise` 只加载一次；
- NodeView 使用 `idle | loading | ready | error` 状态；
- 组件卸载或源码变化时使用版本号丢弃过期结果；
- renderer 异常不能冒泡到编辑器实例。

### 2. displayMode、缓存与错误

- inline 使用 `displayMode: false`；
- block 使用 `displayMode: true`；
- cache key 至少包含 `nodeKind/displayMode + latex + stable(options)`；
- `macros` 等对象需要稳定序列化；包含函数的 options 不进入共享 memo，或必须提供稳定 cache key；
- cache 有上限和明确淘汰策略；
- renderer/options 改变时清理对应缓存。

默认安全策略：

- `trust: false` 固定开启，宿主不能通过普通 options 打开任意 HTML/URL 信任；
- `throwOnError: true`，由 renderer 捕获错误并返回 error 状态；
- 如允许宿主显式选择宽松模式，必须同时检查 KaTeX 返回的错误标记；
- 默认 `maxExpand` 保持有限值，防止宏展开造成资源消耗；
- 错误节点显示源码、错误描边和可访问错误说明，不阻塞编辑器。

不能只依赖 `try/catch`：`throwOnError: false` 下部分非法命令不会抛异常。

### 3. NodeView

core 的 `useMathNodeView()` 负责读取 attr、选择 displayMode、调用异步 renderer、处理暗色 `currentColor`、只读状态和 fallback。

三个 adapter 实现各自的 `MathNodeView.vue`（或 inline/block 两个组件），并遵守 adapter 本地命名和 CSS 变量边界。

---

## 七、输入规则

### 1. 行内 `$...$`

要求：

- 内容非空；
- 不跨换行；
- 中间不含未转义 `$`；
- 起始 `$` 前不能是字母、数字或 `$`；
- 结束 `$` 后不能紧跟字母、数字；
- `\$` 不作为分隔符。

必须回归：

- `5$ and 3$` 不转换；
- `$5 and 3$` 不转换；
- `价格为 \$5` 不转换；
- `$x^2$` 和 `$a + b$` 转换；
- `$a $ b$` 不转换。

### 2. 块级 `$$...$$`

块级规则只接受独占行或独占段落：

```text
$$
\frac{1}{2}
$$
```

块级规则使用自定义 transaction，参考官方 `canReplaceHostTextblock` 的整段替换逻辑，不直接套用普通 inline `nodeInputRule`。必须验证多行、撤销、空公式和段落前后内容。

---

## 八、Slash、Toolbar 与 adapter UI

### 1. Slash command

按现有 [slashCommand.ts](../packages/core/src/slashCommand.ts) 完整接线：

- `SlashCommandId` 增加 `math`；
- 默认 item 列表增加 `math`；
- item 增加 label、hint、aliases、keywords；
- runner context 增加 `insertMathBlock`；
- `runSlashCommandItem()` 增加 math 分支；
- 三个 adapter 的 slash 测试同步更新。

行内公式不单列 slash 项;插入弹层 LaTeX 输入框下提供「行内公式」勾选项(2026-09-06 交互修订,默认块级)。

### 2. Toolbar

更新：

- `ToolbarBuiltinKey`；
- `DEFAULT_TOOLBAR`；
- `COMMAND_REGISTRY`；
- `toolbarCompactActions`；
- 三个 adapter 的 `Toolbar.vue` 图标映射和点击处理；
- 中英文 `toolbar-config.md`。

公式按钮只插入块级公式。公式命令属于 toolbar/command registry，不放进当前只负责 Markdown、打印等文档动作的 `toolbarActions.ts`。

所有含图标和文字的按钮、菜单项遵守 `inline-flex`、`items-center`、统一 6px gap 和显式 icon 尺寸规则。

### 3. 气泡菜单和弹层

新增 `MathBubbleMenu.vue`，参考 `MediaBubbleMenu.vue` / `HorizontalRuleBubbleMenu.vue`：

- core helper 判断当前是否选中公式节点；
- `nodeDOM(from)` 提供 BubbleMenu 虚拟锚点；
- `useEditorPluginRegistration()` 注册独立 plugin key；
- `selectionUpdate` 驱动响应式状态；
- 提供“编辑”和“删除”；
- 确认时使用保存的节点位置，不依赖弹层关闭后的 DOM selection。

三个 adapter 分别使用 `ElDialog` / `NModal` / `AntModal` 和对应输入组件。弹层包含 LaTeX 输入、实时预览、错误状态、取消和确认；符号快捷栏留到 v2。

三个 `ProEditor*.vue` 都必须注入 Math NodeView、挂载 MathBubbleMenu，并传递 readonly、dark、locale。

---

## 九、Markdown

### 1. v1 范围

v1 只做 `mathBlock` 的 `$$...$$` 往返：

- block tokenizer 解析独占行 `$$...$$`；
- `parseMarkdown()` 创建 `mathBlock` 并写入 `latex`；
- `renderMarkdown()` 输出 `$$...$$`；
- 导入导出后 JSON 等价。

项目当前 `@tiptap/markdown` 已通过 Mermaid 的 `markdownTokenName`、`parseMarkdown`、`renderMarkdown` 钩子证明扩展缝存在；实现时仍需用锁定的 3.27.1 做专项测试。

### 2. 行内 Markdown

行内 `$...$` 留到 v1.x。当前不能写成“默认降级为 HTML”，因为没有 `renderMarkdown` handler 的节点可能被 MarkdownManager 输出为空字符串。

v1.x 必须先解决 `$5 and $3` 等货币误判，再加入 inline tokenizer、parse/render 钩子和 round-trip 测试。

---

## 十、HTML 与打印/PDF

### 1. HTML

`editor.getHTML()` 保留 `data-type` 和 `data-latex`，用于持久化、粘贴互操作和再次导入；不承诺包含 KaTeX 展开后的 HTML。

### 2. 打印主线：MathML

现有 `PRINT_STYLES` 是硬编码常量，`PrintActionOptions` 没有额外样式入口；Mermaid 通过预内联自包含 SVG 解决打印依赖。公式打印采用同样的自包含思路：

```ts
inlineMathPrintHtml(html: string): Promise<string>
```

实现：

- 查找 `data-type="math-inline"` / `data-type="math-block"`；
- 读取 `data-latex`；
- 使用 `katex.renderToString(latex, { output: 'mathml', displayMode })`；
- 用 MathML 替换公式节点；
- 单个公式失败时保留原源码，不阻塞整篇打印。

打印流程：

1. `ctx.getHTML()`；
2. `inlineMermaidSvg()`；
3. `inlineMathPrintHtml()`；
4. `printEditorContent()` 创建 iframe 并打印。

主线方案不依赖 KaTeX CSS 和字体。Chrome、Safari、Firefox 的 MathML 支持必须通过 `scripts/export-pdf-playwright-smoke.mjs` 做实际回归；若视觉或字体不达标，再评估备用方案。

### 3. 备用方案：注入 CSS

只有 MathML 打印 PoC 不达标时，才考虑给 `PrintActionOptions` 增加 `extraStyles`，将 KaTeX CSS 注入 srcdoc。该方案需要专项验证字体相对路径、打包产物 URL 和 CDN 策略，不作为 v1 默认实现。

---

## 十一、扩展与后续路径

预留但不扩大 v1 范围：

1. renderer 可注入，未来可换 MathJax 或服务端预渲染；
2. `katexOptions` 允许安全的 `macros`、字体/输出配置，`trust` 由 core 固定为 false；
3. `\ce` 等化学命令以后通过独立 mhchem 扩展处理；
4. `\(`、`\[` 只需追加 input rule，不需要迁移 schema；
5. 公式编号、对齐、display 属性可通过新增 attr 扩展；
6. DOCX/OMML 从 `data-latex` 源码取值；
7. 内联编辑需要 attr → 文本内容的 schema migration，不能视为无迁移升级。

明确不做：快捷键、MathQuill、独立行内 toolbar 按钮（行内经弹层勾选项进入）、多分隔符自动识别。

---

## 十二、工作量与实现顺序

| 部分 | 内容 | 估算 |
| --- | --- | --- |
| core | schema、配置、异步 renderer、输入规则、命令、block Markdown、`inlineMathPrintHtml`、测试和 registry/slash/locale/index 接线 | 3 天 |
| 每个 adapter | CSS、NodeView、Toolbar、MathBubbleMenu、Dialog/Modal、对等测试 | 各约 1 天 |
| 文档与验证 | toolbar-config 中英、props、quick-start、playground、changeset、PDF 冒烟 | 1 天 |

实现顺序：

1. 依赖、adapter CSS、math schema、配置和 core 命令；
2. 异步 renderer、缓存和 NodeView composable；
3. 输入规则，先通过价格误判测试；
4. block Markdown tokenizer/renderer；
5. MathML 打印 PoC 和 PDF 冒烟；
6. 三个 adapter 对等接入 NodeView、BubbleMenu、弹层和 toolbar；
7. 更新 docs、README、changeset 和 playground；
8. 完整 typecheck、test、build、boundary check 和视觉回归。

---

## 十三、验收清单

### Core

- math schema HTML/JSON round-trip；
- 官方 `inline-math` / `block-math` HTML 粘贴还原；
- inline/block 命令、NodeSelection 更新和删除；
- `$` 价格误判、转义、跨行和块级多行回归；
- 异步 renderer 加载、竞态、卸载、缓存和 displayMode 隔离；
- 非法 LaTeX 不炸编辑器；
- block `$$` Markdown 往返；
- `math: false` 和自定义 extensions 行为；
- MathML 打印转换和失败 fallback。

### 三个 adapter

- NodeView renderer 注入；
- Dialog/Modal 打开、取消、确认；
- 编辑、删除、只读、暗色和 locale；
- BubbleMenu 定位和 selectionUpdate；
- Toolbar/slash 对等行为；
- CSS 构建产物包含 KaTeX 样式；
- 图标文字间距、垂直居中和 boundary 检查。

### 命令

```bash
pnpm --filter tiptap-vue-pro-core typecheck
pnpm --filter tiptap-vue-pro-core test
pnpm --filter tiptap-vue-pro-element-plus typecheck
pnpm --filter tiptap-vue-pro-element-plus test
pnpm --filter tiptap-vue-pro-naive typecheck
pnpm --filter tiptap-vue-pro-naive test
pnpm --filter tiptap-vue-pro-ant-design-vue typecheck
pnpm --filter tiptap-vue-pro-ant-design-vue test
pnpm --filter playground build
```

另外执行 AGENTS.md 要求的三条 adapter boundary `rg` 检查，并在 playground/Playwright 中验证行内、块级、非法公式、暗色、只读、Markdown 和 PDF。

在 MathML 打印 PoC 和 PDF 冒烟通过前，不得宣称“PDF 打印含公式”已支持。
