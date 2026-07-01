# Extension Registry

The extension registry controls the default Tiptap extension set. You usually do not need it when using an adapter. Use Core's `createEditorExtensions` when you need to remove features, replace default extensions, or build a headless editor.

```ts
import { createEditorExtensions } from 'tiptap-vue-pro-core'

const extensions = createEditorExtensions({
  placeholderText: 'Write something...',
  markdown: true,
  table: true,
  image: true,
})
```

Then pass it to an adapter:

```vue
<ProEditorElementPlus v-model="content" :extensions="extensions" />
```

## Options

```ts
interface EditorExtensionConfig {
  placeholder?: boolean
  placeholderText?: string
  starterKit?: boolean
  characterCount?: boolean
  image?: boolean
  table?: boolean
  typography?: boolean
  highlight?: boolean
  textAlign?: boolean
  blockIndent?: boolean
  codeBlock?: boolean
  script?: boolean
  taskList?: boolean
  markdown?: boolean
}
```

::: tip
Passing `extensions` replaces the default extension array. If you only want to customize fonts, sizes, palettes, code languages, divider styles, table grid, or similar menu data, prefer `toolbarOptions`.
:::

## When to Use It

| Goal | Recommendation |
| --- | --- |
| Only change toolbar buttons | Use `toolbar` |
| Only change fonts, sizes, palettes, code languages, or divider styles | Use `toolbarOptions` |
| Only change link target, table headers, image/media accept, or size limits | Use `editorBehaviorOptions` |
| Disable a Tiptap extension | Use `createEditorExtensions` |
| Add a custom Tiptap extension | Assemble `extensions` yourself and pass them to the component |
