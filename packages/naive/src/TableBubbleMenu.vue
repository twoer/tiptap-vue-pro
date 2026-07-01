<script setup lang="ts">
/**
 * Naive 适配的表格气泡菜单:光标进入表格单元格时,浮在表格上方的操作工具条。
 *
 * 常用操作(增删行列)一排按钮直达,低频操作(合并/拆分/
 * 表头/删除整表)收进「更多」下拉。复用 BubbleMenuPlugin 机制,独立 pluginKey
 * ('proTableBubble'),与文字气泡互斥(文字气泡 shouldShow 加 !inTable)。
 */
import { ref, onBeforeUnmount, computed, h, type VNode } from 'vue'
import { NButton, NDropdown } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import {
  Combine, Split,
  TableProperties, Trash2,
} from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { useEditorPluginRegistration, type ProEditorContext } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
}>()

const rootEl = ref<HTMLElement | null>(null)
const moreMenuShow = ref(false)
let destructiveTimer: number | null = null
const RUN_AFTER_POPPER_CLOSE_MS = 240

type TableOp =
  | 'mergeCells' | 'splitCell'
  | 'toggleHeaderRow' | 'toggleHeaderColumn'
  | 'deleteTable'

// 更多操作下拉:只剩表头/删除整表(始终可用)。合并/拆分改成按需出现的独立按钮。
const moreOpIcons: Partial<Record<TableOp, any>> = {
  toggleHeaderRow: TableProperties,
  toggleHeaderColumn: TableProperties,
  deleteTable: Trash2,
}
const moreOptions: DropdownOption[] = [
  { key: 'toggleHeaderRow', label: '首行为表头' },
  { key: 'toggleHeaderColumn', label: '首列为表头' },
  { key: 'deleteTable', label: '删除表格' },
]
// 合并/拆分的可用性(驱动独立按钮的按需出现)
const tableState = computed(() => props.ctx.tableState.value)
function renderMoreLabel(opt: DropdownOption): VNode {
  const op = opt.key as TableOp
  // 下拉项只有表头/删除,图标都在 moreOpIcons 里;fallback 用 TableProperties 兜类型防御
  const Icon = moreOpIcons[op] ?? TableProperties
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;line-height:1;vertical-align:middle;' }, [
    h(Icon, { size: 15, style: 'display:block;flex:0 0 auto;' }),
    opt.label as string,
  ])
}
function clearDestructiveTimer() {
  if (destructiveTimer != null) {
    window.clearTimeout(destructiveTimer)
    destructiveTimer = null
  }
}

function onMoreSelect(key: string | number) {
  const op = key as TableOp
  moreMenuShow.value = false
  if (op === 'deleteTable') {
    clearDestructiveTimer()
    destructiveTimer = window.setTimeout(() => {
      props.ctx.commands.deleteTable()
      destructiveTimer = null
    }, RUN_AFTER_POPPER_CLOSE_MS)
    return
  }
  props.ctx.commands[op]()
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proTableBubble',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proTableBubble',
    editor: ed,
    element,
    updateDelay: 100,
    shouldShow: ({ state }) => {
      // 选区菜单:只在「选中多格可合并」或「光标在合并格可拆分」时浮现。
      // 增删行列交给飞书式抓手(TableGripHandles)。与 core tableState 判定一致。
      const sel = state.selection
      const cellAt = ($r: { depth: number; node: (d: number) => unknown }): { attrs: { colspan?: number; rowspan?: number } } | null => {
        for (let d = $r.depth; d > 0; d--) {
          const node = $r.node(d) as { type: { name: string }; attrs: { colspan?: number; rowspan?: number } }
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') return node
        }
        return null
      }
      const fromCell = cellAt(sel.$from)
      const toCell = cellAt(sel.$to)
      const canMerge = !!fromCell && !!toCell && fromCell !== toCell
      const attrs = fromCell?.attrs ?? { colspan: 1, rowspan: 1 }
      const canSplit = (attrs.colspan ?? 1) > 1 || (attrs.rowspan ?? 1) > 1
      return canMerge || canSplit
    },
  }),
})

onBeforeUnmount(() => {
  clearDestructiveTimer()
})
</script>

<template>
  <div ref="rootEl" class="tvp-table-bubble">
    <!-- 选区菜单:选中多格/合并格时浮现。增删行列交给抓手 -->
    <NButton v-if="tableState.canMerge" text title="合并单元格" @click="ctx.commands.mergeCells()"><Combine :size="15" /></NButton>
    <NButton v-if="tableState.canSplit" text title="拆分单元格" @click="ctx.commands.splitCell()"><Split :size="15" /></NButton>

    <span v-if="tableState.canMerge || tableState.canSplit" class="tvp-table-bubble__sep" />

    <!-- 低频操作:表头/删除整表(始终可用,收进下拉)-->
    <NDropdown
      trigger="click"
      v-model:show="moreMenuShow"
      :options="moreOptions"
      :render-label="renderMoreLabel"
      @select="onMoreSelect"
    >
      <NButton text><TableProperties :size="15" /></NButton>
    </NDropdown>
  </div>
</template>

<style scoped>
.tvp-table-bubble {
  /* 默认隐藏,由 BubbleMenuPlugin 通过 inline style 接管显隐。用 display:flex 默认
     显示且无定位时,插件未接管会裸露在文档流里成「固定操作栏」。文字气泡同款兜底。 */
  display: none;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--n-color, #fff);
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

/*
 * 图标按钮统一正方形击中区(与顶部工具栏 .tvp-icon-btn: 32×32 padding:0 对齐)。
 * 用 :deep() 命中 NButton 渲染出的 .n-button,保证气泡内外视觉一致。
 */
.tvp-table-bubble :deep(.n-button) {
  width: 32px;
  height: 32px;
  padding: 0;
}

.tvp-table-bubble__sep {
  display: inline-block;
  width: 1px;
  height: 16px;
  /* margin 与工具栏 .tvp-divider 对齐(0 4px) */
  margin: 0 4px;
  background: var(--n-border-color, #dcdfe6);
}
</style>
