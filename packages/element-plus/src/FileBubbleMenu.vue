<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElCheckbox, ElDialog, ElDivider, ElInput, ElTooltip } from 'element-plus'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Copy, Download, ExternalLink, Pencil, PlaySquare, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import {
  fileAttachmentToMediaNodeAttrs,
  getSelectedFileAttachment,
  resolveEditorBehaviorOptions,
  resolveLocale,
  useEditorPluginRegistration,
  type ActiveFileAttachment,
  type EditorBehaviorOptions,
  type LocaleKey,
  type ProEditorContext,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  editorBehaviorOptions?: EditorBehaviorOptions
}>()

const rootEl = ref<HTMLElement | null>(null)
const selectionTick = ref(0)
const editDialogVisible = ref(false)
const fileName = ref('')
const fileTypeText = ref('')
const showIcon = ref(true)
const showName = ref(true)
const showSize = ref(true)
const showMimeType = ref(false)
const showUploadedAt = ref(false)
const showDuration = ref(true)
const openInNewTab = ref(true)
const allowDownload = ref(true)

const ctx = computed(() => props.ctx)
const fallbackT = resolveLocale().t
const resolvedEditorBehaviorOptions = computed(() => resolveEditorBehaviorOptions(props.editorBehaviorOptions))
function t(key: LocaleKey, paramsOrFallback?: Record<string, string | number> | string) {
  return ctx.value.t?.(key, paramsOrFallback) ?? fallbackT(key, paramsOrFallback)
}

function notifyElementToolbarSuccess(key: LocaleKey) {
  if (resolvedEditorBehaviorOptions.value.feedback.elementToolbarSuccess) {
    ctx.value.notify(t(key), 'success')
  }
}

const selectedFile = computed<ActiveFileAttachment | null>(() => {
  void selectionTick.value
  const ed = props.editor
  return ed ? getSelectedFileAttachment(ed) : null
})
const canDownload = computed(() => selectedFile.value?.attrs.download !== false)
const canSwitchToPlayer = computed(() => {
  const kind = selectedFile.value?.attrs.mediaKind
  return kind === 'video' || kind === 'audio'
})

function currentFile() {
  const ed = props.editor
  return ed ? getSelectedFileAttachment(ed) : null
}

function getSelectedFileVirtualElement() {
  const ed = props.editor
  const file = ed ? getSelectedFileAttachment(ed) : null
  if (!ed || !file) return null
  const node = ed.view.nodeDOM(file.from) as HTMLElement | null
  const anchor = node?.classList.contains('tvp-file-attachment')
    ? node
    : node?.querySelector?.('.tvp-file-attachment') as HTMLElement | null
  if (!anchor) return null
  return {
    getBoundingClientRect: () => anchor.getBoundingClientRect(),
    getClientRects: () => [anchor.getBoundingClientRect()],
  }
}

function openEditDialog() {
  const file = currentFile()
  if (!file) return
  const attrs = file.attrs
  fileName.value = String(attrs.name || file.name)
  fileTypeText.value = String(attrs.fileTypeText ?? '')
  showIcon.value = attrs.showIcon !== false
  showName.value = attrs.showName !== false
  showSize.value = attrs.showSize !== false
  showMimeType.value = attrs.showMimeType === true
  showUploadedAt.value = attrs.showUploadedAt === true
  showDuration.value = attrs.showDuration !== false
  openInNewTab.value = attrs.openInNewTab !== false
  allowDownload.value = attrs.download !== false
  editDialogVisible.value = true
}

function confirmEdit() {
  const ed = props.editor
  if (!ed || !currentFile()) return
  ed.chain().focus().updateAttributes('fileAttachment', {
    name: fileName.value.trim(),
    fileTypeText: fileTypeText.value.trim(),
    showIcon: showIcon.value,
    showName: showName.value,
    showSize: showSize.value,
    showMimeType: showMimeType.value,
    showUploadedAt: showUploadedAt.value,
    showDuration: showDuration.value,
    openInNewTab: openInNewTab.value,
    download: allowDownload.value,
  }).run()
  selectionTick.value += 1
  editDialogVisible.value = false
}

function openFile() {
  const file = currentFile()
  if (!file) return
  window.open(file.href, file.attrs.openInNewTab === false ? '_self' : '_blank', 'noopener,noreferrer')
}

