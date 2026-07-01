# Video, Audio, and File Upload

Video, audio, and generic files are integrated through `uploadAsset`. Core only receives the upload result and inserts the node. Real upload, auth, progress, error handling, and CDN URLs belong to your application.

The built-in toolbar currently exposes upload entries for video and generic files only. Audio commands, parsing, and rendering remain available for custom toolbars or application workflows; the default entry can be restored once audio-player selection feels stable.

## Basic Integration

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type UploadAsset,
} from 'tiptap-vue-pro-element-plus'

const content = ref('')

const uploadAsset: UploadAsset = async (file, kind) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)

  const res = await fetch('/api/upload-asset', {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()

  return {
    url: data.url,
    name: data.name ?? file.name,
    size: data.size ?? file.size,
    mimeType: data.mimeType ?? file.type,
    fileTypeText: data.fileTypeText,
    uploadedAt: data.uploadedAt ?? Date.now(),
    duration: data.duration,
    poster: data.poster,
  }
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  media: {
    video: {
      accept: 'video/mp4,video/webm',
      maxSize: 100 * 1024 * 1024,
      multiple: true,
      render: {
        displayMode: 'player',
        controls: true,
        muted: false,
        playsInline: true,
        allowFullscreen: true,
        allowDownload: false,
        allowPictureInPicture: true,
      },
    },
    audio: {
      accept: 'audio/mpeg,audio/wav,audio/ogg',
      maxSize: 30 * 1024 * 1024,
      multiple: true,
      render: {
        displayMode: 'player',
        controls: true,
        allowDownload: true,
      },
    },
    file: {
      accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip',
      maxSize: 50 * 1024 * 1024,
      multiple: true,
      render: {
        showIcon: true,
        showName: true,
        showSize: true,
        showMimeType: true,
        showUploadedAt: true,
        openInNewTab: true,
        download: true,
      },
    },
  },
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :upload-asset="uploadAsset"
    :editor-behavior-options="editorBehaviorOptions"
  />
</template>
```

## Player or File Card

Video and audio can be inserted in two modes:

| Config | Result |
| --- | --- |
| `displayMode: 'player'` | Insert a native `<video>` / `<audio>` player |
| `displayMode: 'file'` | Insert a file card and display it as an attachment |

```ts
const editorBehaviorOptions: EditorBehaviorOptions = {
  media: {
    video: { render: { displayMode: 'file' } },
    audio: { render: { displayMode: 'file' } },
  },
}
```

`multiple` defaults to `false`, preserving one-file-at-a-time selection. When set to `true`, the corresponding upload input allows multiple files and calls `uploadAsset(file, kind)` sequentially in the selected order. The built-in toolbar currently creates picker entries for video and generic files only; audio options are still used by core commands. Each file still gets its own `accept` and `maxSize` validation; invalid files are skipped.

File cards reuse `media.file.render` display options. You can control icon, file name, size, file type label, uploaded time, and duration. The raw MIME type is stored in `data-mime-type`. The default file type label follows the current `locale`, and can be overridden with `UploadedAsset.fileTypeText`.

`iconMode: 'auto'` detects common types from MIME or extension: PDF, image, video, audio, archive, Word / Pages, Excel / CSV / Numbers, PPT / Keynote, text, and code files. The detected key is stored in `data-file-icon`, so HTML output can render the same icon later.

## Contextual Editing After Insertion

Inserted media and files show a contextual toolbar when selected:

| Element | Supported actions |
| --- | --- |
| Video / audio player | Edit name and playback options, open, download, copy link, switch to file card, delete |
| File card | Edit file name and display switches, open, download, copy link, delete |
| Video / audio file card | In addition to file actions, switch back to player mode |

These edits are written back to node attributes. Serializable data is preserved in HTML / JSON; runtime functions are still not written into document content.

## HTML Output

HTML output is designed to stay as reversible as practical:

- Video players store `src`, `controls`, `muted`, `loop`, `autoplay`, `preload`, `poster`, and related data on native `<video>` attributes.
- Audio players store `src`, `controls`, `muted`, `loop`, `autoplay`, `preload`, and related data on native `<audio>` attributes.
- Options that cannot be fully expressed as standard attributes are written to `data-*`, such as `data-name`, `data-size`, `data-mime-type`, `data-file-type-text`, `data-duration`, and `data-show-uploaded-at`.
- File cards use `<a class="tvp-file-attachment">` to store the URL and display switches.

Functions cannot be serialized into HTML. Runtime functions such as `poster(asset)`, `uploadedAtFormat`, and `durationFormat` only affect the current render. If you need the result to survive reloads, put the computed value into `UploadedAsset.poster`, `uploadedAt`, `duration`, `fileTypeText`, or another serializable field.

## Custom Rendering Boundary

Built-in rendering covers common product configurations. If you need a fully custom file card structure, keep two boundaries:

| Layer | Recommendation |
| --- | --- |
| Data | Keep using `UploadedAsset` and built-in `data-*` attributes for reversible data |
| UI | Render your own component in business display pages or a custom Tiptap extension |

This keeps stable data in HTML / JSON while letting the UI evolve freely, without putting unserializable render functions into document content.
