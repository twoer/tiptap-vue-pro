# tiptap-vue-pro-core

UI 无关的 Tiptap v3 + Vue 3 富文本编辑器核心层。

这个包只提供 `useProEditor()`、默认扩展、命令聚合、图片上传辅助和类型契约,不包含现成 UI。想开箱即用请安装对应 adapter:

- Element Plus: `tiptap-vue-pro-element-plus`
- Naive UI: `tiptap-vue-pro-naive`

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

完整文档和 Demo: https://github.com/twoer/tiptap-vue-pro
