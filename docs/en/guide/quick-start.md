# Quick Start

Tiptap Vue Pro is a rich text editor component package built on Tiptap v3 + Vue 3. In most business apps, install the adapter that matches your UI library. Use Core directly only when you want to build your own UI.

## Install

::: code-group

```bash [Element Plus]
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

```bash [Naive UI]
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

```bash [Ant Design Vue]
pnpm add tiptap-vue-pro-ant-design-vue ant-design-vue
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

:::

## Minimal Example

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

Naive UI and Ant Design Vue use the same props. Replace the component name, style entry, and package names. See [Examples](/en/guide/examples) for complete usage.

## Image Upload

Pass `uploadImage` and toolbar upload, pasted images, and dropped images will all use the same upload function. Once the function returns an image URL, Core inserts it into the editor.

```vue
<script setup lang="ts">
async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
}
</script>

<template>
  <ProEditorElementPlus v-model="content" :upload-image="uploadImage" />
</template>
```

## Local Development

```bash
pnpm install
pnpm dev
pnpm docs:dev
pnpm test
pnpm typecheck
pnpm build
```
