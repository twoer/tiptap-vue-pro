# Markdown

编辑器内置 Markdown 导入 / 导出入口:

| 入口 | 说明 |
| --- | --- |
| 工具栏 Markdown 菜单 | 用户选择 `.md` 文件导入,或导出当前内容 |
| `ctx.getMarkdown()` | 从 Core 上下文读取 Markdown |
| `ctx.importMarkdown(markdown)` | 把 Markdown 写入编辑器 |

```vue
<script setup lang="ts">
import type { ToolbarOptions } from 'tiptap-vue-pro-element-plus'

const toolbarOptions: ToolbarOptions = {
  markdown: {
    importAccept: '.md,.markdown,text/markdown,text/plain',
    exportFilename: () => `doc-${Date.now()}.md`,
  },
}
</script>

<template>
  <ProEditorElementPlus v-model="content" :toolbar-options="toolbarOptions" />
</template>
```

::: warning
Markdown 导出基于 Markdown 语义,字体、字号、行高、缩进等 HTML 样式能力可能无法完整保留。需要保真时建议使用 HTML 或 JSON 输出。
:::
