# Examples

This page provides minimal business integration examples you can copy directly. The three adapters share the same props; the main differences are component names, style entries, and UI library dependencies.

## Element Plus

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type ToolbarConfig,
  type ToolbarOptions,
  type UploadAsset,
  type UploadImage,
} from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello element plus</p>')

const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'color', 'highlight'],
  ['link', 'image', 'attachment', 'table'],
  ['markdown', 'preview', 'fullscreen'],
]

const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: 'Default', value: '' },
    { label: 'PingFang', value: 'PingFang SC' },
    { label: 'Inter', value: 'Inter' },
  ],
  fontSizes: ['', '14px', '16px', '20px', '28px'],
  lineHeights: ['', '1.5', '1.75', '2'],
  tableGrid: { maxRows: 12, maxCols: 12 },
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
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

const uploadImage: UploadImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
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
  <ProEditorElementPlus
    v-model="content"
    :toolbar="toolbar"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
    :upload-image="uploadImage"
    :upload-asset="uploadAsset"
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
    placeholder="Write something..."
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
