# 图片、视频和附件上传

这个 recipe 适合先在本地验证工具栏上传、粘贴图片、拖拽图片、视频和文件附件入口,再逐步接入生产上传服务。

[在线体验这个场景](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=uploads)

## 本地 mock 上传

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type UploadAsset,
  type UploadImage,
} from 'tiptap-vue-pro-element-plus'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const content = ref('<p>可以上传图片、视频和附件。</p>')

const uploadImage: UploadImage = async (file) => {
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  return URL.createObjectURL(file)
}

const uploadAsset: UploadAsset = async (file, kind) => {
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  return {
    url: URL.createObjectURL(file),
    name: file.name,
    size: file.size,
    mimeType: file.type,
    fileTypeText: kind === 'file' ? '附件' : undefined,
    uploadedAt: Date.now(),
  }
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  image: {
    accept: 'image/png,image/jpeg,image/webp',
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    allowUrl: true,
  },
  media: {
    video: { accept: 'video/mp4,video/webm', maxSize: 100 * 1024 * 1024 },
    audio: { accept: 'audio/mpeg,audio/wav', maxSize: 30 * 1024 * 1024 },
    file: { accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip', maxSize: 50 * 1024 * 1024 },
  },
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :upload-image="uploadImage"
    :upload-asset="uploadAsset"
    :editor-behavior-options="editorBehaviorOptions"
  />
</template>
```

## 生产上传接口

生产环境不要保存 `blob:` URL。后端、OSS、COS、S3 或 CDN 应返回可长期访问的 URL:

```ts
const uploadImage: UploadImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/uploads/images', {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()

  return data.url
}
```

## 常见坑

- 上传按钮没反应时,先确认是否传入了 `uploadImage` / `uploadAsset`。
- 返回 URL 必须能被当前页面访问;内网地址、临时签名过期都会导致内容后续不可见。
- 文件类型和大小会被 `accept` / `maxSize` 拦截。

更多细节见 [图片上传](/guide/image-upload) 和 [视频、音频和文件上传](/guide/media-upload)。
