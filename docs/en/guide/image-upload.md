# Image Upload

Image support is made of two parts:

| Capability | Entry |
| --- | --- |
| Upload files, paste images, and drop images | `uploadImage` |
| Restrict selectable file types | `editorBehaviorOptions.image.accept` |
| Allow multiple image selection in the toolbar | `editorBehaviorOptions.image.multiple` |
| Show the image URL entry | `editorBehaviorOptions.image.allowUrl` |
| Crop before upload | `editorBehaviorOptions.image.crop` |

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
    crop: {
      enabled: true,
      aspectRatio: 16 / 9,
      quality: 0.9,
    },
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

`image.crop` is disabled by default. Set it to `true` to open a crop dialog after toolbar image selection; the default crop is centered and square. You can also pass options such as `{ enabled: true, aspectRatio: 16 / 9 }` for cover images. Cropping only applies to toolbar file selection. Pasted and dropped images still upload the original file to avoid interrupting screenshot workflows.

When `uploadImage` returns `null`, insertion is skipped. When it throws, the adapter-injected message UI is notified. Core does not care whether files go to OSS, COS, S3, or your own backend; it only needs a final accessible URL.

## Local Mock Upload

Before a backend endpoint exists, you can use `URL.createObjectURL(file)` to verify toolbar upload, paste, and drag/drop flows:

```ts
const uploadImage: UploadImage = async (file) => {
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  return URL.createObjectURL(file)
}
```

`blob:` URLs only work in the current browser session and may break after refresh. Production uploads must return persistent URLs.

## Troubleshooting

- No upload entry: make sure `uploadImage` is passed and your custom `toolbar` still includes the `image` button.
- File is selected but not inserted: make sure `uploadImage` returns an accessible URL, not `undefined`.
- File cannot be selected: check whether `editorBehaviorOptions.image.accept` includes the MIME type.
- Large images are skipped: check `editorBehaviorOptions.image.maxSize`.
- Upload-only image workflow: set `editorBehaviorOptions.image.allowUrl=false`.

For video, audio, and generic file upload, see [Video, Audio, and File Upload](/en/guide/media-upload).
