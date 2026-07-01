<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElCheckbox, ElDialog, ElDivider, ElInput, ElTooltip } from 'element-plus'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Copy, Download, ExternalLink, File, Pencil, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import {
  getSelectedMediaNode,
  mediaNodeToFileAttachmentAttrs,
  resolveEditorBehaviorOptions,
  resolveLocale,
  useEditorPluginRegistration,
  type ActiveMediaNode,
  type EditorBehaviorOptions,
  type ImageSizePreset,
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
const mediaName = ref('')
const poster = ref('')
const controls = ref(true)
const muted = ref(false)
const loop = ref(false)
const autoplay = ref(false)
const playsInline = ref(true)
const allowFullscreen = ref(true)
const allowDownload = ref(true)
const allowPictureInPicture = ref(true)

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

const selectedMedia = computed<ActiveMediaNode | null>(() => {
  void selectionTick.value
  const ed = props.editor
  return ed ? getSelectedMediaNode(ed) : null
})
const isVideo = computed(() => selectedMedia.value?.type === 'video')
const canDownload = computed(() => selectedMedia.value?.attrs.allowDownload !== false)

function currentMedia() {
  const ed = props.editor
  return ed ? getSelectedMediaNode(ed) : null
}

function getSelectedMediaVirtualElement() {
  const ed = props.editor
  const media = ed ? getSelectedMediaNode(ed) : null
  if (!ed || !media) return null
  const node = ed.view.nodeDOM(media.from) as HTMLElement | null
  if (!node) return null
  return {
    getBoundingClientRect: () => node.getBoundingClientRect(),
    getClientRects: () => [node.getBoundingClientRect()],
  }
}

function getMediaBubbleAppendTarget(ed: Editor) {
  return ed.view.dom.closest('.tvp-editor') as HTMLElement | null ?? document.body
}

function openEditDialog() {
  const media = currentMedia()
  if (!media) return
  const attrs = media.attrs
  mediaName.value = String(attrs.name || media.name)
  poster.value = String(attrs.poster ?? '')
  controls.value = attrs.controls !== false
  muted.value = attrs.muted === true
  loop.value = attrs.loop === true
  autoplay.value = attrs.autoplay === true
  playsInline.value = attrs.playsInline !== false
  allowFullscreen.value = attrs.allowFullscreen !== false
  allowDownload.value = attrs.allowDownload !== false
  allowPictureInPicture.value = attrs.allowPictureInPicture !== false
  editDialogVisible.value = true
}

function confirmEdit() {
  const ed = props.editor
  const media = currentMedia()
  if (!ed || !media) return
  const attrs: Record<string, unknown> = {
    name: mediaName.value.trim(),
    controls: controls.value,
    muted: muted.value,
    loop: loop.value,
    autoplay: autoplay.value,
    allowDownload: allowDownload.value,
  }
  if (media.type === 'video') {
    attrs.poster = poster.value.trim()
    attrs.playsInline = playsInline.value
    attrs.allowFullscreen = allowFullscreen.value
    attrs.allowPictureInPicture = allowPictureInPicture.value
  }
  ed.chain().focus().updateAttributes(media.type, attrs).run()
  selectionTick.value += 1
  editDialogVisible.value = false
}

function openMedia() {
  const media = currentMedia()
  if (!media) return
  window.open(media.src, '_blank', 'noopener,noreferrer')
}

function downloadMedia() {
  const media = currentMedia()
  if (!media || media.attrs.allowDownload === false) return
  const anchor = document.createElement('a')
  anchor.href = media.src
  anchor.download = media.name
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function setSize(preset: ImageSizePreset) {
  ctx.value.commands.setMediaSize(preset)
  selectionTick.value += 1
}

async function copyMediaUrl() {
  const media = currentMedia()
  if (!media) return
  const writeText = navigator.clipboard?.writeText
  if (!writeText) {
    ctx.value.notify(t('notify.clipboardUnavailable'), 'warning')
    return
  }
  await writeText.call(navigator.clipboard, media.src)
  notifyElementToolbarSuccess('notify.mediaCopied')
}

function switchToFile() {
  const ed = props.editor
  const media = currentMedia()
  if (!ed || !media) return
  ed.chain().focus().insertContentAt(
    { from: media.from, to: media.to },
    {
      type: 'fileAttachment',
      attrs: mediaNodeToFileAttachmentAttrs(media, resolvedEditorBehaviorOptions.value.media.file.render),
    },
  ).run()
}

function deleteMedia() {
  const ed = props.editor
  if (!ed || !currentMedia()) return
  ed.chain().focus().deleteSelection().run()
  notifyElementToolbarSuccess('notify.mediaDeleted')
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proMediaBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proMediaBubbleMenu',
    editor: ed,
    element,
    appendTo: () => getMediaBubbleAppendTarget(ed),
    updateDelay: 0,
    getReferencedVirtualElement: getSelectedMediaVirtualElement,
    options: {
      strategy: 'fixed',
      placement: 'top',
      offset: 8,
      flip: { padding: 8 },
      shift: { padding: 8 },
    },
    shouldShow: ({ editor }) => !!getSelectedMediaNode(editor),
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
  <div ref="rootEl" class="tvp-media-bubble">
    <ElTooltip :teleported="false" :content="t('image.size.smallTooltip')" placement="top" :show-after="300" :persistent="false">
      <ElButton text class="tvp-media-bubble__label" @click="setSize('small')">{{ t('image.size.small') }}</ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('image.size.mediumTooltip')" placement="top" :show-after="300" :persistent="false">
      <ElButton text class="tvp-media-bubble__label" @click="setSize('medium')">{{ t('image.size.medium') }}</ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('image.size.largeTooltip')" placement="top" :show-after="300" :persistent="false">
      <ElButton text class="tvp-media-bubble__label" @click="setSize('large')">{{ t('image.size.large') }}</ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('image.size.originalTooltip')" placement="top" :show-after="300" :persistent="false">
      <ElButton text class="tvp-media-bubble__label" @click="setSize('original')">{{ t('image.size.original') }}</ElButton>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('media.action.edit')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.edit')" @click="openEditDialog"><Pencil :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('media.action.open')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.open')" @click="openMedia"><ExternalLink :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" v-if="canDownload" :content="t('media.action.download')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.download')" @click="downloadMedia"><Download :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('media.action.copy')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.copy')" @click="copyMediaUrl"><Copy :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('media.action.asFile')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.asFile')" @click="switchToFile"><File :size="16" /></ElButton>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('media.action.delete')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('media.action.delete')" @click="deleteMedia"><Trash2 :size="16" /></ElButton>
    </ElTooltip>

    <ElDialog v-model="editDialogVisible" :title="t('media.dialogTitle')" width="460px" append-to-body :close-on-click-modal="true">
      <div class="tvp-media-form">
        <div class="tvp-media-form__row">
          <label class="tvp-media-form__label">{{ t('media.nameLabel') }}</label>
          <ElInput v-model="mediaName" clearable />
        </div>
        <div v-if="isVideo" class="tvp-media-form__row">
          <label class="tvp-media-form__label">{{ t('media.posterLabel') }}</label>
          <ElInput v-model="poster" clearable />
        </div>
        <div class="tvp-media-form__grid">
          <ElCheckbox v-model="controls">{{ t('media.controls') }}</ElCheckbox>
          <ElCheckbox v-model="muted">{{ t('media.muted') }}</ElCheckbox>
          <ElCheckbox v-model="loop">{{ t('media.loop') }}</ElCheckbox>
          <ElCheckbox v-model="autoplay">{{ t('media.autoplay') }}</ElCheckbox>
          <ElCheckbox v-if="isVideo" v-model="playsInline">{{ t('media.playsInline') }}</ElCheckbox>
          <ElCheckbox v-if="isVideo" v-model="allowFullscreen">{{ t('media.allowFullscreen') }}</ElCheckbox>
          <ElCheckbox v-model="allowDownload">{{ t('media.allowDownload') }}</ElCheckbox>
          <ElCheckbox v-if="isVideo" v-model="allowPictureInPicture">{{ t('media.allowPictureInPicture') }}</ElCheckbox>
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
.tvp-media-bubble {
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
}

.tvp-media-bubble :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
}

.tvp-media-bubble :deep(.el-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-media-bubble :deep(.el-button + .el-button) {
  margin-left: 0;
}

.tvp-media-bubble :deep(.el-button.tvp-media-bubble__label) {
  width: auto;
  min-width: 28px;
  padding: 0 8px;
  font-size: 12px;
}

.tvp-media-bubble :deep(.el-button.is-text:not(.is-disabled):hover),
.tvp-media-bubble :deep(.el-button.is-text:not(.is-disabled):focus) {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.tvp-media-bubble :deep(.el-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--el-border-color-light, #e4e7ed);
}

.tvp-media-form {
  display: grid;
  gap: 12px;
}

.tvp-media-form__row {
  display: grid;
  gap: 6px;
}

.tvp-media-form__label {
  font-size: 13px;
  line-height: 1.3;
  color: var(--el-text-color-regular, #606266);
}

.tvp-media-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
</style>
