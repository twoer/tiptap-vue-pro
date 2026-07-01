<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElDivider, ElTooltip } from 'element-plus'
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
    <ElTooltip :teleported="false"
      v-for="variant in HORIZONTAL_RULE_VARIANTS"
      :key="variant"
      :content="label(variant)"
      placement="top"
      :show-after="300"
     :persistent="false">
      <ElButton
        text
        :aria-label="label(variant)"
        :type="selectedRule?.variant === variant ? 'primary' : 'default'"
        @click="setVariant(variant)"
      >
        <span class="tvp-hr-bubble__preview" :data-variant="variant" />
      </ElButton>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('hr.action.delete')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('hr.action.delete')" @click="deleteRule"><Trash2 :size="16" /></ElButton>
    </ElTooltip>
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
  background: var(--el-bg-color-overlay, var(--el-bg-color, #fff));
  border: 1px solid var(--el-border-color-light, var(--el-border-color, #dcdfe6));
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.12));
}

.tvp-hr-bubble :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  margin-left: 0;
  padding: 0;
  line-height: 1;
}

.tvp-hr-bubble :deep(.el-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-hr-bubble :deep(.el-button + .el-button) {
  margin-left: 0;
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

.tvp-hr-bubble :deep(.el-button.is-text:not(.is-disabled):hover),
.tvp-hr-bubble :deep(.el-button.is-text:not(.is-disabled):focus) {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.tvp-hr-bubble :deep(.el-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--el-border-color-light, #e4e7ed);
}
</style>
