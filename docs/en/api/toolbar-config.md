# ToolbarConfig

`ToolbarConfig` controls built-in toolbar button groups and order.

```ts
type ToolbarBuiltinKey =
  | 'undo'
  | 'redo'
  | 'heading'
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'underline'
  | 'code'
  | 'superscript'
  | 'subscript'
  | 'color'
  | 'highlight'
  | 'align'
  | 'decreaseIndent'
  | 'increaseIndent'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'hr'
  | 'link'
  | 'image'
  | 'attachment'
  | 'table'
  | 'clearFormat'
  | 'markdown'
  | 'print'
  | 'fullscreen'
  | 'preview'

type ToolbarGroupConfig = ToolbarBuiltinKey[]
type ToolbarConfig = ToolbarGroupConfig[]
type ToolbarProp = ToolbarConfig | false
```

## Default Groups

```ts
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'strike', 'code', 'superscript', 'subscript'],
  ['color', 'highlight', 'clearFormat'],
  ['align', 'decreaseIndent', 'increaseIndent'],
  ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'],
  ['link', 'image', 'attachment', 'table', 'hr'],
  ['markdown', 'print'],
  ['preview', 'fullscreen'],
]
```

## Hide the Toolbar

```vue
<ProEditorElementPlus v-model="content" :toolbar="false" />
```

## Custom Groups

```ts
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image', 'attachment', 'table'],
]
```

Menu data behind buttons is not configured in `toolbar`. Use [`ToolbarOptions`](/en/api/toolbar-options) for font lists, font sizes, palettes, code languages, divider styles, and similar data.
