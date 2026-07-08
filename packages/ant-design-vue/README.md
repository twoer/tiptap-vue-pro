# Tiptap Vue Pro Ant Design Vue

English: [README.en-US.md](./README.en-US.md)

基于 Tiptap v3 + Vue 3 + Ant Design Vue 的开箱即用富文本编辑器组件。

## 能力

- 开箱即用工具栏:标题、格式化、字体、字号、行高、缩进、颜色、高亮、对齐
- 链接、图片上传/网络图片、视频/音频/文件上传、表格网格、行列抓手、区域选择、Markdown 导入导出
- 全屏、预览、暗色模式、字数统计

> 字体、字号、行高、缩进属于 HTML 样式能力;导出 Markdown 时可能丢失,导出 HTML / JSON 可保留。

## 安装

```bash
pnpm add tiptap-vue-pro-ant-design-vue ant-design-vue
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import 'tiptap-vue-pro-ant-design-vue/style.css'
import 'ant-design-vue/dist/index.css'

const content = ref('<p>hello world</p>')
</script>

<template>
  <ProEditorAntDesignVue v-model="content" />
</template>
```

## 配置

`locale` 控制内置文案语言(支持 `zh-CN` / `en-US` 和局部覆盖);`toolbar` 控制内置按钮的显示和顺序;`toolbarOptions` 控制菜单数据,如字体、字号、行高、颜色、代码语言、分割线样式、表格网格、Markdown 和打印;`editorBehaviorOptions` 控制默认行为,如链接打开方式、表格是否带表头、图片和媒体附件的 accept、大小上限、多选和渲染方式。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorAntDesignVue,
  type EditorBehaviorOptions,
  type ToolbarOptions,
  type UploadAsset,
} from 'tiptap-vue-pro-ant-design-vue'

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
  horizontalRules: [
    { label: '实线', value: 'solid' },
    { label: '虚线', value: 'dashed' },
  ],
  tableGrid: { maxRows: 12, maxCols: 12 },
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  table: { withHeaderRow: false },
  image: { accept: 'image/png,image/jpeg,image/webp', maxSize: 10 * 1024 * 1024, multiple: true, allowUrl: true },
  media: {
    video: { accept: 'video/mp4,video/webm', maxSize: 100 * 1024 * 1024, multiple: true },
    audio: { accept: 'audio/mpeg,audio/wav', maxSize: 30 * 1024 * 1024, multiple: true },
    file: {
      accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip',
      maxSize: 50 * 1024 * 1024,
      multiple: true,
      render: { showSize: true, showMimeType: true, showUploadedAt: true },
    },
  },
}

const uploadAsset: UploadAsset = async (file, kind) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  const res = await fetch('/api/upload-asset', { method: 'POST', body: formData })
  return await res.json()
}
</script>

<template>
  <ProEditorAntDesignVue
    v-model="content"
    locale="en-US"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
    :upload-asset="uploadAsset"
  />
</template>
```

完整配置项见文档站: https://twoer.github.io/tiptap-vue-pro/guide/configuration

## 自定义工具栏

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'ant-design-vue'
import { ProEditorAntDesignVue, type ToolbarConfig } from 'tiptap-vue-pro-ant-design-vue'

const content = ref('<p>hello world</p>')
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image'],
]
</script>

<template>
  <ProEditorAntDesignVue v-model="content" :toolbar="toolbar">
    <template #toolbar-after="{ ctx }">
      <Button type="text" @click="ctx.commands.hr('dashed')">虚线</Button>
    </template>
  </ProEditorAntDesignVue>
</template>
```

传 `:toolbar="false"` 可隐藏内置按钮;使用 `toolbar` 插槽可完全替换内置工具栏。

完整文档: https://twoer.github.io/tiptap-vue-pro/
在线 Demo: https://twoer.github.io/tiptap-vue-pro/playground/
