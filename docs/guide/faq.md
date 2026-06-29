# FAQ

## 这是 Tiptap 官方项目吗

不是。本项目是基于 Tiptap v3 + Vue 3 的社区封装。Tiptap 核心仍遵循它自己的协议和生态约定。

## 为什么 Nuxt 里建议包 `<ClientOnly>`

Tiptap / ProseMirror 依赖浏览器环境。Core 默认使用 `immediatelyRender: false` 降低 SSR 阶段的 hydration 风险,但 Nuxt 项目仍建议把开箱组件放进 `<ClientOnly>`。

## Markdown 导出为什么会丢样式

Markdown 表达的是语义结构,不是完整 HTML 样式。字体、字号、行高、缩进、部分颜色等 HTML 样式能力导出 Markdown 时可能无法完整保留。需要保真时使用 HTML 或 JSON 输出。

## 图片上传为什么没有反应

先检查三件事:

1. 是否传入了 `uploadImage`。
2. `uploadImage(file)` 是否返回了可访问的图片 URL。
3. 如果限制了文件类型,`editorBehaviorOptions.image.accept` 是否包含当前文件 MIME 类型。

## `extensions` 和 `toolbarOptions` 该怎么选

`toolbarOptions` 只改变菜单数据和动作参数,例如字体、字号、颜色、代码语言、表格网格。`extensions` 会覆盖默认 Tiptap 扩展数组,适合高级定制。多数业务配置优先用 `toolbarOptions`。

## `toolbar` 和 `toolbarOptions` 有什么区别

`toolbar` 决定有哪些按钮、如何分组、顺序如何。`toolbarOptions` 决定按钮背后的菜单数据,例如字体列表、色板和 Markdown 导出文件名。

## 三套 Adapter 行为真的一致吗

公共编辑器行为都在 Core,三套 Adapter 只负责各自 UI 库渲染。项目也为 Element Plus、Naive UI、Ant Design Vue 分别保留组件测试,覆盖链接、图片、表格、工具栏配置等高风险交互。

## GitHub Pages 下为什么要配置 base

仓库 Pages 路径是 `/tiptap-vue-pro/`。文档站使用 VitePress 的 `base: '/tiptap-vue-pro/'`;Playground 被合并到 `/playground/` 子路径,因此 Playground 的 Vite base 是 `/tiptap-vue-pro/playground/`。
