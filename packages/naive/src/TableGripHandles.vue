<script setup lang="ts">
/**
 * Naive 适配的表格行/列抓手(飞书式)。
 * 悬停某行 → 左外侧抓手;悬停某列 → 上外侧抓手。点击选中整行/列 + 弹 NDropdown 菜单。
 * 用手写覆盖层(逐行/逐列多按钮,BubbleMenuPlugin 不适用),相对 tvp-content-wrap 定位。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, h, type VNode } from 'vue'
import { NDropdown } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { GripVertical, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  scrollContainer: HTMLElement | null
}>()

const hoverRow = ref<number | null>(null)
const hoverCol = ref<number | null>(null)
const gripPos = ref<{ row?: { left: number; top: number; height: number }; col?: { top: number; left: number; width: number } }>({})
const rowMenuShow = ref(false)
const colMenuShow = ref(false)
const hasEditor = computed(() => !!props.editor && !!props.scrollContainer)

// 菜单 options(Naive 用数据驱动)
const iconMap: Record<string, any> = {
  addUp: Plus, addDown: Plus, addLeft: Plus, addRight: Plus,
  moveUp: ArrowUp, moveDown: ArrowDown, moveLeft: ArrowUp, moveRight: ArrowDown,
  delete: Trash2,
}
const rowOptions: DropdownOption[] = [
  { key: 'addUp', label: '在上方插入' },
  { key: 'addDown', label: '在下方插入' },
  { type: 'divider' },
  { key: 'moveUp', label: '上移' },
  { key: 'moveDown', label: '下移' },
  { type: 'divider' },
  { key: 'delete', label: '删除' },
]
const colOptions: DropdownOption[] = [
  { key: 'addLeft', label: '在左侧插入' },
  { key: 'addRight', label: '在右侧插入' },
  { type: 'divider' },
  { key: 'moveLeft', label: '左移' },
  { key: 'moveRight', label: '右移' },
  { type: 'divider' },
  { key: 'delete', label: '删除' },
]
function renderLabel(opt: DropdownOption): VNode {
  const Icon = iconMap[opt.key as string] ?? GripVertical
  const isRotated = opt.key === 'moveLeft' || opt.key === 'moveRight'
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
    h(Icon, { size: 14, style: isRotated ? 'transform:rotate(-90deg)' : '' }),
    opt.label as string,
  ])
}

// 抓手尺寸 + 与表格的间隙(飞书贴边风格:2px 间隙)
const GRIP_SIZE = 22
const GRIP_GAP = 2
const RUN_AFTER_POPPER_CLOSE_MS = 240
let destructiveTimer: number | null = null

function clearDestructiveTimer() {
  if (destructiveTimer != null) {
    window.clearTimeout(destructiveTimer)
    destructiveTimer = null
  }
}

function runAfterPopperClose(command: () => void) {
  clearDestructiveTimer()
  destructiveTimer = window.setTimeout(() => {
    command()
    destructiveTimer = null
  }, RUN_AFTER_POPPER_CLOSE_MS)
}

// 当前鼠标悬停的表格/单元格。不能依赖 tableState.tablePos,因为纯 hover
// 表格时编辑器选区可能还在表格外,tableState 仍是空。
let activeTable: HTMLTableElement | null = null
let activeCell: HTMLElement | null = null
let activeEditor: Editor | null = null

function getTableEl(): HTMLTableElement | null {
  if (activeTable) return activeTable
  const pos = props.ctx.tableState.value.tablePos
  if (pos == null) return null
  const node = props.editor?.view.nodeDOM(pos) as HTMLElement | null
  return (node?.querySelector('table') as HTMLTableElement) ?? (node as HTMLTableElement)
}

// fixed 浮层定位:坐标用视口坐标 getBoundingClientRect 直接用,不受 overflow 裁剪。
function updateGripPos() {
  const table = getTableEl()
  const scrollEl = props.scrollContainer
  if (!table || !scrollEl) {
    gripPos.value = {}
    return
  }
  const scrollRect = scrollEl.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()
  // 表格滚出容器视口则不显示
  if (tableRect.bottom < scrollRect.top || tableRect.top > scrollRect.bottom) {
    gripPos.value = {}
    return
  }
  const pos: typeof gripPos.value = {}

  if (hoverRow.value != null) {
    const rows = table.querySelectorAll('tr')
    const tr = rows[hoverRow.value]
    if (tr) {
      const r = tr.getBoundingClientRect()
      pos.row = { left: tableRect.left - GRIP_SIZE - GRIP_GAP, top: r.top, height: r.height }
    }
  }
  if (hoverCol.value != null) {
    const firstRow = table.querySelector('tr')
    if (firstRow) {
      const cells = firstRow.querySelectorAll('th, td')
      const cell = cells[hoverCol.value]
      if (cell) {
        const c = cell.getBoundingClientRect()
        pos.col = { top: tableRect.top - GRIP_SIZE - GRIP_GAP, left: c.left, width: c.width }
      }
    }
  }
  gripPos.value = pos
}

function onContainerMouseMove(e: MouseEvent) {
  cancelHide()
  const target = e.target as HTMLElement
  const td = target.closest('td, th') as HTMLElement | null
  if (!td || !props.editor?.view.dom.contains(td)) return
  const tr = td.parentElement as HTMLTableRowElement
  const table = tr?.closest('table') as HTMLTableElement
  if (!table || !props.editor.view.dom.contains(table)) return
  const rowIndex = Array.from(table.querySelectorAll('tr')).indexOf(tr)
  const colIndex = Array.from(tr.children).indexOf(td)
  activeTable = table
  activeCell = td
  hoverRow.value = rowIndex >= 0 ? rowIndex : null
  hoverCol.value = colIndex >= 0 ? colIndex : null
  updateGripPos()
}

// 延迟隐藏:抓手在表格外侧,鼠标从单元格移向抓手必经「表格外」区域会触发 mouseleave。
// 用 200ms 缓冲:离开先挂起隐藏,进抓手/回表格立刻取消。飞书/Notion 同款。
let hideTimer: ReturnType<typeof setTimeout> | null = null
function cancelHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}
function scheduleHide() {
  cancelHide()
  hideTimer = setTimeout(() => {
    if (!rowMenuShow.value && !colMenuShow.value) {
      clearHover()
    }
    hideTimer = null
  }, 200)
}
function onContainerMouseLeave() {
  scheduleHide()
}
function onGripEnter() {
  cancelHide()
}

function clearHover() {
  hoverRow.value = null
  hoverCol.value = null
  gripPos.value = {}
  activeTable = null
  activeCell = null
}

function focusActiveCell() {
  const ed = props.editor
  if (!ed || !activeCell) return
  const rect = activeCell.getBoundingClientRect()
  // 用坐标反查文档位置,避免 tableCell DOM 边界导致 selection 落不到单元格内。
  const hit = ed.view.posAtCoords({
    left: rect.left + Math.min(8, Math.max(1, rect.width / 2)),
    top: rect.top + Math.min(8, Math.max(1, rect.height / 2)),
  })
  if (!hit) return
  ed.chain().focus().setTextSelection(hit.pos).run()
}

// 菜单显隐回调:菜单打开瞬间执行 selectRow/Column(选中整行/列)。
// 不在父 div 绑 click(会和 NDropdown 的触发器冲突),选中动作放到菜单打开时机。
function onRowMenuShow(visible: boolean) {
  rowMenuShow.value = visible
  if (visible) {
    focusActiveCell()
    props.ctx.commands.selectRow()
  }
}
function onColMenuShow(visible: boolean) {
  colMenuShow.value = visible
  if (visible) {
    focusActiveCell()
    props.ctx.commands.selectColumn()
  }
}

function runRowCmd(key: string | number) {
  const c = props.ctx.commands
  const op = String(key)
  if (op === 'addUp') c.addRowBefore()
  else if (op === 'addDown') c.addRowAfter()
  else if (op === 'delete') {
    rowMenuShow.value = false
    clearHover()
    runAfterPopperClose(() => c.deleteRow())
    return
  }
  else if (op === 'moveUp') c.moveRowUp()
  else if (op === 'moveDown') c.moveRowDown()
  rowMenuShow.value = false
  clearHover()
}
function runColCmd(key: string | number) {
  const c = props.ctx.commands
  const op = String(key)
  if (op === 'addLeft') c.addColumnBefore()
  else if (op === 'addRight') c.addColumnAfter()
  else if (op === 'delete') {
    colMenuShow.value = false
    clearHover()
    runAfterPopperClose(() => c.deleteColumn())
    return
  }
  else if (op === 'moveLeft') c.moveColumnLeft()
  else if (op === 'moveRight') c.moveColumnRight()
  colMenuShow.value = false
  clearHover()
}

function refresh() {
  updateGripPos()
}
let scrollEl: HTMLElement | null = null
function setup() {
  const ed = props.editor
  scrollEl = props.scrollContainer
  if (!ed) return
  activeEditor = ed
  ed.on('transaction', refresh)
  if (scrollEl) {
    scrollEl.addEventListener('mousemove', onContainerMouseMove)
    scrollEl.addEventListener('mouseleave', onContainerMouseLeave)
    scrollEl.addEventListener('scroll', updateGripPos, { passive: true })
  }
  window.addEventListener('resize', updateGripPos)
  refresh()
}
function teardown() {
  cancelHide()
  clearDestructiveTimer()
  const ed = activeEditor
  if (ed) ed.off('transaction', refresh)
  activeEditor = null
  if (scrollEl) {
    scrollEl.removeEventListener('mousemove', onContainerMouseMove)
    scrollEl.removeEventListener('mouseleave', onContainerMouseLeave)
    scrollEl.removeEventListener('scroll', updateGripPos)
  }
  window.removeEventListener('resize', updateGripPos)
  activeTable = null
  activeCell = null
}

onMounted(setup)
onBeforeUnmount(teardown)
watch(() => [props.editor, props.scrollContainer], () => { teardown(); setup() })
watch(() => props.ctx.tableState.value.tablePos, refresh)
</script>

<template>
  <template v-if="hasEditor">
    <!-- 行抓手(表格左外侧)-->
    <div
      v-if="gripPos.row && hoverRow != null"
      class="tvp-table-grip tvp-table-grip--row"
      :style="{ left: gripPos.row.left + 'px', top: gripPos.row.top + 'px', height: gripPos.row.height + 'px' }"
      @mouseenter="onGripEnter"
      @mousedown.stop
    >
      <NDropdown trigger="click" :show="rowMenuShow" @update:show="onRowMenuShow" placement="right-start" :options="rowOptions" :render-label="renderLabel" @select="runRowCmd">
        <span class="tvp-table-grip__icon"><GripVertical :size="14" /></span>
      </NDropdown>
    </div>

    <!-- 列抓手(表格上外侧)-->
    <div
      v-if="gripPos.col && hoverCol != null"
      class="tvp-table-grip tvp-table-grip--col"
      :style="{ left: gripPos.col.left + 'px', top: gripPos.col.top + 'px', width: gripPos.col.width + 'px' }"
      @mouseenter="onGripEnter"
      @mousedown.stop
    >
      <NDropdown trigger="click" :show="colMenuShow" @update:show="onColMenuShow" placement="bottom-start" :options="colOptions" :render-label="renderLabel" @select="runColCmd">
        <span class="tvp-table-grip__icon"><GripVertical :size="14" /></span>
      </NDropdown>
    </div>
  </template>
</template>

<style scoped>
.tvp-table-grip {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s, color 0.15s;
}
/* 图标颜色强制指定,避免 NDropdown 触发器样式或继承把图标吃掉 */
.tvp-table-grip__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #595959;
}
/* NDropdown 的 trigger 只包住 6 点附近,但比 SVG 本身大,降低点击精度要求。 */
.tvp-table-grip :deep(.n-dropdown-trigger) {
  width: 28px;
  height: 28px;
}
.tvp-table-grip:hover {
  /* hover 背景用更淡的色,不抢视觉 */
  background: var(--n-fill-color-light, #fafafa);
}
.tvp-table-grip:hover .tvp-table-grip__icon {
  color: var(--n-primary-color, #18a058);
}
.tvp-table-grip--row { width: 22px; }
.tvp-table-grip--col { height: 22px; }
</style>
