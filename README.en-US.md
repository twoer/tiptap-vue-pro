# Tiptap Vue Pro

中文: [README.md](./README.md)

> A modern Vue 3 rich text editor component package built on Tiptap v3.

This project is not affiliated with [Tiptap](https://tiptap.dev). The editor engine is powered by Tiptap v3 and ProseMirror.

## Links

- Docs: <https://twoer.github.io/tiptap-vue-pro/en/>
- Online demo: <https://twoer.github.io/tiptap-vue-pro/playground/>
- Quick start: <https://twoer.github.io/tiptap-vue-pro/en/guide/quick-start>
- API docs: <https://twoer.github.io/tiptap-vue-pro/en/api/props>

## Why This Exists

Using Tiptap in a Vue 3 app is straightforward, but making it production-ready usually means writing the same glue code again and again: toolbar state, link dialogs, image upload/paste/drop, video/audio/file upload, table controls, bubble menus, colors, Markdown import/export, and UI feedback.

Tiptap Vue Pro packages those pieces as a UI-independent core plus three equivalent UI adapters:

| Package | Component | UI library |
| --- | --- | --- |
| `tiptap-vue-pro-element-plus` | `ProEditorElementPlus` | Element Plus |
| `tiptap-vue-pro-naive` | `ProEditorNaive` | Naive UI |
| `tiptap-vue-pro-ant-design-vue` | `ProEditorAntDesignVue` | Ant Design Vue |
| `tiptap-vue-pro-core` | `useProEditor` | Headless / custom UI |

## Features

- Tiptap v3 + Vue 3 + TypeScript
- HTML / JSON output with `v-model`
- Full toolbar: headings, formatting, font family, font size, line height, colors, highlights, alignment, lists, links, images, tables, divider styles, Markdown, print, preview, and fullscreen
- Image upload, paste, drag/drop, replacement, alignment, sizing, and captions
- Video, audio, and file upload with player/file-card display modes, multiple selection, type limits, size limits, and contextual editing after insertion
- Table insertion, row/column grips, Shift range selection, Ctrl/⌘ + A table selection, cell merge/split, and header toggles
- Markdown import/export
- Developer diagnostics logs with lifecycle, command, upload, table, and other channels
- Component-level dark mode, readonly mode, and word count
- Nuxt / SSR friendly
- Equivalent behavior across Element Plus, Naive UI, and Ant Design Vue adapters

## Install

Element Plus:

```bash
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Naive UI:

```bash
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Ant Design Vue:

```bash
pnpm add tiptap-vue-pro-ant-design-vue ant-design-vue
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Headless Core:

```bash
pnpm add tiptap-vue-pro-core @tiptap/core @tiptap/pm @tiptap/vue-3
```

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

Naive UI and Ant Design Vue use the same props. Replace the component name and style entry. See the [examples guide](https://twoer.github.io/tiptap-vue-pro/en/guide/examples) for complete examples.

## Common Docs

| Goal | Docs |
| --- | --- |
| Choose an adapter | [Adapters](https://twoer.github.io/tiptap-vue-pro/en/guide/adapters) |
| Customize toolbar groups | [Toolbar](https://twoer.github.io/tiptap-vue-pro/en/guide/toolbar) |
| Configure fonts, sizes, line heights, palettes, code languages, and divider styles | [Configuration](https://twoer.github.io/tiptap-vue-pro/en/guide/configuration) |
| Configure link target, table headers, images, and media attachments | [EditorBehaviorOptions](https://twoer.github.io/tiptap-vue-pro/en/api/editor-behavior-options) |
| Integrate image upload | [Image Upload](https://twoer.github.io/tiptap-vue-pro/en/guide/image-upload) |
| Integrate video, audio, and file upload | [Video, Audio, and File Upload](https://twoer.github.io/tiptap-vue-pro/en/guide/media-upload) |
| Use Nuxt / SSR | [Nuxt / SSR](https://twoer.github.io/tiptap-vue-pro/en/guide/ssr) |
| Debug integration and editor behavior issues | [Developer Diagnostics](https://twoer.github.io/tiptap-vue-pro/en/advanced/developer-diagnostics) |
| Understand the architecture | [Architecture](https://twoer.github.io/tiptap-vue-pro/en/advanced/architecture) |

## Local Development

```bash
pnpm install
pnpm dev            # playground: http://localhost:5173
pnpm docs:dev       # docs: http://localhost:5173/tiptap-vue-pro/
pnpm typecheck
pnpm test
pnpm build
pnpm test:table:e2e # browser regression for table interactions across all adapters
```

Deployment is handled by `.github/workflows/deploy.yml`: pushes to `main` build the VitePress docs site and copy the playground into the `/playground/` subpath.

## License

[MIT](./LICENSE)

## Credits

- [Tiptap](https://tiptap.dev)
- [ProseMirror](https://prosemirror.net)
- [Element Plus](https://element-plus.org)
- [Naive UI](https://www.naiveui.com/)
- [Ant Design Vue](https://antdv.com/)
