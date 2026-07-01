# Context and Commands

`useProEditor` returns `ProEditorContext`. Adapter toolbars consume it internally, and custom UI can use it directly.

```ts
interface ProEditorContext {
  editor: Ref<Editor | undefined>
  loaded: Ref<boolean>
  isActive: (name: string | Record<string, unknown>, attrs?: Record<string, unknown>) => boolean
  commands: ProEditorCommands
  getHTML: () => string
  getJSON: () => object
  getMarkdown: () => string
  importMarkdown: (md: string) => void
  wordCount: Ref<{ characters: number; words: number }>
  setEditable: (editable: boolean) => void
  notify: NotifyFn
}
```

## Common Commands

| Category | Commands |
| --- | --- |
| History | `undo()`, `redo()` |
| Inline formatting | `bold()`, `italic()`, `strike()`, `underline()`, `code()`, `superscript()`, `subscript()` |
| Block structure | `toggleHeading(level)`, `blockquote()`, `codeBlock(language)`, `hr(variant?)` |
| Lists | `bulletList()`, `orderedList()`, `taskList()` |
| Typography | `setFontFamily(value)`, `setFontSize(value)`, `setLineHeight(value)`, `increaseIndent()`, `decreaseIndent()` |
| Color | `setColor(color)`, `toggleHighlight(color)` |
| Alignment | `align('left' \| 'center' \| 'right' \| 'justify')` |
| Link | `setLink(href, opts)`, `insertLinkText(href, text, opts)` |
| Image | `setImage(src, alt)`, `uploadAndInsertImage(file)`, `setImageAlign(align)`, `setImageSize(preset)`, `setImageCaption(caption)`, `removeImage()` |
| Video / audio / file | `insertVideo(asset)`, `uploadAndInsertVideo(file)`, `insertAudio(asset)`, `uploadAndInsertAudio(file)`, `insertFile(asset)`, `uploadAndInsertFile(file)` |
| Table | `insertTable(rows, cols)`, `addRowBefore()`, `addRowAfter()`, `deleteRow()`, `addColumnBefore()`, `addColumnAfter()`, `deleteColumn()`, `mergeCells()`, `splitCell()`, `deleteTable()` |
| Cleanup | `clearNodes()`, `clearTypography()`, `clearFormat()` |

## Custom Toolbar Example

```vue
<template>
  <button :class="{ active: ctx.isActive('bold') }" @click="ctx.commands.bold()">
    Bold
  </button>
  <button @click="ctx.commands.align('center')">
    Center
  </button>
</template>
```

`insertVideo` and `insertAudio` read `editorBehaviorOptions.media.video.render.displayMode` / `media.audio.render.displayMode`. When configured as `player`, they insert a native player. When configured as `file`, they insert a file card.

`hr(variant?)` accepts `solid`, `thick`, `dashed`, or `dotted`. Omitting the variant inserts a plain solid divider.
