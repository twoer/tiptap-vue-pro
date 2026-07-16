<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElCheckbox, ElDialog, ElDivider, ElInput, ElTooltip } from 'element-plus'
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
    <ElTooltip :teleported="false" :content="t('toolbar.link.edit')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('toolbar.link.edit')" @click="openEditDialog">
        <Pencil :size="16" />
      </ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('toolbar.link.open')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('toolbar.link.open')" @click="openLink">
        <ExternalLink :size="16" />
      </ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" :content="t('toolbar.link.copy')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('toolbar.link.copy')" @click="copyLink">
        <Copy :size="16" />
      </ElButton>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('toolbar.link.remove')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('toolbar.link.remove')" @click="removeLink">
        <Unlink :size="16" />
      </ElButton>
    </ElTooltip>

    <ElDialog
      v-model="editDialogVisible"
      :title="t('toolbar.link.dialogTitle')"
      width="440px"
      append-to-body
      :close-on-click-modal="true"
    >
      <div class="tvp-link-form">
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">{{ t('toolbar.link.textLabel') }}</label>
          <ElInput
            v-model="linkText"
            :placeholder="t('toolbar.link.textPlaceholder')"
            clearable
          />
        </div>
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">{{ t('toolbar.link.hrefLabel') }}</label>
          <ElInput
            v-model="linkUrl"
            placeholder="https://example.com"
            clearable
            @keyup.enter="confirmEdit"
          />
        </div>
        <div class="tvp-link-form__row tvp-link-form__row--check">
          <ElCheckbox v-model="linkNewTab">{{ t('toolbar.link.openInNewWindow') }}</ElCheckbox>
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
.tvp-link-bubble {
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

.tvp-link-bubble :deep(.el-button) {
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

.tvp-link-bubble :deep(.el-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-link-bubble :deep(.el-button + .el-button) {
  margin-left: 0;
}

.tvp-link-bubble :deep(.el-button.is-text:not(.is-disabled):hover),
.tvp-link-bubble :deep(.el-button.is-text:not(.is-disabled):focus) {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.tvp-link-bubble :deep(.el-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--el-border-color-light, #e4e7ed);
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
  color: var(--el-text-color-regular, #606266);
}

.tvp-link-form__row--check {
  margin-top: 2px;
}
</style>
