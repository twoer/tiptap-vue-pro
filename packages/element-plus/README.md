# tiptap-vue-pro-element-plus

基于 Tiptap v3 + Vue 3 + Element Plus 的开箱即用富文本编辑器组件。

## 能力

- 开箱即用工具栏:标题、格式化、字体、字号、行高、缩进、颜色、高亮、对齐
- 链接、图片上传/网络图片、表格网格、Markdown 导入导出
- 全屏、预览、暗色模式、字数统计

> 字体、字号、行高、缩进属于 HTML 样式能力;导出 Markdown 时可能丢失,导出 HTML / JSON 可保留。

## 安装

```bash
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 用法

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

## 自定义工具栏

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus'
import { ProEditorElementPlus, type ToolbarConfig } from 'tiptap-vue-pro-element-plus'

const content = ref('<p>hello world</p>')
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image'],
]
</script>

<template>
  <ProEditorElementPlus v-model="content" :toolbar="toolbar">
    <template #toolbar-after="{ ctx }">
      <ElButton text @click="ctx.commands.hr()">分割线</ElButton>
    </template>
  </ProEditorElementPlus>
</template>
```

传 `:toolbar="false"` 可隐藏内置按钮;使用 `toolbar` 插槽可完全替换内置工具栏。

完整文档和 Demo: https://github.com/twoer/tiptap-vue-pro
