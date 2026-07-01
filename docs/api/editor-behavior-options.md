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
    maxSize?: number
    multiple?: boolean
    allowUrl?: boolean
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

## 默认值

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `link.defaultTarget` | `'_blank'` | 链接默认新窗口打开 |
| `table.withHeaderRow` | `true` | 插入表格默认带表头 |
| `image.accept` | `'image/*'` | 图片上传和替换默认接受所有图片 |
| `image.maxSize` | `undefined` | 图片上传、替换、粘贴和拖拽的单图大小上限(字节) |
| `image.multiple` | `false` | 工具栏图片上传是否允许一次选择多个文件 |
| `image.allowUrl` | `true` | 是否显示工具栏网络图片入口;与上传入口同时存在时合并为图片下拉菜单 |
| `media.video.accept` | `'video/*'` | 视频上传入口接受的文件类型 |
| `media.video.maxSize` | `undefined` | 视频文件大小上限(字节) |
| `media.video.multiple` | `false` | 视频上传入口是否允许一次选择多个文件 |
| `media.video.render.displayMode` | `'player'` | 视频插入为原生播放器或文件卡片 |
| `media.video.render.controls` | `true` | 是否显示原生控制栏 |
| `media.video.render.muted` | `false` | 是否默认静音 |
| `media.video.render.loop` | `false` | 是否循环播放 |
| `media.video.render.autoplay` | `false` | 是否自动播放 |
| `media.video.render.playsInline` | `true` | 移动端是否内联播放 |
| `media.video.render.preload` | `'metadata'` | 原生 `preload` 策略 |
| `media.video.render.allowFullscreen` | `true` | 是否允许全屏按钮 |
| `media.video.render.allowDownload` | `true` | 是否允许下载按钮 |
| `media.video.render.allowPictureInPicture` | `true` | 是否允许画中画 |
| `media.video.render.width` | `undefined` | 视频播放器宽度 |
| `media.video.render.poster` | `undefined` | 视频封面 URL 或根据资源元数据生成封面的函数 |
| `media.audio.accept` | `'audio/*'` | 音频上传入口接受的文件类型 |
| `media.audio.maxSize` | `undefined` | 音频文件大小上限(字节) |
| `media.audio.multiple` | `false` | 音频上传入口是否允许一次选择多个文件 |
| `media.audio.render.displayMode` | `'player'` | 音频插入为原生播放器或文件卡片 |
| `media.audio.render.controls` | `true` | 是否显示原生控制栏 |
| `media.audio.render.muted` | `false` | 是否默认静音 |
| `media.audio.render.loop` | `false` | 是否循环播放 |
| `media.audio.render.autoplay` | `false` | 是否自动播放 |
| `media.audio.render.preload` | `'metadata'` | 原生 `preload` 策略 |
| `media.audio.render.allowDownload` | `true` | 是否允许下载按钮 |
| `media.file.accept` | `'*'` | 文件上传入口接受的文件类型 |
| `media.file.maxSize` | `undefined` | 文件大小上限(字节) |
| `media.file.multiple` | `false` | 文件上传入口是否允许一次选择多个文件 |
| `media.file.render.showIcon` | `true` | 文件卡片是否显示图标 |
| `media.file.render.iconMode` | `'auto'` | 图标自动按文件类型识别、固定文件图标或不显示 |
| `media.file.render.showName` | `true` | 文件卡片是否显示文件名 |
| `media.file.render.showSize` | `true` | 文件卡片是否显示大小 |
| `media.file.render.showMimeType` | `false` | 文件卡片是否显示文件类型标签;原始 MIME 仍保存到 `data-mime-type` |
| `media.file.render.showUploadedAt` | `false` | 文件卡片是否显示上传时间 |
| `media.file.render.showDuration` | `true` | 文件卡片是否显示媒体时长 |
| `media.file.render.openInNewTab` | `true` | 点击文件是否新窗口打开 |
| `media.file.render.download` | `true` | 是否带 `download` 属性 |
| `feedback.elementToolbarSuccess` | `true` | 链接、文件、媒体上下文工具条操作成功后是否显示提示;关闭后删除、复制等成功操作静默,校验错误和上传失败提示不受影响 |

## 示例

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

## HTML 输出与可逆性

HTML 模式会把可序列化属性写入标准属性或 `data-*`:

| 节点 | HTML 表达 |
| --- | --- |
| 视频播放器 | `<video src controls data-name data-mime-type data-duration ...>` |
| 音频播放器 | `<audio src controls data-name data-mime-type data-duration ...>` |
| 文件卡片 | `<a class="tvp-file-attachment" href data-name data-size data-mime-type data-uploaded-at ...>` |

可保存的内容包括 URL、文件名、大小、原始 MIME、文件类型标签、上传时间、时长、视频封面、播放器开关和文件卡片展示开关。函数型配置不会写进 HTML,例如 `poster(asset)`、`uploadedAtFormat`、`durationFormat` 只在当前运行时生效;需要长期保存的结果应在上传返回的 `UploadedAsset` 或节点属性中落成字符串。
