<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NDivider, NTooltip } from 'naive-ui'
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
    <NTooltip placement="top" :show-arrow="false">
      <template #trigger>
        <NButton text size="small" :aria-label="t('math.action.edit')" @click="editMath">
          <span class="tvp-math-bubble__item"><Pencil :size="16" aria-hidden="true" /><span class="tvp-math-bubble__text">{{ t('math.action.edit') }}</span></span>
        </NButton>
      </template>
      {{ t('math.action.edit') }}
    </NTooltip>
    <NDivider vertical />
    <NTooltip placement="top" :show-arrow="false">
      <template #trigger>
        <NButton text size="small" :aria-label="t('math.action.delete')" @click="deleteMath">
          <span class="tvp-math-bubble__item"><Trash2 :size="16" aria-hidden="true" /><span class="tvp-math-bubble__text">{{ t('math.action.delete') }}</span></span>
        </NButton>
      </template>
      {{ t('math.action.delete') }}
    </NTooltip>
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
  background: #fff;
  border: 1px solid rgba(231, 231, 236, 0.9);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.tvp-math-bubble :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
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

.tvp-math-bubble :deep(.n-divider--vertical) {
  margin: 0 4px;
}
</style>
