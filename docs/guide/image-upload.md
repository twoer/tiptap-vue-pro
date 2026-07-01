# 图片上传

图片能力由两部分组成:

| 能力 | 入口 |
| --- | --- |
| 上传文件、粘贴图片、拖拽图片 | `uploadImage` |
| 限制可选文件类型 | `editorBehaviorOptions.image.accept` |
| 工具栏图片上传是否允许多选 | `editorBehaviorOptions.image.multiple` |
| 是否显示网络图片入口 | `editorBehaviorOptions.image.allowUrl` |

```vue
<script setup lang="ts">
import type { EditorBehaviorOptions, UploadImage } from 'tiptap-vue-pro-element-plus'

const uploadImage: UploadImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  image: {
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
    allowUrl: true,
  },
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :upload-image="uploadImage"
    :editor-behavior-options="editorBehaviorOptions"
  />
</template>
```

`image.multiple` 默认 `false`,保持一次只选择一个文件。设置为 `true` 后,工具栏图片上传会按选择顺序逐个调用 `uploadImage` 并插入。粘贴和拖拽仍沿用已有批量图片处理能力。

`image.allowUrl` 默认 `true`,用于显示「网络图片」入口。设置为 `false` 后,如果只配置了 `uploadImage`,工具栏会直接显示「上传图片」按钮,不会再出现图片下拉菜单。

`uploadImage` 返回 `null` 时会跳过插入;抛错时会触发 Adapter 注入的消息提示。Core 不关心文件上传到 OSS、COS、S3 还是业务后端,只关心最后拿到可访问的 URL。

视频、音频和通用文件上传见 [视频、音频和文件上传](/guide/media-upload)。
