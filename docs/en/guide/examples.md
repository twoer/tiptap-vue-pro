# Examples

This page provides minimal business integration examples you can copy directly. The three adapters share the same props; the main differences are component names, style entries, and UI library dependencies.

::: tip Start from a business scenario
If you are integrating a real admin workflow, start with [Business Recipes](/en/guide/recipes/). They are split by article forms, autosave, uploads, and readonly preview so you do not have to scan one long examples page first.
:::

## Business scenario entry points

- [Admin Rich Text Form](/en/guide/recipes/business-editor-form)
- [Autosave + Local Drafts](/en/guide/recipes/autosave-drafts)
- [Image, Video, and Attachment Uploads](/en/guide/recipes/uploads)
- [Readonly Preview and Detail Pages](/en/guide/recipes/readonly-preview)

## Admin Form Editor

Use this for article editors, announcements, product descriptions, help-center entries, and other admin forms. The example uses Element Plus form components to host the editor and submits the title and rich text content together.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const title = ref('Product update')
const content = ref('<p>Write the announcement body here.</p>')
const saving = ref(false)

async function submitArticle() {
  saving.value = true

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 300))
    console.info('submit article', {
      title: title.value,
      content: content.value,
    })
    ElMessage.success('Saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="Title">
      <el-input v-model="title" placeholder="Enter a title" />
    </el-form-item>

    <el-form-item label="Body">
      <ProEditorElementPlus
        v-model="content"
        toolbar-layout="compact"
        placeholder="Write the body..."
      />
    </el-form-item>

    <el-button type="primary" :loading="saving" @click="submitArticle">
      Save
    </el-button>
  </el-form>
</template>
```

Naive UI and Ant Design Vue integrate the same way. Replace the component name, style entry, and UI form components.

## Knowledge Base Editor

Use this for internal knowledge bases, help docs, long articles, and editors where losing work is expensive. The example enables both remote autosave and local draft recovery: remote autosave remains the business source of truth, while local drafts only cover refreshes, tab closes, or browser crashes before the latest remote save succeeds.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const documentId = ref('kb-getting-started')
const content = ref('<h2>Getting Started</h2><p>Maintain the knowledge-base body here.</p>')

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

See [Autosave](/en/guide/autosave) and [Local Draft Recovery](/en/guide/local-drafts) for behavior details.

## Image And Attachment Upload

Use this to verify toolbar upload, pasted images, dropped images, video, and file attachment entries locally. The `blob:` URLs in this example are for local preview only; production uploads should return persistent URLs from your backend, OSS, COS, S3, or CDN.

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

If upload entries do nothing, first check whether `uploadImage` / `uploadAsset` is passed, whether the returned URL is accessible, and whether the file type or size was blocked by `accept` / `maxSize`. See [Image Upload](/en/guide/image-upload) and [Video, Audio, and File Upload](/en/guide/media-upload) for details.

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
    { label: 'Default', value: '' },
    { label: 'PingFang', value: 'PingFang SC' },
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
    placeholder="Write something..."
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
