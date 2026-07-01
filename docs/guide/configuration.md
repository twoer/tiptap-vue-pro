# 配置菜单和默认行为

配置分三层:

| 配置 | 负责什么 |
| --- | --- |
| `toolbar` | 控制内置按钮是否显示、如何分组、顺序如何 |
| `toolbarOptions` | 控制菜单数据和动作参数,如字体、字号、行高、色板、代码语言、分割线样式、表格网格、Markdown、打印 |
| `editorBehaviorOptions` | 控制编辑器默认行为,如链接 target、表格表头、图片和媒体附件配置 |

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
    { label: '默认字体', value: '' },
    { label: '苹方', value: 'PingFang SC' },
    { label: '霞鹜文楷', value: '"LXGW WenKai"' },
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
    { label: '实线', value: 'solid' },
    { label: '粗线', value: 'thick' },
    { label: '虚线', value: 'dashed' },
    { label: '点线', value: 'dotted' },
  ],
  tableGrid: { maxRows: 12, maxCols: 12 },
  markdown: {
    importAccept: '.md,.markdown,text/markdown,text/plain',
    exportFilename: () => `doc-${Date.now()}.md`,
  },
  print: {
    title: '文档打印',
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

## 常用场景

| 目标 | 配置 |
| --- | --- |
| 自定义字体、字号、行高 | `toolbarOptions.fontFamilies`、`fontSizes`、`lineHeights` |
| 自定义文字颜色、背景高亮色板 | `toolbarOptions.colors`、`highlights` |
| 自定义代码块语言 | `toolbarOptions.codeBlockLanguages` |
| 自定义分割线样式菜单 | `toolbarOptions.horizontalRules` |
| 自定义表格网格大小 | `toolbarOptions.tableGrid` |
| 自定义 Markdown 导入类型、导出文件名 | `toolbarOptions.markdown.importAccept`、`exportFilename` |
| 自定义打印标题和清理延迟 | `toolbarOptions.print` |
| 链接默认当前窗口或新窗口打开 | `editorBehaviorOptions.link.defaultTarget` |
| 插入表格默认是否带表头 | `editorBehaviorOptions.table.withHeaderRow` |
| 图片上传/替换可选择的文件类型 | `editorBehaviorOptions.image.accept` |
| 图片上传、替换、粘贴和拖拽的单图大小上限 | `editorBehaviorOptions.image.maxSize` |
| 工具栏图片、视频、音频、文件是否允许一次选择多个 | `editorBehaviorOptions.image.multiple`、`editorBehaviorOptions.media.*.multiple` |
| 视频 / 音频使用播放器还是文件卡片 | `editorBehaviorOptions.media.video.render.displayMode`、`media.audio.render.displayMode` |
| 视频 / 音频播放器控制栏、静音、下载、全屏等 | `editorBehaviorOptions.media.video.render`、`media.audio.render` |
| 文件卡片展示图标、名称、大小、文件类型、时间、时长 | `editorBehaviorOptions.media.file.render` |

`editorBehaviorOptions.image.accept` 会同时影响工具栏图片上传和图片气泡菜单里的替换图片;`editorBehaviorOptions.image.maxSize` 会同时影响上传、替换、粘贴和拖拽图片。
