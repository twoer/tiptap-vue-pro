<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NDivider, NTooltip } from 'naive-ui'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import {
  getSelectedHorizontalRule,
  HORIZONTAL_RULE_VARIANTS,
  resolveLocale,
  useEditorPluginRegistration,
  type HorizontalRuleVariant,
  type LocaleKey,
  type ProEditorContext,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
}>()

const rootEl = ref<HTMLElement | null>(null)
const selectionTick = ref(0)

const ctx = computed(() => props.ctx)
const fallbackT = resolveLocale().t
function t(key: LocaleKey, paramsOrFallback?: Record<string, string | number> | string) {
  return ctx.value.t?.(key, paramsOrFallback) ?? fallbackT(key, paramsOrFallback)
}

const selectedRule = computed(() => {
  void selectionTick.value
  const ed = props.editor
  return ed ? getSelectedHorizontalRule(ed) : null
})

function label(variant: HorizontalRuleVariant) {
  return t(`toolbar.hr.${variant}` as LocaleKey)
}

function getSelectedRuleVirtualElement() {
  const ed = props.editor
  const rule = ed ? getSelectedHorizontalRule(ed) : null
  if (!ed || !rule) return null
  const node = ed.view.nodeDOM(rule.from) as HTMLElement | null
  if (!node) return null
  return {
    getBoundingClientRect: () => node.getBoundingClientRect(),
    getClientRects: () => [node.getBoundingClientRect()],
  }
}

function setVariant(variant: HorizontalRuleVariant) {
  const ed = props.editor
  if (!ed || !getSelectedHorizontalRule(ed)) return
  ed.chain().focus().updateAttributes('horizontalRule', { variant }).run()
  selectionTick.value += 1
}

function deleteRule() {
  const ed = props.editor
  if (!ed || !getSelectedHorizontalRule(ed)) return
  ed.chain().focus().deleteSelection().run()
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proHorizontalRuleBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proHorizontalRuleBubbleMenu',
    editor: ed,
    element,
    updateDelay: 0,
    getReferencedVirtualElement: getSelectedRuleVirtualElement,
    shouldShow: ({ editor }) => !!getSelectedHorizontalRule(editor),
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
  <div ref="rootEl" class="tvp-hr-bubble">
    <NTooltip
      v-for="variant in HORIZONTAL_RULE_VARIANTS"
      :key="variant"
      trigger="hover"
      placement="top"
    >
      <template #trigger>
        <NButton
          text
          :aria-label="label(variant)"
          :type="selectedRule?.variant === variant ? 'primary' : 'default'"
          @click="setVariant(variant)"
        >
          <span class="tvp-hr-bubble__preview" :data-variant="variant" />
        </NButton>
      </template>
      {{ label(variant) }}
    </NTooltip>
    <NDivider vertical />
    <NTooltip trigger="hover" placement="top">
      <template #trigger><NButton text :aria-label="t('hr.action.delete')" @click="deleteRule"><Trash2 :size="16" /></NButton></template>
      {{ t('hr.action.delete') }}
    </NTooltip>
  </div>
</template>

<style scoped>
.tvp-hr-bubble {
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

.tvp-hr-bubble :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
}

.tvp-hr-bubble :deep(.n-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-hr-bubble__preview {
  display: block;
  width: 16px;
  border-top: 1px solid currentColor;
}

.tvp-hr-bubble__preview[data-variant='thick'] {
  border-top-width: 3px;
}

.tvp-hr-bubble__preview[data-variant='dashed'] {
  border-top-style: dashed;
}

.tvp-hr-bubble__preview[data-variant='dotted'] {
  border-top-style: dotted;
}

.tvp-hr-bubble :deep(.n-button:hover),
.tvp-hr-bubble :deep(.n-button:focus) {
  color: var(--n-primary-color, #18a058);
  background: var(--n-color-hover, rgba(24, 160, 88, 0.1));
}

.tvp-hr-bubble :deep(.n-divider--vertical) {
  margin: 0 4px;
  height: 18px;
  width: 1px;
  background: var(--n-border-color, #efeff5);
}
</style>
