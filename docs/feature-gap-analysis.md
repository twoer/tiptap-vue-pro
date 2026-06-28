# 功能差距分析:tiptap-vue-pro vs 主流编辑器

> 对比基准:飞书文档 / 语雀 / Notion / TinyMCE / WangEditor,以及 Tiptap v3 官方生态。
> 输出时间:2026-06-28。按「紧急程度」从高到低排序,每项标注 [P0/P1/P2/P3]。

---

## 当前功能基线(已实现)

| 维度 | 已有能力 |
| --- | --- |
| 格式化 | 加粗 / 斜体 / 删除线 / 下划线 / 标题(H1–H4) / 正文 |
| 颜色 | 文字颜色(40 预设色 + 自定义 hex) / 背景高亮(32 预设色 + 自定义) |
| 对齐 | 左 / 中 / 右 / 两端 |
| 列表 | 无序 / 有序 / 任务(checkbox) / 引用 / 代码块 / 分割线 |
| 媒体 | 链接(弹窗) / 图片(上传 + 粘贴 + 拖拽) / 表格(网格选择器) |
| 操作 | 撤销 / 重做 / 清除格式 |
| 视图 | 全屏 / 预览(只读) / 暗色模式(组件级) |
| 数据 | v-model(HTML / JSON) / Markdown 导入导出 / 字数统计 |
| 图片 | 图片上传 / 粘贴 / 拖拽 / 网络图片 / 尺寸预设 / 拖拽缩放 / 左中右对齐 / 题注 / 替换 / 删除 |
| 表格 | 网格插入 / 行列抓手 / 行列增删 / 行列移动 / 合并拆分 / 表头切换 / 删除表格 |
| 架构 | 三层架构(core 无 UI + element-plus adapter + naive adapter) / 文字、表格、图片气泡菜单 |

---

## P0 —— 紧急:回归保障 / 已承诺能力的质量底座

### 1. [P0] Adapter 组件级测试覆盖不足

**现状:** `packages/core/` 有完整的 Vitest 测试(挂真实 Tiptap 验证命令产出)。`packages/element-plus/` / `packages/naive/` 已补 adapter 组件冒烟测试,覆盖网络图片插入/非法地址提示、链接弹窗插入/非法地址/移除、上传图片按钮、预览/全屏事件、图片题注聚焦当前选中图、图片尺寸/对齐/删除/替换成功失败、卸载清理订阅、主组件 readonly/preview 隐藏工具栏和浮层。表格菜单、Markdown 导入导出等交互仍需要继续补覆盖。

**对比:** 主流组件库(Element Plus 本身、WangEditor、TinyMCE)都有组件级测试。当前项目的 adapter 逻辑已经包含多个容易回归的细节:插入前 `prepareInsert()`、弹窗失焦后的 selection 保持、图片题注聚焦、只读/预览态隐藏浮层、Naive/Element Plus 双实现对等。

**影响:**
- 已覆盖图片、链接、上传、视图切换等高风险回归点,但表格 / Markdown 等路径仍主要依赖手测
- 双 adapter 对等性已有自动化保障,但覆盖面还不够系统
- 后续做 Slash Command / Mention 前,仍应继续扩大基础交互回归网

**建议:** 继续扩展两个 adapter 的 Vitest + Vue Test Utils 组件测试。下一批优先覆盖:
- 表格菜单:插入表格网格、表格气泡菜单、行列抓手菜单命令
- Markdown:导入成功/失败、导出空能力提示、下载文件行为
- 链接弹窗:已有链接更新路径(非空选区且不改文字时走 `setLink`)

**工作量:** 中(测试基础设施 + 双 adapter 对等用例;core 基本不动)。

---

## P1 —— 高优先级:用户感知强烈的「主流标配」缺失

### 3. [P1] Slash Command(斜杠命令菜单)

**现状:** 无。用户只能通过顶部工具栏插入内容。

**对比:** **飞书 / 语雀 / Notion 全部支持** slash command——这是 2025 年块编辑器的**事实标准交互**。用户在空行输入 `/` 弹出菜单,快速插入标题/列表/代码块/表格/分割线等,无需鼠标移到工具栏。AGENTS.md 路线图也列了这一项。

