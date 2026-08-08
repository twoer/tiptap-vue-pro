<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElDivider, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Code, Copy } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import {
  codeBlockLanguageLabel,
  codeBlockLanguageIcon,
  getActiveCodeBlock,
  resolveEditorBehaviorOptions,
  resolveLocale,
  resolveToolbarOptions,
  useEditorPluginRegistration,
  type EditorBehaviorOptions,
  type LocaleKey,
  type ProEditorContext,
  type ToolbarOptions,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  toolbarOptions?: ToolbarOptions
  editorBehaviorOptions?: EditorBehaviorOptions
}>()

const rootEl = ref<HTMLElement | null>(null)
const selectionTick = ref(0)

const ctx = computed(() => props.ctx)
const fallbackT = resolveLocale().t
const resolvedToolbarOptions = computed(() => resolveToolbarOptions(props.toolbarOptions))
const resolvedEditorBehaviorOptions = computed(() => resolveEditorBehaviorOptions(props.editorBehaviorOptions))

function t(key: LocaleKey, paramsOrFallback?: Record<string, string | number> | string) {
  return ctx.value.t?.(key, paramsOrFallback) ?? fallbackT(key, paramsOrFallback)
}

const activeCodeBlock = computed(() => {
  void selectionTick.value
  const ed = props.editor
  return ed ? getActiveCodeBlock(ed) : null
})

const codeBlockLanguages = computed(() => resolvedToolbarOptions.value.codeBlockLanguages.map((language) => ({
  ...language,
  icon: codeBlockLanguageIcon(language.value),
})))

const currentLanguageLabel = computed(() => {
  const language = activeCodeBlock.value?.language
  return codeBlockLanguages.value.find((item) => item.value === language)?.label
    ?? codeBlockLanguageLabel(language)
})

const currentLanguageIcon = computed(() => codeBlockLanguageIcon(activeCodeBlock.value?.language))

function currentCodeBlock() {
  const ed = props.editor
  return ed ? getActiveCodeBlock(ed) : null
}

function getActiveCodeBlockVirtualElement() {
  const ed = props.editor
  const block = ed ? getActiveCodeBlock(ed) : null
  if (!ed || !block) return null
  const node = ed.view.nodeDOM(block.from) as HTMLElement | null
  const anchor = node?.matches('pre')
    ? node
    : (node?.closest?.('pre') ?? node?.querySelector?.('pre')) as HTMLElement | null
  if (!anchor) return null
  return {
    getBoundingClientRect: () => anchor.getBoundingClientRect(),
    getClientRects: () => [anchor.getBoundingClientRect()],
  }
}

function setLanguage(language: string) {
  const ed = props.editor
  if (!ed || !currentCodeBlock()) return
  ed.chain().focus().updateAttributes('codeBlock', { language }).run()
  selectionTick.value += 1
}

async function copyCode() {
  const block = currentCodeBlock()
  if (!block) return
  const writeText = navigator.clipboard?.writeText
  if (!writeText) {
    ctx.value.notify(t('notify.clipboardUnavailable'), 'warning')
    return
  }
  await writeText.call(navigator.clipboard, block.text)
  if (resolvedEditorBehaviorOptions.value.feedback.elementToolbarSuccess) {
    ctx.value.notify(t('notify.codeBlockCopied'), 'success')
  }
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proCodeBlockBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proCodeBlockBubbleMenu',
    editor: ed,
    element,
    updateDelay: 0,
    getReferencedVirtualElement: getActiveCodeBlockVirtualElement,
    shouldShow: ({ editor }) => !!getActiveCodeBlock(editor),
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
  <div ref="rootEl" class="tvp-code-block-bubble">
    <ElTooltip :teleported="false" :content="t('codeBlock.language')" placement="top" :show-after="300" :persistent="false">
      <ElDropdown trigger="click" popper-class="tvp-el-action-dropdown tvp-el-code-language-dropdown" @command="setLanguage">
        <ElButton text class="tvp-code-block-bubble__language" :aria-label="t('codeBlock.language')">
          <span class="tvp-code-block-bubble__label">
            <svg
              v-if="currentLanguageIcon"
              class="tvp-code-block-bubble__language-icon"
              :viewBox="currentLanguageIcon.viewBox"
              :data-language-icon="activeCodeBlock?.language"
              aria-hidden="true"
              focusable="false"
            >
              <path
                v-for="part in currentLanguageIcon.parts"
                :key="part.d"
                :d="part.d"
                :fill="part.fill"
                :stroke="part.stroke"
              />
            </svg>
            <Code v-else :size="16" aria-hidden="true" />
            <span>{{ currentLanguageLabel }}</span>
          </span>
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem
              v-for="language in codeBlockLanguages"
              :key="language.value"
              :command="language.value"
            >
              <span class="tvp-menu-item tvp-code-block-bubble__menu-item">
                <svg
                  v-if="language.icon"
                  class="tvp-code-block-bubble__language-icon"
                  :viewBox="language.icon.viewBox"
                  :data-language-icon="language.value"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    v-for="part in language.icon.parts"
                    :key="part.d"
                    :d="part.d"
                    :fill="part.fill"
                    :stroke="part.stroke"
                  />
                </svg>
                <Code v-else :size="15" aria-hidden="true" />
                <span>{{ language.label }}</span>
              </span>
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('codeBlock.action.copy')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('codeBlock.action.copy')" @click="copyCode">
        <Copy :size="16" />
      </ElButton>
    </ElTooltip>
  </div>
</template>

<style scoped>
.tvp-code-block-bubble {
  display: inline-flex;
  visibility: hidden;
  align-items: center;
  gap: 2px;
  width: max-content;
  padding: 4px;
  color: var(--el-text-color-regular, #606266);
  background: var(--el-bg-color-overlay, var(--el-bg-color, #fff));
  border: 1px solid var(--el-border-color-light, var(--el-border-color, #dcdfe6));
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.12));
}

.tvp-code-block-bubble :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  margin-left: 0;
  padding: 0 8px;
  line-height: 1;
}

.tvp-code-block-bubble :deep(.el-button + .el-button) {
  margin-left: 0;
}

.tvp-code-block-bubble :deep(svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-code-block-bubble__label,
.tvp-code-block-bubble__menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  line-height: 1;
}

.tvp-code-block-bubble__label > span {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tvp-code-block-bubble__language-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.tvp-code-block-bubble__menu-item .tvp-code-block-bubble__language-icon {
  width: 15px;
  height: 15px;
}

:global(.tvp-el-code-language-dropdown .el-dropdown-menu) {
  max-height: 328px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

:global(.tvp-el-code-language-dropdown) {
  z-index: 2200 !important;
}

.tvp-code-block-bubble :deep(.el-button.is-text:not(.is-disabled):hover),
.tvp-code-block-bubble :deep(.el-button.is-text:not(.is-disabled):focus) {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.tvp-code-block-bubble :deep(.el-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--el-border-color-light, #e4e7ed);
}
</style>
