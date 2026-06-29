# Tiptap Vue Pro Naive

基于 Tiptap v3 + Vue 3 + Naive UI 的开箱即用富文本编辑器组件。

## 能力

- 开箱即用工具栏:标题、格式化、字体、字号、行高、缩进、颜色、高亮、对齐
- 链接、图片上传/网络图片、表格网格、Markdown 导入导出
- 全屏、预览、暗色模式、字数统计

> 字体、字号、行高、缩进属于 HTML 样式能力;导出 Markdown 时可能丢失,导出 HTML / JSON 可保留。

## 安装

```bash
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import 'tiptap-vue-pro-naive/style.css'

const content = ref('<p>hello world</p>')
</script>

<template>
  <ProEditorNaive v-model="content" />
</template>
```

## 配置

`toolbar` 控制内置按钮的显示和顺序;`toolbarOptions` 控制菜单数据,如字体、字号、行高、颜色、代码语言、表格网格、Markdown 和打印;`editorBehaviorOptions` 控制默认行为,如链接打开方式、表格是否带表头、图片 accept。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorNaive,
  type EditorBehaviorOptions,
  type ToolbarOptions,
} from 'tiptap-vue-pro-naive'

const content = ref('<p>hello world</p>')

const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: '默认字体', value: '' },
    { label: '苹方', value: 'PingFang SC' },
  ],
  fontSizes: ['', '14px', '16px', '20px', '28px'],
  lineHeights: ['', '1.5', '1.75', '2'],
  codeBlockLanguages: [
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
  tableGrid: { maxRows: 12, maxCols: 12 },
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  table: { withHeaderRow: false },
  image: { accept: 'image/png,image/jpeg,image/webp' },
}
</script>

<template>
  <ProEditorNaive
    v-model="content"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
  />
</template>
```

完整配置项见文档站: https://twoer.github.io/tiptap-vue-pro/guide/configuration

## 自定义工具栏

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NButton } from 'naive-ui'
import { ProEditorNaive, type ToolbarConfig } from 'tiptap-vue-pro-naive'

const content = ref('<p>hello world</p>')
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image'],
]
</script>

<template>
  <ProEditorNaive v-model="content" :toolbar="toolbar">
    <template #toolbar-after="{ ctx }">
      <NButton text @click="ctx.commands.hr()">分割线</NButton>
    </template>
  </ProEditorNaive>
</template>
```

传 `:toolbar="false"` 可隐藏内置按钮;使用 `toolbar` 插槽可完全替换内置工具栏。

完整文档: https://twoer.github.io/tiptap-vue-pro/
在线 Demo: https://twoer.github.io/tiptap-vue-pro/playground/
