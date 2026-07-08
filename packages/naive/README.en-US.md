# Tiptap Vue Pro Naive

中文: [README.md](./README.md)

Ready-to-use rich text editor component built with Tiptap v3, Vue 3, and Naive UI.

## Features

- Ready-made toolbar: headings, formatting, font family, font size, line height, indent, colors, highlights, and alignment
- Links, image upload/image URL, video/audio/file upload, table grid, row/column grips, range selection, and Markdown import/export
- Fullscreen, preview, dark mode, and word count

Font family, font size, line height, and indent are HTML styling features. They may be lost when exporting to Markdown, but are preserved in HTML / JSON output.

## Install

```bash
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## Usage

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

## Configuration

`locale` controls built-in text (`zh-CN` / `en-US` with partial overrides). `toolbar` controls which built-in buttons are shown and in what order. `toolbarOptions` configures menu data such as fonts, sizes, line heights, colors, code languages, divider styles, table grid, Markdown, and print. `editorBehaviorOptions` configures default behavior such as link target, table headers, image and media attachment accept rules, size limits, multiple selection, and render mode.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorNaive,
  type EditorBehaviorOptions,
  type ToolbarOptions,
  type UploadAsset,
} from 'tiptap-vue-pro-naive'

const content = ref('<p>hello world</p>')

const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: 'Default', value: '' },
    { label: 'PingFang', value: 'PingFang SC' },
  ],
  fontSizes: ['', '14px', '16px', '20px', '28px'],
  lineHeights: ['', '1.5', '1.75', '2'],
  codeBlockLanguages: [
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
  horizontalRules: [
    { label: 'Solid', value: 'solid' },
    { label: 'Dashed', value: 'dashed' },
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
  <ProEditorNaive
    v-model="content"
    locale="en-US"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
    :upload-asset="uploadAsset"
  />
</template>
```

Full configuration docs: https://twoer.github.io/tiptap-vue-pro/en/guide/configuration

## Custom Toolbar

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
      <NButton text @click="ctx.commands.hr('dashed')">Dashed</NButton>
    </template>
  </ProEditorNaive>
</template>
```

Pass `:toolbar="false"` to hide built-in buttons. Use the `toolbar` slot to fully replace the built-in toolbar.

Full docs: https://twoer.github.io/tiptap-vue-pro/en/
Online demo: https://twoer.github.io/tiptap-vue-pro/playground/
