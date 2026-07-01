<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCheckbox, NDivider, NInput, NModal, NTooltip } from 'naive-ui'
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
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text class="tvp-media-bubble__label" @click="setSize('small')">{{ t('image.size.small') }}</NButton></template>
      {{ t('image.size.smallTooltip') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text class="tvp-media-bubble__label" @click="setSize('medium')">{{ t('image.size.medium') }}</NButton></template>
      {{ t('image.size.mediumTooltip') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text class="tvp-media-bubble__label" @click="setSize('large')">{{ t('image.size.large') }}</NButton></template>
      {{ t('image.size.largeTooltip') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text class="tvp-media-bubble__label" @click="setSize('original')">{{ t('image.size.original') }}</NButton></template>
      {{ t('image.size.originalTooltip') }}
    </NTooltip>
    <NDivider vertical />
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('media.action.edit')" @click="openEditDialog"><Pencil :size="16" /></NButton></template>
      {{ t('media.action.edit') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('media.action.open')" @click="openMedia"><ExternalLink :size="16" /></NButton></template>
      {{ t('media.action.open') }}
    </NTooltip>
    <NTooltip v-if="canDownload" trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('media.action.download')" @click="downloadMedia"><Download :size="16" /></NButton></template>
      {{ t('media.action.download') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('media.action.copy')" @click="copyMediaUrl"><Copy :size="16" /></NButton></template>
      {{ t('media.action.copy') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('media.action.asFile')" @click="switchToFile"><File :size="16" /></NButton></template>
      {{ t('media.action.asFile') }}
    </NTooltip>
    <NDivider vertical />
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('media.action.delete')" @click="deleteMedia"><Trash2 :size="16" /></NButton></template>
      {{ t('media.action.delete') }}
    </NTooltip>

    <NModal v-model:show="editDialogVisible" preset="card" :title="t('media.dialogTitle')" style="width: 460px; max-width: 92vw;" :mask-closable="true">
      <div class="tvp-media-form">
        <div class="tvp-media-form__row">
          <label class="tvp-media-form__label">{{ t('media.nameLabel') }}</label>
          <NInput v-model:value="mediaName" clearable />
        </div>
        <div v-if="isVideo" class="tvp-media-form__row">
          <label class="tvp-media-form__label">{{ t('media.posterLabel') }}</label>
          <NInput v-model:value="poster" clearable />
        </div>
        <div class="tvp-media-form__grid">
          <NCheckbox v-model:checked="controls">{{ t('media.controls') }}</NCheckbox>
          <NCheckbox v-model:checked="muted">{{ t('media.muted') }}</NCheckbox>
          <NCheckbox v-model:checked="loop">{{ t('media.loop') }}</NCheckbox>
          <NCheckbox v-model:checked="autoplay">{{ t('media.autoplay') }}</NCheckbox>
          <NCheckbox v-if="isVideo" v-model:checked="playsInline">{{ t('media.playsInline') }}</NCheckbox>
          <NCheckbox v-if="isVideo" v-model:checked="allowFullscreen">{{ t('media.allowFullscreen') }}</NCheckbox>
          <NCheckbox v-model:checked="allowDownload">{{ t('media.allowDownload') }}</NCheckbox>
          <NCheckbox v-if="isVideo" v-model:checked="allowPictureInPicture">{{ t('media.allowPictureInPicture') }}</NCheckbox>
        </div>
      </div>
      <template #footer>
        <div class="tvp-media-form__footer">
          <NButton @click="editDialogVisible = false">{{ t('toolbar.action.cancel') }}</NButton>
          <NButton type="primary" @click="confirmEdit">{{ t('toolbar.action.confirm') }}</NButton>
        </div>
      </template>
    </NModal>
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
  background: var(--n-popover-color, var(--n-color, #fff));
  border: 1px solid var(--n-border-color, #efeff5);
  border-radius: 6px;
  box-shadow: var(--n-box-shadow, 0 2px 12px rgba(0, 0, 0, 0.12));
}

.tvp-media-bubble :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
}

.tvp-media-bubble :deep(.n-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-media-bubble :deep(.n-button.tvp-media-bubble__label) {
  width: auto;
  min-width: 28px;
  padding: 0 8px;
  font-size: 12px;
}

.tvp-media-bubble :deep(.n-button:hover),
.tvp-media-bubble :deep(.n-button:focus) {
  color: var(--n-primary-color, #18a058);
  background: var(--n-color-hover, rgba(24, 160, 88, 0.1));
}

.tvp-media-bubble :deep(.n-divider--vertical) {
  margin: 0 4px;
  height: 18px;
  width: 1px;
  background: var(--n-border-color, #efeff5);
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
  color: var(--n-text-color-2, #303133);
}

.tvp-media-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.tvp-media-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
