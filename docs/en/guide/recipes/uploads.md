# Image, Video, and Attachment Uploads

Use this recipe to verify toolbar uploads, pasted images, dropped images, video, audio, and file attachment entries locally before connecting a production upload service.

[Try this scenario online](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=uploads)

## Local mock upload

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

const content = ref('<p>Upload images, videos, and attachments here.</p>')

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
    fileTypeText: kind === 'file' ? 'Attachment' : undefined,
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

## Production upload

Do not store `blob:` URLs in production. Your backend, OSS, COS, S3, or CDN should return persistent URLs:

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

## Common pitfalls

- If upload buttons do nothing, first check whether `uploadImage` / `uploadAsset` is passed.
- Returned URLs must be accessible from the current page; private LAN URLs or expired signed URLs will break later rendering.
- File types and sizes can be blocked by `accept` / `maxSize`.

See [Image Upload](/en/guide/image-upload) and [Video, Audio, and File Upload](/en/guide/media-upload) for details.
