# EditorBehaviorOptions

`EditorBehaviorOptions` controls default editor behavior. It is a good surface to expose as product-level preferences in business apps.

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
    maxSize?: number
    multiple?: boolean
    allowUrl?: boolean
    crop?: boolean | {
      enabled?: boolean
      aspectRatio?: number
      quality?: number
      mimeType?: string
    }
  }
  media?: {
    video?: {
      accept?: string
      maxSize?: number
      multiple?: boolean
      render?: {
        displayMode?: 'player' | 'file'
        controls?: boolean
        muted?: boolean
        loop?: boolean
        autoplay?: boolean
        playsInline?: boolean
        preload?: 'none' | 'metadata' | 'auto'
        allowFullscreen?: boolean
        allowDownload?: boolean
        allowPictureInPicture?: boolean
        width?: string | number
        poster?: string | ((asset: EditorMediaAssetMetadata) => string | undefined)
      }
    }
    audio?: {
      accept?: string
      maxSize?: number
      multiple?: boolean
      render?: {
        displayMode?: 'player' | 'file'
        controls?: boolean
        muted?: boolean
        loop?: boolean
        autoplay?: boolean
        preload?: 'none' | 'metadata' | 'auto'
        allowDownload?: boolean
      }
    }
    file?: {
      accept?: string
      maxSize?: number
      multiple?: boolean
      render?: {
        showIcon?: boolean
        iconMode?: 'auto' | 'file' | 'none'
        showName?: boolean
        showSize?: boolean
        showMimeType?: boolean
        showUploadedAt?: boolean
        showDuration?: boolean
        uploadedAtFormat?: 'datetime' | 'date' | ((value: string | number | Date) => string)
        durationFormat?: (duration: number) => string
        openInNewTab?: boolean
        download?: boolean
      }
    }
  }
  feedback?: {
    elementToolbarSuccess?: boolean
  }
}
```

## Defaults

| Option | Default | Description |
| --- | --- | --- |
| `link.defaultTarget` | `'_blank'` | Links open in a new window by default |
| `table.withHeaderRow` | `true` | Inserted tables include a header row by default |
| `image.accept` | `'image/*'` | Image upload and replacement accept all images by default |
| `image.maxSize` | `undefined` | Single-image size limit for upload, replacement, paste, and drop, in bytes |
| `image.multiple` | `false` | Whether toolbar image upload can select multiple files at once |
| `image.allowUrl` | `true` | Whether to show the toolbar image URL entry; when upload and URL are both available, they are merged into one image dropdown |
| `image.crop` | `false` | Whether toolbar image selection opens the crop dialog; paste and drag/drop are not cropped |
| `image.crop.aspectRatio` | `1` | Crop ratio, such as `1` for square images or `16 / 9` for landscape covers |
| `image.crop.quality` | `0.92` | Canvas output quality, used by lossy formats such as JPEG/WebP |
| `image.crop.mimeType` | Original file MIME | Output MIME type after cropping; when omitted, the original file type is reused |
| `media.video.accept` | `'video/*'` | Accepted file types for video upload |
| `media.video.maxSize` | `undefined` | Video file size limit, in bytes |
| `media.video.multiple` | `false` | Whether video upload can select multiple files at once |
| `media.video.render.displayMode` | `'player'` | Insert video as a native player or file card |
| `media.video.render.controls` | `true` | Whether to show native controls |
| `media.video.render.muted` | `false` | Whether video is muted by default |
| `media.video.render.loop` | `false` | Whether video loops |
| `media.video.render.autoplay` | `false` | Whether video autoplays |
| `media.video.render.playsInline` | `true` | Whether mobile playback stays inline |
| `media.video.render.preload` | `'metadata'` | Native `preload` strategy |
| `media.video.render.allowFullscreen` | `true` | Whether fullscreen controls are allowed |
| `media.video.render.allowDownload` | `true` | Whether download controls are allowed |
| `media.video.render.allowPictureInPicture` | `true` | Whether picture-in-picture is allowed |
| `media.video.render.width` | `undefined` | Video player width |
| `media.video.render.poster` | `undefined` | Video poster URL or a function derived from asset metadata |
| `media.audio.accept` | `'audio/*'` | Accepted file types for audio upload |
| `media.audio.maxSize` | `undefined` | Audio file size limit, in bytes |
| `media.audio.multiple` | `false` | Whether audio upload can select multiple files at once |
| `media.audio.render.displayMode` | `'player'` | Insert audio as a native player or file card |
| `media.audio.render.controls` | `true` | Whether to show native controls |
| `media.audio.render.muted` | `false` | Whether audio is muted by default |
| `media.audio.render.loop` | `false` | Whether audio loops |
| `media.audio.render.autoplay` | `false` | Whether audio autoplays |
| `media.audio.render.preload` | `'metadata'` | Native `preload` strategy |
| `media.audio.render.allowDownload` | `true` | Whether download controls are allowed |
| `media.file.accept` | `'*'` | Accepted file types for file upload |
| `media.file.maxSize` | `undefined` | File size limit, in bytes |
| `media.file.multiple` | `false` | Whether file upload can select multiple files at once |
| `media.file.render.showIcon` | `true` | Whether the file card shows an icon |
| `media.file.render.iconMode` | `'auto'` | Detect icon by file type, force a generic file icon, or hide it |
| `media.file.render.showName` | `true` | Whether the file card shows the file name |
| `media.file.render.showSize` | `true` | Whether the file card shows file size |
| `media.file.render.showMimeType` | `false` | Whether the file card shows a file type label; raw MIME is still saved to `data-mime-type` |
| `media.file.render.showUploadedAt` | `false` | Whether the file card shows upload time |
| `media.file.render.showDuration` | `true` | Whether the file card shows media duration |
| `media.file.render.openInNewTab` | `true` | Whether clicking the file opens a new tab |
| `media.file.render.download` | `true` | Whether to include the `download` attribute |
| `feedback.elementToolbarSuccess` | `true` | Whether link, file, and media contextual toolbar success actions show notifications; when disabled, successful delete/copy actions are silent while validation errors and upload failures still notify |

## Example

```ts
const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  table: { withHeaderRow: false },
  image: {
    accept: 'image/png,image/jpeg,image/webp',
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    allowUrl: true,
  },
  media: {
    video: {
      maxSize: 100 * 1024 * 1024,
      multiple: true,
      render: {
        displayMode: 'player',
        controls: true,
        muted: false,
        allowFullscreen: true,
        allowDownload: false,
      },
    },
    audio: {
      multiple: true,
      render: {
        displayMode: 'file',
      },
    },
    file: {
      accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip',
      maxSize: 50 * 1024 * 1024,
      multiple: true,
      render: {
        showIcon: true,
        showSize: true,
        showMimeType: true,
        showUploadedAt: true,
      },
    },
  },
  feedback: {
    elementToolbarSuccess: false,
  },
}
```

## HTML Output and Reversibility

HTML mode writes serializable attributes to standard attributes or `data-*`:

| Node | HTML shape |
| --- | --- |
| Video player | `<video src controls data-name data-mime-type data-duration ...>` |
| Audio player | `<audio src controls data-name data-mime-type data-duration ...>` |
| File card | `<a class="tvp-file-attachment" href data-name data-size data-mime-type data-uploaded-at ...>` |

Persisted content includes URL, file name, size, raw MIME, file type label, uploaded time, duration, video poster, player switches, and file card display switches. Function options are not written into HTML. For example, `poster(asset)`, `uploadedAtFormat`, and `durationFormat` only affect the current runtime. If a result must be persisted, resolve it into `UploadedAsset` or node attributes as a string.
