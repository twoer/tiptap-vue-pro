# 扩展注册表

扩展注册表用于控制默认 Tiptap 扩展包。日常使用 Adapter 时通常不需要直接碰它;当你要减少功能、替换默认扩展或构建 Headless 编辑器时,可以使用 Core 暴露的 `createEditorExtensions`。

```ts
import { createEditorExtensions } from 'tiptap-vue-pro-core'

const extensions = createEditorExtensions({
  placeholderText: '请输入内容...',
  markdown: true,
  table: true,
  image: true,
})
```

再传给 Adapter:

```vue
<ProEditorElementPlus v-model="content" :extensions="extensions" />
```

## 可配置项

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
传入 `extensions` 会覆盖默认扩展数组。只想调整字体、字号、色板、代码语言、分割线样式、表格网格等菜单数据时,优先使用 `toolbarOptions`。
:::

## 什么时候该碰扩展注册表

| 目标 | 建议 |
| --- | --- |
| 只是改工具栏按钮 | 用 `toolbar` |
| 只是改字体、字号、色板、代码语言、分割线样式 | 用 `toolbarOptions` |
| 只是改链接 target、表格表头、图片 accept 和大小上限 | 用 `editorBehaviorOptions` |
| 要禁用某个 Tiptap 扩展 | 用 `createEditorExtensions` |
| 要接入自定义 Tiptap 扩展 | 自己组装 `extensions` 后传给组件 |
