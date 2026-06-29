# 图片上传

图片能力由两部分组成:

| 能力 | 入口 |
| --- | --- |
| 上传文件、粘贴图片、拖拽图片 | `uploadImage` |
| 限制可选文件类型 | `editorBehaviorOptions.image.accept` |

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

`uploadImage` 返回 `null` 时会跳过插入;抛错时会触发 Adapter 注入的消息提示。Core 不关心文件上传到 OSS、COS、S3 还是业务后端,只关心最后拿到可访问的 URL。
