# 视频、音频和文件上传

视频、音频和文件统一通过 `uploadAsset` 接入。Core 只负责拿到上传结果并插入节点,真实上传、鉴权、进度、错误提示和 CDN 地址都由业务实现。

内置工具栏当前只暴露视频和文件上传入口。音频命令、解析和渲染能力仍保留,适合在自定义工具栏或业务流程中调用;待音频播放器选中体验稳定后,再恢复默认入口。

## 基础接入

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

## 播放器或文件卡片

视频和音频都可以选择两种插入方式:

| 配置 | 结果 |
| --- | --- |
| `displayMode: 'player'` | 插入原生 `<video>` / `<audio>` 播放器 |
| `displayMode: 'file'` | 插入文件卡片,按附件方式展示 |

```ts
const editorBehaviorOptions: EditorBehaviorOptions = {
  media: {
    video: { render: { displayMode: 'file' } },
    audio: { render: { displayMode: 'file' } },
  },
}
```

`multiple` 默认 `false`,保持一次只选择一个文件。设置为 `true` 后,对应上传入口允许一次选择多个文件,并按选择顺序逐个调用 `uploadAsset(file, kind)`。内置工具栏当前只会为视频和文件创建选择入口;音频配置仍会被 core 命令使用。每个文件仍会独立应用 `accept` 和 `maxSize` 校验,不通过的文件会跳过上传。

文件卡片会复用 `media.file.render` 的展示配置,可以控制图标、文件名、大小、文件类型标签、上传时间和时长;原始 MIME 会保存在 `data-mime-type`。默认文件类型标签会按当前 `locale` 输出,也可以通过 `UploadedAsset.fileTypeText` 覆盖。

`iconMode: 'auto'` 会根据 MIME 或扩展名识别常见类型:PDF、图片、视频、音频、压缩包、Word / Pages、Excel / CSV / Numbers、PPT / Keynote、文本和代码文件。识别结果会保存到 `data-file-icon`,方便 HTML 输出后继续按相同图标渲染。

## 插入后的上下文编辑

插入后的媒体和文件会在选中时显示上下文工具栏:

| 元素 | 支持操作 |
| --- | --- |
| 视频 / 音频播放器 | 编辑名称和播放配置、打开、下载、复制链接、切换为文件卡片、删除 |
| 文件卡片 | 编辑文件名和展示开关、打开、下载、复制链接、删除 |
| 视频 / 音频文件卡片 | 除文件操作外,还可以切换回播放器 |

这些编辑会写回节点属性。可序列化的数据会保存在 HTML / JSON 中;运行时函数仍不会写入文档内容。

## HTML 输出

HTML 输出会尽量保持可逆:

- 视频播放器使用 `<video>` 标准属性保存 `src`、`controls`、`muted`、`loop`、`autoplay`、`preload`、`poster` 等。
- 音频播放器使用 `<audio>` 标准属性保存 `src`、`controls`、`muted`、`loop`、`autoplay`、`preload` 等。
- 无法完整表达为标准属性的配置会写入 `data-*`,例如 `data-name`、`data-size`、`data-mime-type`、`data-file-type-text`、`data-duration`、`data-show-uploaded-at`。
- 文件卡片使用 `<a class="tvp-file-attachment">` 保存 URL 和展示开关。

函数不能序列化到 HTML。`poster(asset)`、`uploadedAtFormat`、`durationFormat` 这类函数只影响当前运行时渲染;如果希望刷新后仍保留结果,请把计算结果放到 `UploadedAsset.poster`、`uploadedAt`、`duration`、`fileTypeText` 等字段里。

## 自定义渲染边界

内置渲染覆盖常见业务配置。如果需要完全自定义文件卡片结构,建议保持两层边界:

| 层 | 建议 |
| --- | --- |
| 数据层 | 继续使用 `UploadedAsset` 和内置 `data-*` 属性保存可逆数据 |
| UI 层 | 在业务展示页或自定义 Tiptap extension 中按自己的组件渲染 |

这样 HTML / JSON 中仍然有稳定数据,UI 可以自由升级,不会把不可序列化的渲染函数塞进文档内容。
