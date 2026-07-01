# ToolbarConfig

`ToolbarConfig` 控制内置工具栏按钮的分组和顺序。

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

## 默认分组

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

## 隐藏工具栏

```vue
<ProEditorElementPlus v-model="content" :toolbar="false" />
```

## 自定义分组

```ts
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image', 'attachment', 'table'],
]
```

按钮背后的菜单数据不在 `toolbar` 里配置。字体、字号、色板、代码语言、分割线样式等数据请使用 [`ToolbarOptions`](/api/toolbar-options)。
