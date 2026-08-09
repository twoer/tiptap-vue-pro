<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { NButton, NDivider, NDropdown, NTooltip, type DropdownOption } from 'naive-ui'
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
  type CodeBlockLanguageIcon,
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

const currentLanguageLabel = computed(() => {
  const language = activeCodeBlock.value?.language
  return resolvedToolbarOptions.value.codeBlockLanguages.find((item) => item.value === language)?.label
    ?? codeBlockLanguageLabel(language)
})

const currentLanguageIcon = computed(() => codeBlockLanguageIcon(activeCodeBlock.value?.language))

type CodeBlockDropdownOption = DropdownOption & {
  languageIcon: CodeBlockLanguageIcon | null
}

const codeBlockOptions = computed<CodeBlockDropdownOption[]>(() => resolvedToolbarOptions.value.codeBlockLanguages.map((language) => ({
  label: language.label,
  key: language.value,
  languageIcon: codeBlockLanguageIcon(language.value),
})))
const CODE_BLOCK_DROPDOWN_THEME_OVERRIDES = {
  optionHeightMedium: '32px',
} as const
const CODE_BLOCK_DROPDOWN_MENU_PROPS = () => ({
  class: 'tvp-naive-code-language-dropdown',
  style: 'max-height: 328px; overscroll-behavior: contain;',
})

function renderCodeBlockLabel(opt: DropdownOption) {
  const languageIcon = (opt as CodeBlockDropdownOption).languageIcon
  const icon = languageIcon
    ? h('svg', {
        class: 'tvp-code-block-bubble__language-icon',
        viewBox: languageIcon.viewBox,
        'data-language-icon': String(opt.key),
        style: {
          display: 'block',
          width: '15px',
          height: '15px',
          flex: '0 0 auto',
        },
        'aria-hidden': 'true',
        focusable: 'false',
      }, languageIcon.parts.map((part) => h('path', {
        d: part.d,
        fill: part.fill,
        stroke: part.stroke,
      })))
    : h(Code, {
        size: 15,
        style: { display: 'block', flex: '0 0 auto' },
        'aria-hidden': 'true',
      })
  return h('span', {
    class: 'tvp-code-block-bubble__menu-item',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: '0',
      lineHeight: '1',
    },
  }, [
    icon,
    h('span', null, opt.label as string),
  ])
}

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

function setLanguage(key: string | number) {
  const ed = props.editor
  if (!ed || !currentCodeBlock()) return
  ed.chain().focus().updateAttributes('codeBlock', { language: String(key) }).run()
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
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <span class="tvp-tooltip-trigger">
          <NDropdown
            trigger="click"
            scrollable
            :z-index="2200"
            :options="codeBlockOptions"
            :render-label="renderCodeBlockLabel"
            :menu-props="CODE_BLOCK_DROPDOWN_MENU_PROPS"
            :theme-overrides="CODE_BLOCK_DROPDOWN_THEME_OVERRIDES"
            @select="setLanguage"
          >
            <NButton text class="tvp-code-block-bubble__language" :aria-label="t('codeBlock.language')">
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
            </NButton>
          </NDropdown>
        </span>
      </template>
      {{ t('codeBlock.language') }}
    </NTooltip>
    <NDivider vertical />
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="t('codeBlock.action.copy')" @click="copyCode">
          <Copy :size="16" />
        </NButton>
      </template>
      {{ t('codeBlock.action.copy') }}
    </NTooltip>
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
  color: var(--n-text-color-2, #333639);
  background: var(--n-popover-color, var(--n-color, #fff));
  border: 1px solid var(--n-border-color, #efeff5);
  border-radius: 6px;
  box-shadow: var(--n-box-shadow, 0 2px 12px rgba(0, 0, 0, 0.12));
}

.tvp-code-block-bubble :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  line-height: 1;
}

.tvp-tooltip-trigger {
  display: inline-flex;
  align-items: center;
}

.tvp-code-block-bubble :deep(svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-code-block-bubble__label {
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

.tvp-code-block-bubble :deep(.n-divider.n-divider--vertical) {
  margin: 0 4px;
}
</style>
