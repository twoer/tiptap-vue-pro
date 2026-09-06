<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElDivider, ElTooltip } from 'element-plus'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Pencil, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import {
  getSelectedMathNode,
  resolveLocale,
  useEditorPluginRegistration,
  type ActiveMathNode,
  type LocaleKey,
  type ProEditorContext,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
}>()

const emit = defineEmits<{
  edit: [math: ActiveMathNode]
}>()

const rootEl = ref<HTMLElement | null>(null)
const selectionTick = ref(0)

const ctx = computed(() => props.ctx)
const fallbackT = resolveLocale().t
function t(key: LocaleKey, paramsOrFallback?: Record<string, string | number> | string) {
  return ctx.value.t?.(key, paramsOrFallback) ?? fallbackT(key, paramsOrFallback)
}

const selectedMath = computed(() => {
  void selectionTick.value
  const ed = props.editor
  return ed ? getSelectedMathNode(ed) : null
})

function getSelectedMathVirtualElement() {
  const ed = props.editor
  const math = ed ? getSelectedMathNode(ed) : null
  if (!ed || !math) return null
  const node = ed.view.nodeDOM(math.from) as HTMLElement | null
  if (!node) return null
  return {
    getBoundingClientRect: () => node.getBoundingClientRect(),
    getClientRects: () => [node.getBoundingClientRect()],
  }
}

function editMath() {
  const ed = props.editor
  if (!ed) return
  const math = getSelectedMathNode(ed)
  if (!math) return
  emit('edit', math)
}

function deleteMath() {
  const ed = props.editor
  if (!ed) return
  const math = getSelectedMathNode(ed)
  if (!math) return
  ed.chain().focus().deleteMath({ from: math.from }).run()
  selectionTick.value += 1
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proMathBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proMathBubbleMenu',
    editor: ed,
    element,
    updateDelay: 0,
    getReferencedVirtualElement: getSelectedMathVirtualElement,
    shouldShow: ({ editor }) => !!getSelectedMathNode(editor) && editor.isEditable,
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
  <div ref="rootEl" class="tvp-math-bubble" :data-math-kind="selectedMath?.kind">
    <ElTooltip :teleported="false" :content="t('math.action.edit')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('math.action.edit')" @click="editMath">
        <span class="tvp-math-bubble__item"><Pencil :size="16" aria-hidden="true" /><span class="tvp-math-bubble__text">{{ t('math.action.edit') }}</span></span>
      </ElButton>
    </ElTooltip>
    <ElDivider direction="vertical" />
    <ElTooltip :teleported="false" :content="t('math.action.delete')" placement="top" :show-after="300" :persistent="false">
      <ElButton text :aria-label="t('math.action.delete')" @click="deleteMath">
        <span class="tvp-math-bubble__item"><Trash2 :size="16" aria-hidden="true" /><span class="tvp-math-bubble__text">{{ t('math.action.delete') }}</span></span>
      </ElButton>
    </ElTooltip>
  </div>
</template>

<style scoped>
.tvp-math-bubble {
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

.tvp-math-bubble :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  margin-left: 0;
  padding: 0 8px;
  line-height: 1;
}

.tvp-math-bubble :deep(.el-button + .el-button) {
  margin-left: 0;
}

.tvp-math-bubble__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tvp-math-bubble__item svg {
  display: block;
  flex: 0 0 auto;
}

.tvp-math-bubble__text {
  font-size: 13px;
}

.tvp-math-bubble :deep(.el-button.is-text:not(.is-disabled):hover),
.tvp-math-bubble :deep(.el-button.is-text:not(.is-disabled):focus) {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.tvp-math-bubble :deep(.el-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--el-border-color-light, #e4e7ed);
}
</style>
