# FAQ

## 这是 Tiptap 官方项目吗

不是。本项目是基于 Tiptap v3 + Vue 3 的社区封装。Tiptap 核心仍遵循它自己的协议和生态约定。

## 为什么 Nuxt 里建议包 `<ClientOnly>`

Tiptap / ProseMirror 依赖浏览器环境。Core 默认使用 `immediatelyRender: false` 降低 SSR 阶段的 hydration 风险,但 Nuxt 项目仍建议把开箱组件放进 `<ClientOnly>`。

## Markdown 导出为什么会丢样式

Markdown 表达的是语义结构,不是完整 HTML 样式。字体、字号、行高、缩进、表格列宽、部分颜色等 HTML 布局和样式能力导出 Markdown 时可能无法完整保留。需要保真时使用 HTML 或 JSON 输出。

## Slash Command 会影响 Markdown 导入导出吗

不会。Slash Command 只是在编辑时把 `/query` 转换成对应命令,例如插入表格、待办或代码块。真正写入文档的是普通 Tiptap 节点,Markdown 导入/导出仍按原有节点语义处理。

## 查找替换会影响 Markdown 导入导出吗

不会。查找替换只是在编辑器内根据纯文本匹配生成高亮和替换事务。它不写入额外节点或标记,关闭面板后高亮会清除,Markdown 导入/导出仍按原有文档语义处理。

## 图片上传为什么没有反应

先检查三件事:

1. 是否传入了 `uploadImage`。
2. `uploadImage(file)` 是否返回了可访问的图片 URL。
3. 如果限制了文件类型,`editorBehaviorOptions.image.accept` 是否包含当前文件 MIME 类型。

## `extensions` 和 `toolbarOptions` 该怎么选

`toolbarOptions` 只改变菜单数据和动作参数,例如字体、字号、颜色、代码语言、分割线样式、表格网格。`extensions` 会覆盖默认 Tiptap 扩展数组,适合高级定制。多数业务配置优先用 `toolbarOptions`。

## `toolbar` 和 `toolbarOptions` 有什么区别

`toolbar` 决定有哪些按钮、如何分组、顺序如何。`toolbarOptions` 决定按钮背后的菜单数据,例如字体列表、色板、分割线样式和 Markdown 导出文件名。

## 三套 Adapter 行为真的一致吗

公共编辑器行为都在 Core,三套 Adapter 只负责各自 UI 库渲染。项目也为 Element Plus、Naive UI、Ant Design Vue 分别保留组件测试,覆盖链接、图片、表格、Slash Command、查找替换、工具栏配置等高风险交互;表格列宽拖动、抓手、合并气泡和菜单密度通过 `pnpm test:table:e2e` 做三套 UI 浏览器回归,Slash Command 通过 `pnpm test:slash:e2e` 覆盖键盘、点击、Escape 和 adapter 切换,查找替换通过 `pnpm test:find-replace:e2e` 覆盖面板、匹配、替换和 adapter 切换。

## GitHub Pages 下为什么要配置 base

仓库 Pages 路径是 `/tiptap-vue-pro/`。文档站使用 VitePress 的 `base: '/tiptap-vue-pro/'`;Playground 被合并到 `/playground/` 子路径,因此 Playground 的 Vite base 是 `/tiptap-vue-pro/playground/`。
