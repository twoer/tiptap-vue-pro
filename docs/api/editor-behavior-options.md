# EditorBehaviorOptions

`EditorBehaviorOptions` 控制编辑器默认行为,适合开放给业务侧做产品级偏好配置。

```ts
type EditorLinkTarget = '_blank' | '_self'

interface EditorBehaviorOptions {
  link?: {
    defaultTarget?: EditorLinkTarget
  }
  table?: {
    withHeaderRow?: boolean
  }
  image?: {
    accept?: string
  }
}
```

## 默认值

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `link.defaultTarget` | `'_blank'` | 链接默认新窗口打开 |
| `table.withHeaderRow` | `true` | 插入表格默认带表头 |
| `image.accept` | `'image/*'` | 图片上传和替换默认接受所有图片 |

## 示例

```ts
const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  table: { withHeaderRow: false },
  image: { accept: 'image/png,image/jpeg,image/webp' },
}
```
