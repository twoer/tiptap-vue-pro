# 为什么用它

直接接入 Tiptap 并不难,难的是把一个编辑器打磨到业务可用:

- 工具栏要能感知光标状态,还要处理禁用态和激活态。
- 链接、图片、表格、Markdown 都需要弹窗、菜单、文件选择和提示反馈。
- 图片不仅要支持 URL,还要支持上传、粘贴、拖拽、替换、尺寸和题注。
- 如果团队有多套 UI 技术栈,同一套编辑器行为还要在多个组件库里保持一致。

Tiptap Vue Pro 把这些重复工作收进 Core 和 Adapter:

| 层 | 负责 |
| --- | --- |
| `tiptap-vue-pro-core` | Tiptap 扩展、命令聚合、Markdown、图片上传调度、行为配置 |
| UI Adapter | 工具栏、弹窗、下拉菜单、消息提示、气泡菜单、样式 |
| Playground | 功能对照、手动验收、在线 Demo |

## 适合的项目

- 后台、CMS、知识库、运营配置台等需要富文本输入的 Vue 3 项目。
- 已经使用 Element Plus、Naive UI 或 Ant Design Vue 的业务系统。
- 希望在多个 UI 库里复用同一套编辑器行为的组件库或中后台平台。
- 想基于 Tiptap 做自定义 UI,但希望复用命令、扩展、Markdown 和上传逻辑的高级场景。

## 不适合的项目

- 只需要极轻量的 textarea 或 Markdown 编辑器。
- 需要 Google Docs 级实时协同、评论审阅、修订历史的产品。
- 希望完全绕开 Tiptap / ProseMirror 数据模型的编辑器。

## 和 Tiptap 的边界

Tiptap 仍然是底层编辑器引擎。本项目提供的是 Vue 组件封装和业务默认值:你可以继续使用 Tiptap 扩展、ProseMirror 插件和 JSON/HTML 输出。
