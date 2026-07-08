<script setup lang="ts">
/**
 * Naive 适配的表格气泡菜单:光标进入表格单元格时,浮在表格上方的操作工具条。
 *
 * 常用操作(增删行列)交给表格抓手,这里按 selectedCell 自定位显示
 * 合并/拆分/表头/删除整表等选区相关操作。
 */
import { ref, onBeforeUnmount, computed, h, type CSSProperties, type VNode } from 'vue'
import { NButton, NDropdown } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import {
  Combine, Split,
  TableProperties, Trash2,
} from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  /** 抓手下拉菜单打开时临时隐藏,避免两个表格菜单叠在一起 */
  suppress?: boolean
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
const bubbleVisible = computed(() => !props.suppress && (tableState.value.canMerge || tableState.value.canSplit))
const bubbleStyle = computed(() => getTableBubbleStyle(props.editor, bubbleVisible.value))
function renderMoreLabel(opt: DropdownOption): VNode {
  const op = opt.key as TableOp
  // 下拉项只有表头/删除,图标都在 moreOpIcons 里;fallback 用 TableProperties 兜类型防御
  const Icon = moreOpIcons[op] ?? TableProperties
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;line-height:1;vertical-align:middle;' }, [
    h(Icon, { size: 15, style: 'display:block;flex:0 0 auto;' }),
    opt.label as string,
  ])
}

function getTableBubbleStyle(ed: Editor | undefined, visible: boolean): CSSProperties | undefined {
  if (!ed?.view?.dom || !visible) return undefined
  const selectedCells = Array.from(ed.view.dom.querySelectorAll('td.selectedCell, th.selectedCell')) as HTMLElement[]
  let rect: { left: number; right: number; top: number }
  if (selectedCells.length) {
    const rects = selectedCells.map((cell) => cell.getBoundingClientRect())
    rect = {
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
      top: Math.min(...rects.map((r) => r.top)),
    }
  } else {
    const cursor = ed.view.coordsAtPos(ed.state.selection.from)
    rect = { left: cursor.left, right: cursor.right, top: cursor.top }
  }
  return {
    display: 'flex',
    position: 'fixed',
    left: `${(rect.left + rect.right) / 2}px`,
    top: `${Math.max(8, rect.top - 42)}px`,
    transform: 'translateX(-50%)',
  }
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

onBeforeUnmount(() => {
  clearDestructiveTimer()
})
</script>

<template>
  <div ref="rootEl" class="tvp-table-bubble" :style="bubbleStyle">
    <!-- 选区菜单:选中多格/合并格时浮现。增删行列交给抓手 -->
    <NButton v-if="bubbleVisible && tableState.canMerge" text title="合并单元格" @click="ctx.commands.mergeCells()"><Combine :size="15" /></NButton>
    <NButton v-if="bubbleVisible && tableState.canSplit" text title="拆分单元格" @click="ctx.commands.splitCell()"><Split :size="15" /></NButton>

    <span v-if="bubbleVisible" class="tvp-table-bubble__sep" />

    <!-- 低频操作:表头/删除整表(始终可用,收进下拉)-->
    <NDropdown
      class="tvp-table-bubble-dropdown"
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
  /* 默认隐藏;选中多格或合并格时由 bubbleStyle 设置 display:flex 和 fixed 定位。 */
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

:global(.tvp-table-bubble-dropdown.n-dropdown-menu),
:global(.tvp-table-bubble-dropdown .n-dropdown-menu) {
  min-width: 168px;
  padding: 6px 0;
}

:global(.tvp-table-bubble-dropdown .n-dropdown-option) {
  height: 50px;
  min-height: 50px;
}

:global(.tvp-table-bubble-dropdown .n-dropdown-option-body) {
  min-height: 50px;
  padding: 0 20px;
  font-size: 14px;
  line-height: 22px;
}

:global(.tvp-table-bubble-dropdown .n-dropdown-option-body__label span) {
  gap: 9px !important;
  line-height: 22px !important;
}
</style>
