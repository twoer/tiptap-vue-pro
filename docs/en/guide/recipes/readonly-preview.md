# Readonly Preview and Detail Pages

Use this recipe for content detail pages, approval previews, pre-publish reviews, and readonly knowledge bases. Reuse the same HTML or JSON content: edit pages pass `readonly=false`, while detail pages pass `readonly=true`.

[Try this scenario online](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=readonly-preview)

## Minimal integration

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const readonly = ref(true)
const content = ref(`
  <h2>Release notes</h2>
  <p>This is readonly preview content. Users can inspect layout, images, tables, and links without editing the body.</p>
  <blockquote>Detail pages and edit pages reuse the same content to reduce rendering drift.</blockquote>
`)
</script>

<template>
  <section>
    <button type="button" @click="readonly = !readonly">
      {{ readonly ? 'Switch to edit mode' : 'Switch to readonly mode' }}
    </button>

    <ProEditorElementPlus
      v-model="content"
      :readonly="readonly"
      :show-word-count="!readonly"
      toolbar-layout="compact"
    />
  </section>
</template>
```

## When to use readonly mode

- A detail page should render as closely as possible to the edit page.
- An approval flow needs to preview content before publication.
- A readonly knowledge base still wants editor-native links, images, tables, and Mermaid rendering.

## Common pitfalls

- If content comes from untrusted users, sanitize HTML according to your business security requirements before storing or rendering it.
- Readonly mode is presentation behavior, not permission control; the backend must still enforce edit permissions.
- For ultra-light detail pages, server-rendered static HTML may be better than mounting the full editor.
