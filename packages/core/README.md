# Tiptap Vue Pro Core

English: [README.en-US.md](./README.en-US.md)

UI 无关的 Tiptap v3 + Vue 3 富文本编辑器核心层。

这个包只提供 `useProEditor()`、默认扩展、命令聚合、图片与媒体附件上传辅助和类型契约,不包含现成 UI。想开箱即用请安装对应 adapter:

- Element Plus: `tiptap-vue-pro-element-plus`
- Naive UI: `tiptap-vue-pro-naive`
- Ant Design Vue: `tiptap-vue-pro-ant-design-vue`

## 能力

- 标题、加粗/斜体/删除线/下划线、行内代码、上标/下标
- 字体、字号、行高、文字颜色、背景高亮、文本对齐
- 段落/标题缩进,以及列表层级缩进
- 链接、图片、视频、音频、文件附件、表格、任务列表、代码块、Markdown 导入导出

> 字体、字号、行高、缩进属于 HTML 样式能力;导出 Markdown 时可能丢失,导出 HTML / JSON 可保留。

## 安装

```bash
pnpm add tiptap-vue-pro-core @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 用法

```vue
<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor } from 'tiptap-vue-pro-core'

const ctx = useProEditor({
  content: '<p>hello core</p>',
})
</script>

<template>
  <button @click="ctx.commands.bold()">Bold</button>
  <EditorContent :editor="ctx.editor.value" />
</template>
```

## Nuxt / SSR

Core 默认以 `immediatelyRender: false` 创建 Tiptap 编辑器,适配 Nuxt / SSR 场景。Nuxt 项目中建议把开箱组件放进 `<ClientOnly>`:

```vue
<template>
  <ClientOnly>
    <ProEditorElementPlus v-model="content" />
  </ClientOnly>
</template>
```

完整文档: https://twoer.github.io/tiptap-vue-pro/
在线 Demo: https://twoer.github.io/tiptap-vue-pro/playground/
