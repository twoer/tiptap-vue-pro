# 完整示例

这一页给出可以直接复制的最小业务接入示例。三套 Adapter 的 props 一致,差异主要是组件名、样式文件和 UI 库依赖。

::: tip 先从业务场景开始
如果你正在接入真实后台,建议优先看 [业务 Recipes](/guide/recipes/):它们按文章表单、自动保存、上传、只读预览等场景拆开,比从一长页示例里找代码更快。
:::

## 业务场景入口

- [后台富文本表单](/guide/recipes/business-editor-form)
- [自动保存 + 本地草稿](/guide/recipes/autosave-drafts)
- [图片、视频和附件上传](/guide/recipes/uploads)
- [只读预览和详情页](/guide/recipes/readonly-preview)

## 后台表单编辑器

适合文章、公告、商品详情、帮助中心等后台表单。这个示例使用 Element Plus 表单组件承载编辑器,提交时把标题和富文本内容一起发送给业务接口。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const title = ref('产品更新公告')
const content = ref('<p>这里填写公告正文。</p>')
const saving = ref(false)

async function submitArticle() {
  saving.value = true

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 300))
    console.info('submit article', {
      title: title.value,
      content: content.value,
    })
    ElMessage.success('已保存')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="标题">
      <el-input v-model="title" placeholder="请输入标题" />
    </el-form-item>

    <el-form-item label="正文">
      <ProEditorElementPlus
        v-model="content"
        toolbar-layout="compact"
        placeholder="请输入正文..."
      />
    </el-form-item>

    <el-button type="primary" :loading="saving" @click="submitArticle">
      保存
    </el-button>
  </el-form>
</template>
```

Naive UI 和 Ant Design Vue 的接入方式保持对等,只需要替换组件名、样式入口和 UI 表单组件。

## 知识库编辑器

适合内部知识库、帮助文档、长文章和需要降低丢稿风险的编辑场景。这个示例同时启用远端自动保存和本地草稿恢复:远端保存是业务数据源,本地草稿只负责刷新、关闭标签页或浏览器崩溃前的兜底恢复。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const documentId = ref('kb-getting-started')
const content = ref('<h2>快速开始</h2><p>在这里维护知识库正文。</p>')

async function saveDocument(value: string | object) {
  await fetch(`/api/knowledge-base/${documentId.value}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: value }),
  })
}

function handleAutosaveStatus(state: { status: string }) {
  console.info('autosave status', state.status)
}

function handleDraftFound(candidate: { key: string | number }) {
  console.info('draft found', candidate.key)
}

function reportEditorError(error: unknown) {
  console.error(error)
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    toolbar-layout="compact"
    :autosave="{
      key: documentId,
      delay: 1200,
      onSave: saveDocument,
    }"
    :draft="{
      key: documentId,
      delay: 300,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }"
    @autosave-status-change="handleAutosaveStatus"
    @autosave-error="reportEditorError"
    @draft-found="handleDraftFound"
    @draft-error="reportEditorError"
  />
</template>
```

更多行为细节见 [自动保存](/guide/autosave) 和 [本地草稿恢复](/guide/local-drafts)。

## 图片和附件上传

适合先在本地验证工具栏上传、粘贴图片、拖拽图片、视频和文件附件入口。示例里的 `blob:` URL 只用于本地预览;生产环境应该由后端、OSS、COS、S3 或 CDN 返回可长期访问的 URL。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type UploadAsset,
  type UploadImage,
} from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

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

上传入口没反应时,先检查是否传入了 `uploadImage` / `uploadAsset`,返回 URL 是否可访问,以及文件类型或大小是否被 `accept` / `maxSize` 拦截。更多细节见 [图片上传](/guide/image-upload) 和 [视频、音频和文件上传](/guide/media-upload)。

## Element Plus

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorElementPlus,
  type EditorBehaviorOptions,
  type ToolbarConfig,
  type ToolbarOptions,
  type UploadAsset,
  type UploadImage,
} from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello element plus</p>')

const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'color', 'highlight'],
  ['link', 'image', 'attachment', 'table'],
  ['markdown', 'preview', 'fullscreen'],
]

const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: '默认字体', value: '' },
    { label: '苹方', value: 'PingFang SC' },
    { label: 'Inter', value: 'Inter' },
  ],
  fontSizes: ['', '14px', '16px', '20px', '28px'],
  lineHeights: ['', '1.5', '1.75', '2'],
  tableGrid: { maxRows: 12, maxCols: 12 },
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  link: { defaultTarget: '_self' },
  image: { accept: 'image/png,image/jpeg,image/webp', maxSize: 10 * 1024 * 1024, multiple: true, allowUrl: true },
  media: {
    video: { accept: 'video/mp4,video/webm', maxSize: 100 * 1024 * 1024, multiple: true },
    audio: { accept: 'audio/mpeg,audio/wav', maxSize: 30 * 1024 * 1024, multiple: true },
    file: {
      accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip',
      maxSize: 50 * 1024 * 1024,
      multiple: true,
      render: { showSize: true, showMimeType: true, showUploadedAt: true },
    },
  },
}

const uploadImage: UploadImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
}

const uploadAsset: UploadAsset = async (file, kind) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  const res = await fetch('/api/upload-asset', { method: 'POST', body: formData })
  return await res.json()
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :toolbar="toolbar"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
    :upload-image="uploadImage"
    :upload-asset="uploadAsset"
  />
</template>
```

## Naive UI

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  ProEditorNaive,
  type EditorBehaviorOptions,
  type ToolbarOptions,
} from 'tiptap-vue-pro-naive'
import 'tiptap-vue-pro-naive/style.css'

const content = ref('<p>hello naive ui</p>')

const toolbarOptions: ToolbarOptions = {
  colors: ['#111827', '#2563eb', '#16a34a', '#dc2626'],
  highlights: ['#fef3c7', '#dcfce7', '#dbeafe'],
  codeBlockLanguages: [
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
}

const editorBehaviorOptions: EditorBehaviorOptions = {
  table: { withHeaderRow: false },
}
</script>

<template>
  <ProEditorNaive
    v-model="content"
    :toolbar-options="toolbarOptions"
    :editor-behavior-options="editorBehaviorOptions"
  />
</template>
```

## Ant Design Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import 'tiptap-vue-pro-ant-design-vue/style.css'
import 'ant-design-vue/dist/reset.css'

const content = ref('<p>hello ant design vue</p>')
</script>

<template>
  <ProEditorAntDesignVue
    v-model="content"
    output="html"
    placeholder="请输入内容..."
  />
</template>
```

## Headless Core

```vue
<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor } from 'tiptap-vue-pro-core'

const ctx = useProEditor({
  content: '<p>hello Core</p>',
})
</script>

<template>
  <div>
    <button :class="{ active: ctx.isActive('bold') }" @click="ctx.commands.bold()">
      Bold
    </button>
    <button @click="ctx.commands.setImage('https://example.com/a.png')">
      Image
    </button>
    <EditorContent :editor="ctx.editor.value" />
  </div>
</template>
```
