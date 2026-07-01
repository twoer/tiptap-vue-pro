# Toolbar

The `toolbar` prop uses a two-dimensional array to describe built-in button groups. The array order is the render order.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus'
import { ProEditorElementPlus, type ToolbarConfig } from 'tiptap-vue-pro-element-plus'

const content = ref('<p>hello world</p>')
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image'],
]
</script>

<template>
  <ProEditorElementPlus v-model="content" :toolbar="toolbar">
    <template #toolbar-after="{ ctx }">
      <ElButton text @click="ctx.commands.hr('dashed')">Dashed</ElButton>
    </template>
  </ProEditorElementPlus>
</template>
```

Pass `:toolbar="false"` to hide all built-in buttons. Use the `toolbar` slot when you need a fully custom toolbar:

```vue
<ProEditorElementPlus v-model="content">
  <template #toolbar="{ ctx }">
    <div class="my-toolbar">
      <button @click="ctx.commands.bold()">Bold</button>
      <button @click="ctx.commands.setImage('https://example.com/a.png')">Image</button>
    </div>
  </template>
</ProEditorElementPlus>
```

## Slots

| Slot | Description |
| --- | --- |
| `toolbar` | Fully replaces the built-in toolbar |
| `toolbar-before` | Inserts content before built-in toolbar buttons |
| `toolbar-after` | Inserts content after built-in toolbar buttons |

## Built-In Buttons

| Group | Features |
| --- | --- |
| History | Undo, redo |
| Paragraph and font | Body / H1-H6, font family, font size, line height |
| Inline formatting | Bold, italic, underline, strikethrough, inline code, superscript, subscript |
| Color and cleanup | Text color, background highlight, clear format |
| Alignment and indent | Left / center / right / justify, decrease indent, increase indent |
| Lists and blocks | Bullet list, ordered list, task list, blockquote, code block language |
| Insert | Link, image (upload / URL, merged by configuration), attachment upload, table, divider styles |
| Document tools | Markdown import/export, print |
| View | Preview, fullscreen |

## Divider Styles

The built-in `hr` button renders as a dropdown that can insert solid, thick, dashed, and dotted dividers. Custom toolbars can call the command with a style directly:

```ts
ctx.commands.hr('solid')
ctx.commands.hr('thick')
ctx.commands.hr('dashed')
ctx.commands.hr('dotted')
```

Styles are preserved in HTML/JSON. Markdown export falls back to the standard plain `---`.
