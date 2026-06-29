# Props

三套 Adapter 的 props 保持一致。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string \| object` | `''` | `v-model` 绑定值 |
| `output` | `'html' \| 'json'` | `'html'` | 输出格式 |
| `placeholder` | `string` | `'请输入内容...'` | 占位文案 |
| `uploadImage` | `(file: File) => Promise<string \| null>` | - | 图片上传函数,传入后支持上传、粘贴、拖拽 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `dark` | `boolean` | `false` | 暗色模式,组件级独立切换 |
| `showWordCount` | `boolean` | `true` | 是否显示底部字数统计 |
| `toolbar` | `ToolbarConfig \| false` | 默认完整工具栏 | 控制工具栏按钮分组和顺序 |
| `toolbarOptions` | `ToolbarOptions` | 默认菜单配置 | 控制工具栏菜单数据和动作参数 |
| `editorBehaviorOptions` | `EditorBehaviorOptions` | 默认行为配置 | 控制链接、表格、图片等默认行为 |
| `extensions` | `Extensions` | 默认扩展包 | 自定义 Tiptap 扩展,传入后覆盖默认扩展包 |

## Events

| 事件 | 说明 |
| --- | --- |
| `update:modelValue` | 编辑器内容变化时触发,配合 `v-model` 使用 |

## Slots

| 插槽 | 说明 |
| --- | --- |
| `toolbar` | 完全替换内置工具栏 |
| `toolbar-before` | 插入到内置工具栏按钮前 |
| `toolbar-after` | 插入到内置工具栏按钮后 |
