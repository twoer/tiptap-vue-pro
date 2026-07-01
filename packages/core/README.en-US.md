# Tiptap Vue Pro Core

中文: [README.md](./README.md)

UI-independent Tiptap v3 + Vue 3 rich text editor core.

This package provides `useProEditor()`, default extensions, command aggregation, image/media attachment upload helpers, and public type contracts. It does not include ready-made UI. For out-of-the-box components, install one of the adapters:

- Element Plus: `tiptap-vue-pro-element-plus`
- Naive UI: `tiptap-vue-pro-naive`
- Ant Design Vue: `tiptap-vue-pro-ant-design-vue`

## Features

- Headings, bold/italic/strikethrough/underline, inline code, superscript, and subscript
- Font family, font size, line height, text color, background highlight, and text alignment
- Paragraph/heading indent and list-level indent
- Links, images, video, audio, file attachments, tables, task lists, code blocks, and Markdown import/export

Font family, font size, line height, and indent are HTML styling features. They may be lost when exporting to Markdown, but are preserved in HTML / JSON output.

## Install

```bash
pnpm add tiptap-vue-pro-core @tiptap/core @tiptap/pm @tiptap/vue-3
```

## Usage

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

Core creates the Tiptap editor with `immediatelyRender: false` by default, which fits Nuxt / SSR. In Nuxt apps, wrap ready-made adapter components with `<ClientOnly>`:

```vue
<template>
  <ClientOnly>
    <ProEditorElementPlus v-model="content" />
  </ClientOnly>
</template>
```

Full docs: https://twoer.github.io/tiptap-vue-pro/en/
Online demo: https://twoer.github.io/tiptap-vue-pro/playground/