function downloadFile() {
  const file = currentFile()
  if (!file || file.attrs.download === false) return
  const anchor = document.createElement('a')
  anchor.href = file.href
  anchor.download = String(file.attrs.name || file.name)
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function switchToPlayer() {
  const ed = props.editor
  const file = currentFile()
  const kind = file?.attrs.mediaKind
  if (!ed || !file || (kind !== 'video' && kind !== 'audio')) return
  const render = kind === 'video'
    ? resolvedEditorBehaviorOptions.value.media.video.render
    : resolvedEditorBehaviorOptions.value.media.audio.render
  ed.chain().focus().insertContentAt(
    { from: file.from, to: file.to },
    {
      type: kind,
      attrs: fileAttachmentToMediaNodeAttrs(file.attrs, kind, render),
    },
  ).run()
}

async function copyFileUrl() {
  const file = currentFile()
  if (!file) return
  const writeText = navigator.clipboard?.writeText
  if (!writeText) {
    ctx.value.notify(t('notify.clipboardUnavailable'), 'warning')
    return
  }
  await writeText.call(navigator.clipboard, file.href)
  notifyElementToolbarSuccess('notify.fileCopied')
}

function deleteFile() {
  const ed = props.editor
  if (!ed || !currentFile()) return
  ed.chain().focus().deleteSelection().run()
  notifyElementToolbarSuccess('notify.fileDeleted')
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proFileBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proFileBubbleMenu',
    editor: ed,
    element,
    updateDelay: 0,
    getReferencedVirtualElement: getSelectedFileVirtualElement,
    shouldShow: ({ editor }) => !!getSelectedFileAttachment(editor),
  }),
  onRegistered: (ed) => {
    const selectionUpdateHandler = () => {
      selectionTick.value += 1
    }
    ed.on('selectionUpdate', selectionUpdateHandler)
    return () => ed.off('selectionUpdate', selectionUpdateHandler)
  },
})
</script>

<template>
  <div ref="rootEl" class="tvp-file-bubble">
    <ElTooltip :teleported="false" :content="t('file.action.edit')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('file.action.edit')" @click="openEditDialog">
        <Pencil :size="16" />
      </ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('file.action.open')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('file.action.open')" @click="openFile">
        <ExternalLink :size="16" />
      </ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" v-if="canDownload" :content="t('file.action.download')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('file.action.download')" @click="downloadFile">
        <Download :size="16" />
      </ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('file.action.copy')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('file.action.copy')" @click="copyFileUrl">
        <Copy :size="16" />
      </ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" v-if="canSwitchToPlayer" :content="t('media.action.asPlayer')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.asPlayer')" @click="switchToPlayer">
        <PlaySquare :size="16" />
      </ElButton>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('file.action.delete')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('file.action.delete')" @click="deleteFile">
        <Trash2 :size="16" />
      </ElButton>
    </ElTooltip>

    <ElDialog
      v-model="editDialogVisible"
      :title="t('file.dialogTitle')"
      width="460px"
      append-to-body
      :close-on-click-modal="true"
    >
      <div class="tvp-file-form">
        <div class="tvp-file-form__row">
          <label class="tvp-file-form__label">{{ t('file.nameLabel') }}</label>
          <ElInput v-model="fileName" clearable />
        </div>
        <div class="tvp-file-form__row">
          <label class="tvp-file-form__label">{{ t('file.typeLabel') }}</label>
          <ElInput v-model="fileTypeText" clearable />
        </div>
        <div class="tvp-file-form__grid">
          <ElCheckbox v-model="showIcon">{{ t('file.showIcon') }}</ElCheckbox>
          <ElCheckbox v-model="showName">{{ t('file.showName') }}</ElCheckbox>
          <ElCheckbox v-model="showSize">{{ t('file.showSize') }}</ElCheckbox>
          <ElCheckbox v-model="showMimeType">{{ t('file.showMimeType') }}</ElCheckbox>
          <ElCheckbox v-model="showUploadedAt">{{ t('file.showUploadedAt') }}</ElCheckbox>
          <ElCheckbox v-model="showDuration">{{ t('file.showDuration') }}</ElCheckbox>
          <ElCheckbox v-model="openInNewTab">{{ t('file.openInNewWindow') }}</ElCheckbox>
          <ElCheckbox v-model="allowDownload">{{ t('file.allowDownload') }}</ElCheckbox>
        </div>
      </div>
      <template #footer>
        <ElButton @click="editDialogVisible = false">{{ t('toolbar.action.cancel') }}</ElButton>
        <ElButton type="primary" @click="confirmEdit">{{ t('toolbar.action.confirm') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.tvp-file-bubble {
  display: inline-flex;
  visibility: hidden;
  align-items: center;
  gap: 2px;
  width: max-content;
  padding: 4px;
  background: var(--el-bg-color-overlay, var(--el-bg-color, #fff));
  border: 1px solid var(--el-border-color-light, var(--el-border-color, #dcdfe6));
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.12));
  color: var(--el-text-color-regular, #606266);
}

.tvp-file-bubble :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
  color: var(--el-text-color-regular, #606266);
}

.tvp-file-bubble :deep(.el-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-file-bubble :deep(.el-button.is-text:not(.is-disabled):hover),
.tvp-file-bubble :deep(.el-button.is-text:not(.is-disabled):focus) {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.tvp-file-bubble :deep(.el-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--el-border-color-light, #e4e7ed);
}

.tvp-file-form {
  display: grid;
  gap: 12px;
}

.tvp-file-form__row {
  display: grid;
  gap: 6px;
}

.tvp-file-form__label {
  font-size: 13px;
  line-height: 1.3;
  color: var(--el-text-color-regular, #606266);
}

.tvp-file-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
</style>
