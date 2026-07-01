# Configuration

Configuration is split into three layers:

| Config | Responsibility |
| --- | --- |
| `toolbar` | Controls which built-in buttons are shown, how they are grouped, and their order |
| `toolbarOptions` | Controls menu data and action parameters such as fonts, sizes, line heights, palettes, code languages, divider styles, table grid, Markdown, and print |
| `editorBehaviorOptions` | Controls default editor behavior such as link target, table headers, and image/media attachment settings |

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type ToolbarOptions,
} from 'tiptap-vue-pro-element-plus'

const content = ref('<p>hello world</p>')

const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: 'Default', value: '' },
    { label: 'PingFang', value: 'PingFang SC' },
    { label: 'LXGW WenKai', value: '"LXGW WenKai"' },
  ],
  fontSizes: ['', '12px', '14px', '16px', '18px', '24px', '32px'],
  lineHeights: ['', '1', '1.5', '1.75', '2'],
  colors: ['#111827', '#2563eb', '#16a34a', '#dc2626'],
  highlights: ['#fef3c7', '#dcfce7', '#dbeafe'],
  codeBlockLanguages: [
    { label: 'Plain Text', value: 'plaintext' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
    { label: 'Mermaid', value: 'mermaid' },
  ],
  horizontalRules: [
    { label: 'Solid', value: 'solid' },
    { label: 'Thick', value: 'thick' },
    { label: 'Dashed', value: 'dashed' },
    { label: 'Dotted', value: 'dotted' },
  ],
  tableGrid: { maxRows: 12, maxCols: 12 },
  markdown: {
    importAccept: '.md,.markdown,text/markdown,text/plain',
    exportFilename: () => `doc-${Date.now()}.md`,
  },
  print: {
    title: 'Print document',
    cleanupDelay: 500,
  },
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  table: { withHeaderRow: false },
  image: { accept: 'image/png,image/jpeg,image/webp', maxSize: 10 * 1024 * 1024, multiple: true, allowUrl: true },
  media: {
    video: { multiple: true, render: { displayMode: 'player', controls: true, allowDownload: false } },
    audio: { render: { displayMode: 'player', controls: true } },
    file: { multiple: true, render: { showSize: true, showMimeType: true, showUploadedAt: true } },
  },
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
  />
</template>
```

## Common Use Cases

| Goal | Config |
| --- | --- |
| Customize fonts, font sizes, and line heights | `toolbarOptions.fontFamilies`, `fontSizes`, `lineHeights` |
| Customize text colors and highlight palettes | `toolbarOptions.colors`, `highlights` |
| Customize code block languages | `toolbarOptions.codeBlockLanguages` |
| Customize divider style menu | `toolbarOptions.horizontalRules` |
| Customize table grid size | `toolbarOptions.tableGrid` |
| Customize Markdown import types and export filename | `toolbarOptions.markdown.importAccept`, `exportFilename` |
| Customize print title and cleanup delay | `toolbarOptions.print` |
| Open links in the current window or a new window by default | `editorBehaviorOptions.link.defaultTarget` |
| Insert tables with or without a header row by default | `editorBehaviorOptions.table.withHeaderRow` |
| Restrict selectable image types for upload/replacement | `editorBehaviorOptions.image.accept` |
| Limit image size for upload, replacement, paste, and drop | `editorBehaviorOptions.image.maxSize` |
| Allow toolbar image, video, audio, and file inputs to select multiple files | `editorBehaviorOptions.image.multiple`, `editorBehaviorOptions.media.*.multiple` |
| Render video/audio as native players or file cards | `editorBehaviorOptions.media.video.render.displayMode`, `media.audio.render.displayMode` |
| Configure player controls, mute, download, fullscreen, and related behavior | `editorBehaviorOptions.media.video.render`, `media.audio.render` |
| Configure file card icon, name, size, type, time, and duration display | `editorBehaviorOptions.media.file.render` |

`editorBehaviorOptions.image.accept` affects both toolbar image upload and image replacement in the image bubble menu. `editorBehaviorOptions.image.maxSize` affects upload, replacement, pasted images, and dropped images.
