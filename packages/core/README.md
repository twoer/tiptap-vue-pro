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
- 链接、图片、视频、音频、文件附件、表格列宽拖动、表格选择与行列操作、任务列表、代码块、Markdown 导入导出
- Slash Command 协议、意图搜索、Suggestion 生命周期和命令执行辅助(Adapter 负责渲染菜单)
- 查找替换状态、匹配高亮、上/下一个导航、大小写敏感和替换命令(Adapter 负责渲染面板)

> 字体、字号、行高、缩进、表格列宽、Slash Command 和查找替换属于编辑器体验能力;导出 Markdown 时不会保留这些 UI 行为。

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
