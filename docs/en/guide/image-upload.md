# Image Upload

Image support is made of two parts:

| Capability | Entry |
| --- | --- |
| Upload files, paste images, and drop images | `uploadImage` |
| Restrict selectable file types | `editorBehaviorOptions.image.accept` |
| Allow multiple image selection in the toolbar | `editorBehaviorOptions.image.multiple` |
| Show the image URL entry | `editorBehaviorOptions.image.allowUrl` |

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

`image.multiple` defaults to `false`, preserving one-file-at-a-time toolbar selection. When set to `true`, toolbar image upload calls `uploadImage` and inserts images sequentially in the selected order. Paste and drag/drop keep their existing batch image handling.

`image.allowUrl` defaults to `true` and controls the image URL entry. When set to `false`, a toolbar with only `uploadImage` configured shows a direct upload button instead of an image dropdown.

When `uploadImage` returns `null`, insertion is skipped. When it throws, the adapter-injected message UI is notified. Core does not care whether files go to OSS, COS, S3, or your own backend; it only needs a final accessible URL.

For video, audio, and generic file upload, see [Video, Audio, and File Upload](/en/guide/media-upload).
