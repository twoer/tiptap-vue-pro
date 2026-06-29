# 完整示例

这一页给出可以直接复制的最小业务接入示例。三套 Adapter 的 props 一致,差异主要是组件名、样式文件和 UI 库依赖。

## Element Plus

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type ToolbarConfig,
  type ToolbarOptions,
  type UploadImage,
} from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello element plus</p>')

const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'color', 'highlight'],
  ['link', 'image', 'table'],
  ['markdown', 'preview', 'fullscreen'],
]

const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: '默认字体', value: '' },
    { label: '苹方', value: 'PingFang SC' },
    { label: 'Inter', value: 'Inter' },
  ],
  fontSizes: ['', '14px', '16px', '20px', '28px'],
  lineHeights: ['', '1.5', '1.75', '2'],
  tableGrid: { maxRows: 12, maxCols: 12 },
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  image: { accept: 'image/png,image/jpeg,image/webp' },
}

const uploadImage: UploadImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :toolbar="toolbar"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
    :upload-image="uploadImage"
  />
</template>
```

## Naive UI

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorNaive,
  type EditorBehaviorOptions,
  type ToolbarOptions,
} from 'tiptap-vue-pro-naive'
import 'tiptap-vue-pro-naive/style.css'

const content = ref('<p>hello naive ui</p>')

const toolbarOptions: ToolbarOptions = {
  colors: ['#111827', '#2563eb', '#16a34a', '#dc2626'],
  highlights: ['#fef3c7', '#dcfce7', '#dbeafe'],
  codeBlockLanguages: [
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  table: { withHeaderRow: false },
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

## Ant Design Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import 'tiptap-vue-pro-ant-design-vue/style.css'
import 'ant-design-vue/dist/reset.css'

const content = ref('<p>hello ant design vue</p>')
</script>

<template>
  <ProEditorAntDesignVue
    v-model="content"
    output="html"
    placeholder="请输入内容..."
  />
</template>
```

## Headless Core

```vue
<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor } from 'tiptap-vue-pro-core'

const ctx = useProEditor({
  content: '<p>hello Core</p>',
})
</script>

<template>
  <div>
    <button :class="{ active: ctx.isActive('bold') }" @click="ctx.commands.bold()">
      Bold
    </button>
    <button @click="ctx.commands.setImage('https://example.com/a.png')">
      Image
    </button>
    <EditorContent :editor="ctx.editor.value" />
  </div>
</template>
```