**影响:** 与现代编辑器体验差距明显,是用户「第一眼觉得落后」的点。

**建议:** 用 `@tiptap/suggestion` + `@tiptap/extension-slash-command`(v3 新增)实现。core 提供命令注册表,adapter 渲染下拉菜单。注意 core 仍要保持 UI 无关——命令项数据由 core 产出,菜单组件由 adapter 渲染。

**工作量:** 中(官方扩展 + 一个 dropdown 组件)。

---

### 4. [P1] Mention(@提及)

**现状:** 无。

**对比:** 飞书 / 语雀 / Notion 全部支持 `@` 提及用户、文档、日期。协作类场景(评论、@责任人)是刚需。AGENTS.md 路线图列了「Mention / 文件附件」。

**建议:** 用官方 `@tiptap/extension-mention` + `@tiptap/suggestion`。需要 adapter 注入「数据源」(用户列表 API),同样遵循 NotifyFn 的边界模式——core 不直接 fetch,由 adapter 注入查询函数。

**工作量:** 中(扩展接入 + 一个 mention 弹层组件 + 数据源注入契约)。

---

### 5. [P1] 图片尺寸调整 / 对齐 ✅ 已实现

**现状(2026-06-28 已实现):** 自定义 Image NodeView 支持拖拽缩放、尺寸预设、小/中/大/原始、左/中/右对齐、题注、替换、删除;工具栏支持上传图片和网络图片入口。Element Plus / Naive 两个 adapter 的图片浮动工具条能力对等。

**对比:**
- **飞书 / 语雀 / Notion:** 图片选中后显示尺寸拖拽手柄 + 对齐工具条
- **Tiptap v3:** 新增了原生 **Resizable Node Views** API(可拖拽角/边调整尺寸)
- 第三方:`tiptap-extension-resizable-image`(社区方案,React/Vue/Next 都测过)

**影响:** 已补齐主流图片排版基本能力。后续主要风险转为 adapter 交互回归和更多图片工作流(如上传前裁剪)。

**建议:** 保持 core 的 NodeView UI 无关实现,继续用 adapter 组件测试锁住「题注只读」「多图题注聚焦当前图」「替换/删除/尺寸/对齐」等回归点。

**工作量:** 已完成;剩余为测试补强。

---

### 6. [P1] 表格高级操作(增删行列、合并单元格、对齐)✅ 已实现

**现状(2026-06-28 已实现):** `ProEditorCommands` 补齐了表格结构操作命令(`addRowBefore/After` / `deleteRow` / `addColumnBefore/After` / `deleteColumn` / `mergeCells` / `splitCell` / `toggleHeaderRow` / `toggleHeaderColumn` / `deleteTable`),两个 adapter(element-plus / naive)在选中表格单元格时(`isActive('table')`)浮现「表格操作」下拉,文案与命令调用完全对等。core 层有 7 个挂真实 Tiptap 的测试覆盖(行/列增删、删除表格、表头切换、合并拆分冒烟)。

**对比:**
- **飞书 / 语雀 / Notion / TinyMCE:** 右键或工具栏弹层,完整的行/列/单元格操作
- **Tiptap v3 `TableKit`:** 原生支持 `addRow` / `deleteRow` / `addColumn` / `deleteColumn` / `mergeCells` / `splitCell` / `toggleHeaderRow` 等全套命令,只是本项目没暴露

**影响:** 表格一旦建好就「死」了,改不了结构。对 CMS / 后台管理这类表格密集场景是硬伤。

**建议:** 在 core 的 `ProEditorCommands` 补一组表格命令(`addRowBelow` / `deleteRow` / `addColumnRight` / `deleteColumn` / `mergeCells` / `splitCell` / `toggleHeader`)。adapter 在表格右键 / 选中时弹操作菜单。命令本身 Tiptap 全部内置,只是接线工作。

**工作量:** 中(命令接线 + 右键菜单组件,无算法负担)。

---

