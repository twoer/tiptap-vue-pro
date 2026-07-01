# Context 与 Commands

`useProEditor` 返回 `ProEditorContext`。Adapter 内部工具栏消费它,自定义 UI 也可以直接使用。

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

## 常用命令

| 分类 | 命令 |
| --- | --- |
| 历史 | `undo()`、`redo()` |
| 行内格式 | `bold()`、`italic()`、`strike()`、`underline()`、`code()`、`superscript()`、`subscript()` |
| 块级结构 | `toggleHeading(level)`、`blockquote()`、`codeBlock(language)`、`hr(variant?)` |
| 列表 | `bulletList()`、`orderedList()`、`taskList()` |
| 排版 | `setFontFamily(value)`、`setFontSize(value)`、`setLineHeight(value)`、`increaseIndent()`、`decreaseIndent()` |
| 颜色 | `setColor(color)`、`toggleHighlight(color)` |
| 对齐 | `align('left' \| 'center' \| 'right' \| 'justify')` |
| 链接 | `setLink(href, opts)`、`insertLinkText(href, text, opts)` |
| 图片 | `setImage(src, alt)`、`uploadAndInsertImage(file)`、`setImageAlign(align)`、`setImageSize(preset)`、`setImageCaption(caption)`、`removeImage()` |
| 视频 / 音频 / 文件 | `insertVideo(asset)`、`uploadAndInsertVideo(file)`、`insertAudio(asset)`、`uploadAndInsertAudio(file)`、`insertFile(asset)`、`uploadAndInsertFile(file)` |
| 表格 | `insertTable(rows, cols)`、`addRowBefore()`、`addRowAfter()`、`deleteRow()`、`addColumnBefore()`、`addColumnAfter()`、`deleteColumn()`、`mergeCells()`、`splitCell()`、`deleteTable()` |
| 清理 | `clearNodes()`、`clearTypography()`、`clearFormat()` |

## 自绘工具栏示例

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

`insertVideo` 和 `insertAudio` 会读取 `editorBehaviorOptions.media.video.render.displayMode` / `media.audio.render.displayMode`:配置为 `player` 时插入原生播放器,配置为 `file` 时插入文件卡片。

`hr(variant?)` 支持 `solid`、`thick`、`dashed`、`dotted`;不传时插入普通实线分割线。
