<script setup lang="ts">
import { computed, ref } from 'vue'
import { AntButton, AntDivider, AntTooltip } from './antDesignPrimitives'
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
    <AntTooltip
      v-for="variant in HORIZONTAL_RULE_VARIANTS"
      :key="variant"
      :content="label(variant)"
      placement="top"
      :show-after="300"
    >
      <AntButton
        text
        :aria-label="label(variant)"
        :type="selectedRule?.variant === variant ? 'primary' : 'default'"
        @click="setVariant(variant)"
      >
        <span class="tvp-hr-bubble__preview" :data-variant="variant" />
      </AntButton>
    </AntTooltip>
    <AntDivider direction="vertical" />
    <AntTooltip :content="t('hr.action.delete')" placement="top" :show-after="300">
      <AntButton text :aria-label="t('hr.action.delete')" @click="deleteRule"><Trash2 :size="16" /></AntButton>
    </AntTooltip>
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
  background: var(--tvp-ant-bg-color, #fff);
  border: 1px solid var(--tvp-ant-border-color-light, var(--tvp-ant-border-color, #dcdfe6));
  border-radius: 6px;
  box-shadow: var(--tvp-ant-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.12));
}

.tvp-hr-bubble :deep(.tvp-ant-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
}

.tvp-hr-bubble :deep(.tvp-ant-button svg) {
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

.tvp-hr-bubble :deep(.tvp-ant-button.is-text:hover),
.tvp-hr-bubble :deep(.tvp-ant-button.is-text:focus) {
  color: var(--tvp-ant-primary-color, #1677ff);
  background: var(--tvp-ant-primary-bg, #e6f4ff);
}

.tvp-hr-bubble :deep(.tvp-ant-divider--vertical) {
  margin: 0 4px;
  height: 18px;
  border-inline-start-color: var(--tvp-ant-border-color-light, #e4e7ed);
}
</style>