### 7. [P1] 上下标 / 行内代码已有但缺失补集(上标 / 下标)

**现状:** 有行内 `code`(StarterKit 自带),但**没有上标 / 下标**(`superscript` / `subscript`)。

**对比:** 飞书 / 语雀 / TinyMCE 都有(数学公式、化学式、脚注引用场景必需)。

**建议:** 装官方 `@tiptap/extension-superscript` + `@tiptap/extension-subscript`,加 2 个命令 + 2 个工具栏按钮。先确认不在 v3 StarterKit 内(目前不在)。

**工作量:** 小。

---

### 8. [P1] 图片上传前裁剪

**现状:** 无。选图即传即插,用户无法在上传前裁剪/锁定比例。

**场景:** 头像、封面、商品图、卡片图等需要固定比例(1:1 / 16:9)的场景。

**对比:** 飞书/语雀文档不强制裁剪(通用文档场景),但 CMS / 后台管理类编辑器(TinyMCE、各类企业自研)普遍提供。

**架构优势(最重要):core 零改动。** 裁剪本质是在 `File → uploadImage` 之间插一步预处理,产出的还是 `File`,`UploadImage` 契约不变:

```
adapter 层:选图 → [裁剪弹窗] → 裁剪后的 File → core 的 uploadAndInsertImage(file)
                                                       ↑
                                                  core 完全无感
```

- `core/` 的 `handleImageFiles` / `uploadAndInsertImage` 不动
- `UploadImage` 契约不变(仍是 `(file: File) => Promise<string | null>`)
- 裁剪弹窗是纯 adapter UI,用 `cropperjs`(事实标准,~40KB,框架无关)

**建议设计:** 新增可选 prop(不全局强制,通用富文本场景保留"选图即插"的流畅):

```ts
imageCrop?: boolean | { ratio?: number; fixed?: boolean }
// false(默认):选图即插
// true:自由裁剪
// { ratio: 1, fixed: true }:锁定正方形(头像场景)
```

**关键坑(务必区分路径):**
- **按钮选图**:走裁剪流程(用户主动,期待配置)
- **粘贴 / 拖拽**:跳过裁剪,直接传原图(截图粘贴场景,弹裁剪框会很打断)

**与 P1-5 的关系:** 互补——P1-5 是「插入后」调整尺寸/对齐,裁剪是「上传前」定形。建议两者配套实施。

**工作量:** 小中(adapter 加一个裁剪弹窗组件 + 引入 cropperjs,core 零改动)。

---

## P2 —— 中优先级:体验打磨 / 进阶能力

### 9. [P2] 多人协同编辑(Yjs / CRDT)

**现状:** 无。单机编辑,无实时协同。

**对比:** 飞书 / 语雀 / Notion **核心卖点**就是实时协同。Tiptap 官方有成熟的 `@tiptap/extension-collaboration`(基于 Yjs)+ `y-prosemirror`。

**影响:** 协同是「平台级」功能,实现复杂(需要后端 WebSocket / Yjs server)。对「组件库」定位而言不是必须,但若要进协作场景必备。

**建议:** 作为可选扩展提供(`extensions` prop 传入)。不在默认包里(避免引入 Yjs 重依赖)。需要配套文档说明如何对接 Yjs WebSocket 后端。

**工作量:** 高(前端扩展 + 后端服务)。

---

### 10. [P2] 数学公式(LaTeX / KaTeX)

**现状:** 无。代码块不能渲染数学公式。

**对比:** 飞书 / 语雀 / Notion 都支持 LaTeX 公式块(基于 KaTeX)。学术、技术文档场景刚需。

**建议:** 用 `@tiptap-pro/extension-mathematics`(注意是 Pro 包,需 license)或社区 `tiptap-math-extension`(基于 KaTeX,MIT)。core 暴露 `insertMath` 命令,adapter 渲染 KaTeX。

**工作量:** 中(注意 Pro 包授权问题,优先社区方案)。

---

### 11. [P2] 视频嵌入 / 文件附件 / Embed(第三方内容)

