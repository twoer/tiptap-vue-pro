<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCheckbox, NDivider, NInput, NModal, NTooltip } from 'naive-ui'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Copy, ExternalLink, Pencil, Unlink } from 'lucide-vue-next'
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import {
  getActiveLinkRange,
  resolveEditorBehaviorOptions,
  resolveLocale,
  useEditorPluginRegistration,
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
const linkUrl = ref('')
const linkText = ref('')
const linkNewTab = ref(true)
const savedRange = ref<{ from: number; to: number } | null>(null)

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

function isInsideTable(ed: CoreEditor) {
  const { $from } = ed.state.selection
  for (let d = $from.depth; d > 0; d -= 1) {
    const name = $from.node(d).type.name
    if (name === 'tableCell' || name === 'tableHeader') return true
  }
  return false
}

function currentLink() {
  const ed = props.editor
  return ed ? getActiveLinkRange(ed) : null
}

function openEditDialog() {
  const link = currentLink()
  if (!link) return
  savedRange.value = { from: link.from, to: link.to }
  linkUrl.value = link.href
  linkText.value = link.text
  linkNewTab.value = link.target
    ? link.target === '_blank'
    : resolvedEditorBehaviorOptions.value.link.defaultTarget === '_blank'
  editDialogVisible.value = true
}

function isSupportedLinkUrl(href: string) {
  return /^(https?:|mailto:|tel:)/i.test(href) || /\.[a-z]{2,}/i.test(href)
}

function confirmEdit() {
  const range = savedRange.value
  if (!range) return

  const href = linkUrl.value.trim()
  const text = linkText.value.trim()
  const target = linkNewTab.value ? '_blank' : '_self'

  if (!href) {
    ctx.value.commands.setLink('', { target, range })
    notifyElementToolbarSuccess('notify.linkRemoved')
    editDialogVisible.value = false
    return
  }

  if (!isSupportedLinkUrl(href)) {
    ctx.value.notify(t('notify.linkInvalid'), 'warning')
    return
  }

  if (text) {
    ctx.value.commands.insertLinkText(href, text, { target, range })
  } else {
    ctx.value.commands.setLink(href, { target, range })
  }
  editDialogVisible.value = false
}

function openLink() {
  const link = currentLink()
  if (!link) return
  window.open(link.href, link.target === '_self' ? '_self' : '_blank', 'noopener,noreferrer')
}

async function copyLink() {
  const link = currentLink()
  if (!link) return
  const writeText = navigator.clipboard?.writeText
  if (!writeText) {
    ctx.value.notify(t('notify.clipboardUnavailable'), 'warning')
    return
  }
  await writeText.call(navigator.clipboard, link.href)
  notifyElementToolbarSuccess('notify.linkCopied')
}

function removeLink() {
  const link = currentLink()
  if (!link) return
  ctx.value.commands.setLink('', { range: { from: link.from, to: link.to } })
  notifyElementToolbarSuccess('notify.linkRemoved')
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proLinkBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proLinkBubbleMenu',
    editor: ed,
    element,
    updateDelay: 100,
    shouldShow: ({ editor }) => {
      if (isInsideTable(editor)) return false
      return !!getActiveLinkRange(editor)
    },
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
  <div ref="rootEl" class="tvp-link-bubble">
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="t('toolbar.link.edit')" @click="openEditDialog">
          <Pencil :size="16" />
        </NButton>
      </template>
      {{ t('toolbar.link.edit') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="t('toolbar.link.open')" @click="openLink">
          <ExternalLink :size="16" />
        </NButton>
      </template>
      {{ t('toolbar.link.open') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="t('toolbar.link.copy')" @click="copyLink">
          <Copy :size="16" />
        </NButton>
      </template>
      {{ t('toolbar.link.copy') }}
    </NTooltip>
    <NDivider vertical />
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="t('toolbar.link.remove')" @click="removeLink">
          <Unlink :size="16" />
        </NButton>
      </template>
      {{ t('toolbar.link.remove') }}
    </NTooltip>

    <NModal
      v-model:show="editDialogVisible"
      preset="card"
      :title="t('toolbar.link.dialogTitle')"
      style="width: 460px; max-width: 92vw;"
      :mask-closable="true"
    >
      <div class="tvp-link-form">
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">{{ t('toolbar.link.textLabel') }}</label>
          <NInput
            v-model:value="linkText"
            :placeholder="t('toolbar.link.textPlaceholder')"
            clearable
          />
        </div>
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">{{ t('toolbar.link.hrefLabel') }}</label>
          <NInput
            v-model:value="linkUrl"
            placeholder="https://example.com"
            clearable
            @keyup.enter="confirmEdit"
          />
        </div>
        <div class="tvp-link-form__row tvp-link-form__row--check">
          <NCheckbox v-model:checked="linkNewTab">{{ t('toolbar.link.openInNewWindow') }}</NCheckbox>
        </div>
      </div>
      <template #footer>
        <div class="tvp-link-form__footer">
          <NButton @click="editDialogVisible = false">{{ t('toolbar.action.cancel') }}</NButton>
          <NButton type="primary" @click="confirmEdit">{{ t('toolbar.action.confirm') }}</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.tvp-link-bubble {
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
  color: var(--n-text-color-2, #303133);
}

.tvp-link-bubble :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
  color: var(--n-text-color-2, #303133);
}

.tvp-link-bubble :deep(.n-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-link-bubble :deep(.n-button:hover),
.tvp-link-bubble :deep(.n-button:focus) {
  color: var(--n-primary-color, #18a058);
  background: var(--n-color-hover, rgba(24, 160, 88, 0.1));
}

.tvp-link-bubble :deep(.n-divider--vertical) {
  margin: 0 4px;
  height: 18px;
  width: 1px;
  background: var(--n-border-color, #efeff5);
}

.tvp-link-form {
  display: grid;
  gap: 12px;
}

.tvp-link-form__row {
  display: grid;
  gap: 6px;
}

.tvp-link-form__label {
  font-size: 13px;
  line-height: 1.3;
  color: var(--n-text-color-2, #303133);
}

.tvp-link-form__row--check {
  margin-top: 2px;
}

.tvp-link-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
