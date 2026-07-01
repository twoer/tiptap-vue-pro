# Props

三套 Adapter 的 props 保持一致。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string \| object` | `''` | `v-model` 绑定值 |
| `output` | `'html' \| 'json'` | `'html'` | 输出格式 |
| `placeholder` | `string` | 当前语言默认值 | 占位文案 |
| `locale` | `'zh-CN' \| 'en-US' \| LocaleOptions` | `'zh-CN'` | 内置文案语言或局部文案覆盖 |
| `uploadImage` | `(file: File) => Promise<string \| null>` | - | 图片上传函数,传入后支持上传、粘贴、拖拽 |
| `uploadAsset` | `(file: File, kind: UploadAssetKind) => Promise<string \| UploadedAsset \| null>` | - | 视频、音频、文件上传函数,传入后启用附件菜单 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `dark` | `boolean` | `false` | 暗色模式,组件级独立切换 |
| `showWordCount` | `boolean` | `true` | 是否显示底部字数统计 |
| `toolbar` | `ToolbarConfig \| false` | 默认完整工具栏 | 控制工具栏按钮分组和顺序 |
| `toolbarOptions` | `ToolbarOptions` | 默认菜单配置 | 控制工具栏菜单数据和动作参数 |
| `editorBehaviorOptions` | `EditorBehaviorOptions` | 默认行为配置 | 控制链接、表格、图片等默认行为 |
| `extensions` | `Extensions` | 默认扩展包 | 自定义 Tiptap 扩展,传入后覆盖默认扩展包 |
| `debug` | `boolean \| ProEditorDebugOptions` | `false` | 开发者诊断开关,用于排查接入和编辑器行为问题 |
| `debugLogger` | `(entry: ProEditorDebugEntry) => void` | `console.debug` | 自定义诊断日志接收器 |

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

## Locale

内置支持中文和英文:

```vue
<ProEditorElementPlus v-model="content" locale="en-US" />
```

也可以只覆盖少量文案:

```vue
<ProEditorElementPlus
  v-model="content"
  :locale="{
    locale: 'zh-CN',
    messages: {
      'command.bold': '粗体',
      'placeholder.default': '开始写作...',
    },
  }"
/>
```

`locale` 会影响内置工具栏、弹窗、消息提示、预览条、字数统计和未显式传入 `placeholder` 时的默认占位文案。自定义 `toolbarOptions` 中传入的菜单 label 会按原样显示,不会被内置字典覆盖。

## UploadAsset

`uploadAsset` 用于视频、音频和通用文件上传。`kind` 表示当前入口:

```ts
type UploadAssetKind = 'image' | 'video' | 'audio' | 'file'

interface UploadedAsset {
  url: string
  name?: string
  size?: number
  mimeType?: string
  fileTypeText?: string
  uploadedAt?: string | number | Date
  duration?: number
  poster?: string
}
```

返回 `string` 时会被当作资源 URL,Core 会用原始 `File` 补齐 `name`、`size`、`mimeType`;
返回 `UploadedAsset` 时会保留服务端元数据;`fileTypeText` 可覆盖文件卡片里的类型标签;返回 `null` 时跳过插入。

## Developer Diagnostics

`debug` 和 `debugLogger` 面向开发者排障,默认关闭。可按通道过滤 lifecycle、content、selection、transaction、command、upload、markdown、adapter、table 等日志。详见[开发者诊断](/advanced/developer-diagnostics)。
