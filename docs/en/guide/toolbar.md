# Toolbar

The `toolbar` prop uses a two-dimensional array to describe built-in button groups. The array order is the render order.

`toolbarLayout` controls presentation density. The default `classic` mode preserves the fully expanded historical layout. Set it to `compact` to keep common formatting actions on the toolbar and move lower-frequency actions into More formatting, Lists and indent, Insert, and More menus. Commands and `toolbar` configuration remain available.

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
  <ProEditorElementPlus v-model="content" :toolbar="toolbar" toolbar-layout="compact">
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

Compact mode keeps the code-language and table-grid pickers as dedicated controls. Image upload/URL, video/file upload, divider variants, and Markdown import/export expand inside their corresponding menus. Desktop wrapping occurs only at action-group boundaries; mobile stays on one horizontally scrollable row.

| Group | Features |
| --- | --- |
| History | Undo, redo |
| Paragraph and font | Body / H1-H6, font family, font size, line height |
| Inline formatting | Bold, italic, underline, strikethrough, inline code, superscript, subscript |
| Color and cleanup | Text color, background highlight, clear format |
| Alignment and indent | Left / center / right / justify, decrease indent, increase indent |
| Lists and blocks | Bullet list, ordered list, task list, blockquote, code block language and syntax highlighting |
| Insert | Link, image (upload / URL, merged by configuration), attachment upload, table, divider styles |
| Document tools | Markdown import/export, print |
| View | Preview, fullscreen |

## Code Blocks

The Code button opens a language menu for inserting a code block or changing the active block's language. When the cursor enters a code block, a contextual toolbar appears above it with language switching and one-click copying. The behavior is consistent across the Element Plus, Naive UI, and Ant Design Vue adapters.

The 17 default options are Plain Text, JavaScript, TypeScript, HTML / Vue, CSS, JSON, Python, Java, C, C++, C#, Go, Rust, Bash, SQL, YAML, and Markdown. The menu and current-language label use language icons; custom entries without a built-in icon fall back to the generic code icon.

Replace the language menu with [`toolbarOptions.codeBlockLanguages`](/en/api/toolbar-options#code-block-languages).

## Divider Styles

The built-in `hr` button renders as a dropdown that can insert solid, thick, dashed, and dotted dividers. Custom toolbars can call the command with a style directly:

```ts
ctx.commands.hr('solid')
ctx.commands.hr('thick')
ctx.commands.hr('dashed')
ctx.commands.hr('dotted')
```

Styles are preserved in HTML/JSON. Markdown export falls back to the standard plain `---`.
