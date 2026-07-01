# Tiptap Vue Pro

English: [README.en-US.md](./README.en-US.md)

> 现代化 Vue 3 富文本编辑器组件,基于 Tiptap v3 的社区封装。

⚠️ 本项目与 [Tiptap](https://tiptap.dev) 官方无关。底层编辑器能力来自 Tiptap v3 和 ProseMirror。

## 链接

- 文档站点: <https://twoer.github.io/tiptap-vue-pro/>
- 在线 Demo: <https://twoer.github.io/tiptap-vue-pro/playground/>
- 快速开始: <https://twoer.github.io/tiptap-vue-pro/guide/quick-start>
- API 文档: <https://twoer.github.io/tiptap-vue-pro/api/props>

## 为什么做这个

在 Vue 3 项目里接入 Tiptap,你通常还需要自己处理工具栏状态、链接弹窗、图片上传/粘贴/拖拽、视频/音频/文件上传、表格操作、气泡菜单、颜色、Markdown 导入导出等业务胶水。

Tiptap Vue Pro 把这些能力封装成一套 UI 无关 core,再提供三套对等 adapter:

| 包 | 组件 | UI 库 |
| --- | --- | --- |
| `tiptap-vue-pro-element-plus` | `ProEditorElementPlus` | Element Plus |
| `tiptap-vue-pro-naive` | `ProEditorNaive` | Naive UI |
| `tiptap-vue-pro-ant-design-vue` | `ProEditorAntDesignVue` | Ant Design Vue |
| `tiptap-vue-pro-core` | `useProEditor` | Headless / 自绘 UI |

## 特性

- Tiptap v3 + Vue 3 + TypeScript
- HTML / JSON 输出,支持 `v-model`
- 完整工具栏:标题、格式化、字体、字号、行高、颜色、高亮、对齐、列表、链接、图片、表格、分割线样式、Markdown、打印、预览、全屏
- 图片上传、粘贴、拖拽、替换、对齐、尺寸、题注
- 视频、音频和文件上传,支持播放器/文件卡片展示、多选、类型和大小限制,以及选中后的上下文编辑
- 表格插入、行列操作、合并拆分、表头切换
- Markdown 导入 / 导出
- 开发者诊断日志,支持按 lifecycle、command、upload、table 等通道排查接入问题
- 组件级暗色模式、只读模式、字数统计
- Nuxt / SSR 友好
- Element Plus / Naive UI / Ant Design Vue adapter 行为对等

## 安装

Element Plus:

```bash
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Naive UI:

```bash
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Ant Design Vue:

```bash
pnpm add tiptap-vue-pro-ant-design-vue ant-design-vue
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Headless Core:

```bash
pnpm add tiptap-vue-pro-core @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 最小示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello world</p>')
</script>

<template>
  <ProEditorElementPlus v-model="content" />
</template>
```

Naive UI 和 Ant Design Vue 用法保持对等,替换组件名和样式入口即可。完整示例见 [文档站](https://twoer.github.io/tiptap-vue-pro/guide/examples)。

## 常用文档

| 目标 | 文档 |
| --- | --- |
| 选择 adapter | [三套 Adapter](https://twoer.github.io/tiptap-vue-pro/guide/adapters) |
| 自定义按钮分组 | [工具栏](https://twoer.github.io/tiptap-vue-pro/guide/toolbar) |
| 配置字体、字号、行高、色板、代码语言、分割线样式 | [配置菜单和默认行为](https://twoer.github.io/tiptap-vue-pro/guide/configuration) |
| 配置链接 target、表格表头、图片和媒体附件行为 | [EditorBehaviorOptions](https://twoer.github.io/tiptap-vue-pro/api/editor-behavior-options) |
| 接入图片上传 | [图片上传](https://twoer.github.io/tiptap-vue-pro/guide/image-upload) |
| 接入视频、音频和文件上传 | [视频、音频和文件上传](https://twoer.github.io/tiptap-vue-pro/guide/media-upload) |
| 使用 Nuxt / SSR | [Nuxt / SSR](https://twoer.github.io/tiptap-vue-pro/guide/ssr) |
| 排查接入和编辑器行为问题 | [开发者诊断](https://twoer.github.io/tiptap-vue-pro/advanced/developer-diagnostics) |
| 理解整体设计 | [整体架构](https://twoer.github.io/tiptap-vue-pro/advanced/architecture) |

## 本地开发

```bash
pnpm install
pnpm dev            # playground: http://localhost:5173
pnpm docs:dev       # docs: http://localhost:5173/tiptap-vue-pro/
pnpm typecheck
pnpm test
pnpm build
```

部署由 `.github/workflows/deploy.yml` 负责:push 到 `main` 后会构建 VitePress 文档站,并把 playground 合并到 `/playground/` 子路径。

## License

[MIT](./LICENSE)

## 致谢

- [Tiptap](https://tiptap.dev)
- [ProseMirror](https://prosemirror.net)
- [Element Plus](https://element-plus.org)
- [Naive UI](https://www.naiveui.com/)
- [Ant Design Vue](https://antdv.com/)