**现状:** 无。图片之外的媒体类型都不支持。AGENTS.md 路线图列了「视频嵌入」「文件附件」。

**对比:**
- **飞书 / 语雀:** 支持视频、文件附件、第三方 embed(YouTube/B站/Figma)
- **Tiptap v3:** 官方无,社区有 `@tiptap/extension-youtube` 等

**建议:** 视频用自定义 NodeView(粘贴链接自动识别 YouTube/B 站);文件附件用 `@tiptap/extension-file` 或自定义节点。core 暴露 `insertVideo` / `insertFile` 命令 + 上传函数注入(复用 UploadImage 模式)。

**工作量:** 中高(每种媒体一个 NodeView + 识别逻辑)。

---

### 12. [P2] 内容搜索与替换(Find & Replace)

**现状:** 无。

**对比:** TinyMCE / WangEditor / Word 都有 `Ctrl+F` / `Ctrl+H` 查找替换。长文档编辑的标配。飞书 / 语雀因块结构暂弱化,但 CMS 场景刚需。

**建议:** 用 Tiptap 社区的 `tiptap-extension-search-and-replace`,或基于 ProseMirror 的搜索插件自实现。core 暴露 `find` / `replace` / `replaceAll` 命令 + 高亮命中。

**工作量:** 中。

---

### 13. [P2] 自动保存 / 本地草稿

**现状:** 无。内容只通过 v-model 上抛,是否保存完全由宿主决定。

**对比:** 飞书 / 语雀 / Notion 都有自动保存 + 历史版本。离线场景下还会本地缓存草稿。

**建议:** core 提供可选的「防抖自动保存」(配置 saveFn + interval)和「localStorage 草稿」(防误关页面丢内容)。这是数据层能力,可在 core 实现(不破坏 UI 无关)。

**工作量:** 小中。

---

### 14. [P2] 自定义主题 / 工具栏可配置

**现状:** 工具栏按钮是写死的,用户无法增删按钮、无法配置顺序。`extensions` prop 可以覆盖扩展,但工具栏 UI 无法定制。

**对比:** TinyMCE / WangEditor / Quill 都支持工具栏自定义(显示哪些按钮、分组)。主流组件库的常态。

**建议:** 新增 `toolbar` prop(数组,描述分组与按钮),core 提供命令注册表,adapter 按配置渲染。这是「组件库」走向成熟必备的灵活性。

**工作量:** 中(涉及工具栏重构)。

---

## P3 —— 低优先级:锦上添花

### 15. [P3] AI 辅助写作(润色 / 续写 / 摘要 / 翻译)

**现状:** 无。

**对比:** Notion AI / 飞书智能伙伴 / 语雀 AI 是 2025 年编辑器的差异化卖点。选中文字 → 弹 AI 菜单(润色/续写/摘要/翻译/改语气)。

**建议:** 设计 `AIFn` 注入契约(类似 NotifyFn / UploadImage 的边界模式):core 决定「何时弹 AI 菜单 + 选区上下文」,adapter 注入「调用哪个 LLM」。避免 core 绑定特定 AI 厂商。

**工作量:** 高(契约设计 + 弹层 + 流式输出 UI)。

---

### 16. [P3] 国际化(i18n)

**现状:** 文案全部硬编码中文(工具栏 tooltip、链接弹窗、notify 文案)。

**对比:** Element Plus / Naive UI 本身都内置 i18n。作为组件库出海时刚需。

**建议:** 用 Vue I18n,所有文案走 `t('toolbar.bold')`。提供 zh-CN / en-US 两套语言包。注意:notify 文案在 core 调用处,需要把文案也改成 key,由 adapter 注入 t 函数(或 core 接受 i18n 字典)。

**工作量:** 中(机械但量大)。

---

### 17. [P3] 可访问性(a11y / 键盘导航 / ARIA)

**现状:** 已开始给高频纯图标按钮补 `aria-label`(网络图片、上传图片、预览、全屏、图片题注/替换/删除),但还没有系统性 a11y 方案。颜色选择器无键盘导航,大部分 active 态还没有 `aria-pressed`,无完整屏幕阅读器验证。

