export type EditorLinkTarget = '_blank' | '_self'

export interface EditorLinkBehaviorOptions {
  defaultTarget?: EditorLinkTarget
}

export interface EditorTableBehaviorOptions {
  withHeaderRow?: boolean
}

export interface EditorImageBehaviorOptions {
  accept?: string
  maxSize?: number
  multiple?: boolean
  allowUrl?: boolean
}

export interface EditorAssetBehaviorOptions {
  accept?: string
  maxSize?: number
  multiple?: boolean
}

export interface EditorMediaAssetMetadata {
  url: string
  name?: string
  size?: number
  mimeType?: string
  uploadedAt?: string | number | Date
  duration?: number
  poster?: string
}

export interface EditorVideoRenderOptions {
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

export interface EditorAudioRenderOptions {
  displayMode?: 'player' | 'file'
  controls?: boolean
  muted?: boolean
  loop?: boolean
  autoplay?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  allowDownload?: boolean
  width?: string | number
}

export type FileAttachmentIconMode = 'auto' | 'file' | 'none'

export interface EditorFileRenderOptions {
  showIcon?: boolean
  iconMode?: FileAttachmentIconMode
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

export interface EditorMediaBehaviorOptions {
  video?: EditorAssetBehaviorOptions & { render?: EditorVideoRenderOptions }
  audio?: EditorAssetBehaviorOptions & { render?: EditorAudioRenderOptions }
  file?: EditorAssetBehaviorOptions & { render?: EditorFileRenderOptions }
}

export interface EditorFeedbackBehaviorOptions {
  elementToolbarSuccess?: boolean
}

export interface EditorBehaviorOptions {
  link?: EditorLinkBehaviorOptions
  table?: EditorTableBehaviorOptions
  image?: EditorImageBehaviorOptions
  media?: EditorMediaBehaviorOptions
  feedback?: EditorFeedbackBehaviorOptions
}

export interface ResolvedEditorImageBehaviorOptions {
  accept: string
  maxSize?: number
  multiple: boolean
  allowUrl: boolean
}

export interface ResolvedEditorVideoRenderOptions
  extends Required<Omit<EditorVideoRenderOptions, 'poster' | 'width'>> {
  width?: string | number
  poster?: string | ((asset: EditorMediaAssetMetadata) => string | undefined)
}

export interface ResolvedEditorAudioRenderOptions
  extends Required<Omit<EditorAudioRenderOptions, 'width'>> {
  width?: string | number
}

export interface ResolvedEditorFileRenderOptions
  extends Required<Omit<EditorFileRenderOptions, 'durationFormat'>> {
  durationFormat?: (duration: number) => string
}

export interface ResolvedEditorAssetBehaviorOptions {
  accept: string
  maxSize?: number
  multiple: boolean
}

export interface ResolvedEditorMediaBehaviorOptions {
  video: ResolvedEditorAssetBehaviorOptions & { render: ResolvedEditorVideoRenderOptions }
  audio: ResolvedEditorAssetBehaviorOptions & { render: ResolvedEditorAudioRenderOptions }
  file: ResolvedEditorAssetBehaviorOptions & { render: ResolvedEditorFileRenderOptions }
}

export interface ResolvedEditorBehaviorOptions {
  link: Required<EditorLinkBehaviorOptions>
  table: Required<EditorTableBehaviorOptions>
  image: ResolvedEditorImageBehaviorOptions
  media: ResolvedEditorMediaBehaviorOptions
  feedback: Required<EditorFeedbackBehaviorOptions>
}

export const DEFAULT_EDITOR_BEHAVIOR_OPTIONS: ResolvedEditorBehaviorOptions = {
  link: {
    defaultTarget: '_blank',
  },
  table: {
    withHeaderRow: true,
  },
  image: {
    accept: 'image/*',
    multiple: false,
    allowUrl: true,
  },
  media: {
    video: {
      accept: 'video/*',
      multiple: false,
      render: {
        displayMode: 'player',
        controls: true,
        muted: false,
        loop: false,
        autoplay: false,
        playsInline: true,
        preload: 'metadata',
        allowFullscreen: true,
        allowDownload: true,
        allowPictureInPicture: true,
      },
    },
    audio: {
      accept: 'audio/*',
      multiple: false,
      render: {
        displayMode: 'player',
        controls: true,
        muted: false,
        loop: false,
        autoplay: false,
        preload: 'metadata',
        allowDownload: true,
      },
    },
    file: {
      accept: '*',
      multiple: false,
      render: {
        showIcon: true,
        iconMode: 'auto',
        showName: true,
        showSize: true,
        showMimeType: false,
        showUploadedAt: false,
        showDuration: true,
        uploadedAtFormat: 'datetime',
        openInNewTab: true,
        download: true,
      },
    },
  },
  feedback: {
    elementToolbarSuccess: true,
  },
}

function resolveAssetOptions(
  options: EditorAssetBehaviorOptions | undefined,
  fallback: ResolvedEditorAssetBehaviorOptions,
): ResolvedEditorAssetBehaviorOptions {
  const resolved: ResolvedEditorAssetBehaviorOptions = {
    accept: options?.accept ?? fallback.accept,
    multiple: options?.multiple ?? fallback.multiple,
  }
  if (options?.maxSize !== undefined) {
    resolved.maxSize = options.maxSize
  } else if (fallback.maxSize !== undefined) {
    resolved.maxSize = fallback.maxSize
  }
  return resolved
}

export function resolveEditorBehaviorOptions(
  options: EditorBehaviorOptions = {},
): ResolvedEditorBehaviorOptions {
  const image: ResolvedEditorImageBehaviorOptions = {
    accept: options.image?.accept ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.image.accept,
    multiple: options.image?.multiple ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.image.multiple,
    allowUrl: options.image?.allowUrl ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.image.allowUrl,
  }
  if (options.image?.maxSize !== undefined) {
    image.maxSize = options.image.maxSize
  }
  const mediaDefaults = DEFAULT_EDITOR_BEHAVIOR_OPTIONS.media
  const videoAsset = resolveAssetOptions(options.media?.video, mediaDefaults.video)
  const audioAsset = resolveAssetOptions(options.media?.audio, mediaDefaults.audio)
  const fileAsset = resolveAssetOptions(options.media?.file, mediaDefaults.file)
  return {
    link: {
      defaultTarget: options.link?.defaultTarget ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.link.defaultTarget,
    },
    table: {
      withHeaderRow: options.table?.withHeaderRow ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.table.withHeaderRow,
    },
    image,
    feedback: {
      elementToolbarSuccess: options.feedback?.elementToolbarSuccess
        ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.feedback.elementToolbarSuccess,
    },
    media: {
      video: {
        ...videoAsset,
        render: {
          ...mediaDefaults.video.render,
          ...(options.media?.video?.render ?? {}),
        },
      },
      audio: {
        ...audioAsset,
        render: {
          ...mediaDefaults.audio.render,
          ...(options.media?.audio?.render ?? {}),
        },
      },
      file: {
        ...fileAsset,
        render: {
          ...mediaDefaults.file.render,
          ...(options.media?.file?.render ?? {}),
        },
      },
    },
  }
}
