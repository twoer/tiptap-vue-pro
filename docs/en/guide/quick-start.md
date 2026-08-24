# Quick Start

Tiptap Vue Pro is a rich text editor component package built on Tiptap v3 + Vue 3. In most business apps, install the adapter that matches your UI library. Use Core directly only when you want to build your own UI.

## Run It In 3 Minutes

If your project uses Element Plus, install the adapter, Element Plus, and the Tiptap v3 runtime dependencies:

```bash
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Then import the component and styles in your page:

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

Naive UI and Ant Design Vue use the same API. Replace the adapter, component name, and style entries.

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

::: tip About Tiptap versions
Tiptap v3 official packages pin each other to the exact same version (`@tiptap/vue-3` requires `@tiptap/core` to be the identical version). It is recommended to **not** pin `@tiptap/*` versions manually — installing the latest family as shown above keeps every package consistent automatically.

If your project must pin an older version (e.g. `3.27.1`), make sure **all** `@tiptap/*` packages are locked to the same version and pin the family via `overrides` (npm) in your `package.json`; otherwise npm may fail with `ERESOLVE` or install duplicate copies that break at runtime:

```json
{
  "overrides": {
    "@tiptap/core": "3.27.1",
    "@tiptap/pm": "3.27.1",
    "@tiptap/vue-3": "3.27.1"
  }
}
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

## Style Entries

Adapter component styles must be imported explicitly:

```ts
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'
```

```ts
import 'tiptap-vue-pro-naive/style.css'
```

```ts
import 'tiptap-vue-pro-ant-design-vue/style.css'
import 'ant-design-vue/dist/reset.css'
```

If your app already imports the UI library styles globally, keep the Tiptap Vue Pro adapter `style.css` import in the page or app entry.

## Slash Command

Ready-made adapter components enable Slash Command by default. Put the cursor in an editable paragraph and type `/` to open the quick insert menu. You can keep typing Chinese, English, or pinyin aliases such as `/表`, `/table`, `/todo`, `/img`, and `/code`.

The default menu includes heading, task, bullet list, ordered list, table, image, divider, code block, and Mermaid diagram. `Enter` runs the active item, and `Escape` closes the menu while keeping the typed `/query` text. Slash Command is an editor interaction feature and does not change Markdown import/export semantics.

## Find And Replace

Ready-made adapter components support editor-native find and replace by default. Click the find icon in the toolbar, or press `Ctrl/⌘ + F` when the cursor is inside the editor, to open the panel. Typing a query highlights all matches and shows the current match index plus total count. The panel supports previous/next navigation, case-sensitive search, replace current, and replace all.

Readonly and preview states still allow finding and navigating matches, but replace actions are hidden. Find/replace only searches ProseMirror document text; it does not search toolbar, dialog, or other UI text, and it does not change Markdown import/export semantics.

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

## If It Does Not Work

- Missing styles: make sure the adapter `style.css` and UI library styles are imported.
- Dependency conflicts: keep all `@tiptap/*` packages on the same version.
- Nuxt / SSR: wrap ready-made editor components in `<ClientOnly>`. See [Nuxt / SSR](/en/guide/ssr).
- Upload does nothing: make sure `uploadImage` or `uploadAsset` is provided and returns an accessible URL.
- Toolbar buttons are missing: check whether you passed a custom `toolbar`, since it controls which buttons are rendered.

## Local Development

```bash
pnpm install
pnpm dev
pnpm docs:dev
pnpm test
pnpm typecheck
pnpm build
pnpm test:slash:e2e
pnpm test:find-replace:e2e
```