**对比:** TinyMCE / CKEditor 有 WCAG 合规。政府/教育/企业内网场景有时是合规要求。

**建议:** 工具栏按钮补 `aria-label` / `aria-pressed`(active 态);颜色面板支持方向键导航;表格支持键盘操作。ProseMirror 本身 a11y 基础不错,主要补 UI 层。

**工作量:** 中。

---

### 18. [P3] 代码块语法高亮 + 语言选择

**现状:** 代码块是纯文本(`StarterKit` 的 `CodeBlock`),无语法高亮、无语言选择下拉。

**对比:** 飞书 / 语雀 / Notion 代码块都有语言高亮(基于 Prism / highlight.js / Shiki)+ 语言下拉。

**建议:** 用 `@tiptap/extension-code-block-lowlight`(基于 lowlight / highlight.js)替换默认 CodeBlock,或在 adapter 用 NodeView 套 Shiki。core 配置扩展,adapter 提供语言下拉。

**工作量:** 小中。

---

### 19. [P3] Nuxt / SSR 支持

**现状:** 无 SSR 验证。`useEditor` 在 SSR 下需要特殊处理(编辑器只在客户端初始化)。

**对比:** 主流 Vue 组件库都有 SSR 适配。AGENTS.md 路线图列了「Nuxt 支持」。

**建议:** 用 `ClientOnly` 包裹编辑器组件,验证 Nuxt 下不报 `window is not defined`,提供 Nuxt module 或使用文档。

**工作量:** 小(主要是文档 + 验证)。

---

## 优先级速查表

| 优先级 | 项目 | 性质 | 工作量 |
| --- | --- | --- | --- |
| **P0** | 1. Adapter 组件级测试覆盖 | 质量 / 可维护 | 中 |
| **P1** | 3. Slash Command | 交互标配 | 中 |
| **P1** | 4. Mention(@提及) | 协作标配 | 中 |
| **P1** | 7. 上标/下标 | 格式补集 | 小 |
| **P1** | 8. 图片上传前裁剪 | 固定比例场景刚需,core 零改动 | 小中 |
| **P2** | 9. 多人协同(Yjs) | 平台级 | 高 |
| **P2** | 10. 数学公式(KaTeX) | 技术文档 | 中 |
| **P2** | 11. 视频/文件/Embed | 媒体扩展 | 中高 |
| **P2** | 12. 查找替换 | 长文标配 | 中 |
| **P2** | 13. 自动保存/草稿 | 数据安全 | 小中 |
| **P2** | 14. 工具栏可配置 | 灵活性 | 中 |
| **P3** | 15. AI 辅助写作 | 差异化 | 高 |
| **P3** | 16. 国际化(i18n) | 出海 | 中 |
| **P3** | 17. 无障碍(a11y) | 合规 | 中 |
| **P3** | 18. 代码块语法高亮 | 技术体验 | 小中 |
| **P3** | 19. Nuxt/SSR 支持 | 生态 | 小 |

---

## 建议的实施顺序(三阶段)

**阶段一(补齐测试底座,当前优先):** P0-1
- 给 Element Plus / Naive 两个 adapter 补组件级冒烟测试
- 已覆盖网络图片、链接、上传图片、图片气泡菜单、预览/全屏事件、只读/预览隐藏浮层等高风险交互
- 继续补表格菜单与 Markdown 导入导出
- 新增 adapter 功能时保持「两个 adapter 对等 + 对等测试」

**阶段二(主流标配功能,3–5 周):** P1-3 → P1-4 → P1-7 → P1-8
- 先做用户感知最强的 Slash Command
- 再做协作标配 Mention
- 上标/下标作为小补集穿插实现
- 图片裁剪留在图片工作流继续打磨阶段,core 契约保持不变
- 每个功能 core 补命令 + 测试,两个 adapter 同步加按钮

**阶段三(差异化与生态,持续):** P2 / P3 按用户反馈选
- 协同 / AI / 数学公式 视目标场景投入
- i18n / a11y / SSR 在用户群扩大后逐步补
