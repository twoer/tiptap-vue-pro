<script setup lang="ts">
/**
 * Naive 适配的表格行/列抓手(飞书式)。
 * 悬停某行 → 左外侧抓手;悬停某列 → 上外侧抓手。点击选中整行/列 + 弹 NDropdown 菜单。
 * 用手写覆盖层(逐行/逐列多按钮,BubbleMenuPlugin 不适用),相对 tvp-content-wrap 定位。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, h, type VNode } from 'vue'
import { NDropdown } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext, ProEditorDebugLogFn } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  scrollContainer: HTMLElement | null
  /** adapter 层开发者诊断日志 */
  debugLog?: ProEditorDebugLogFn
}>()
const emit = defineEmits<{
  'menu-open-change': [open: boolean]
}>()

const hoverRow = ref<number | null>(null)
const hoverCol = ref<number | null>(null)
const gripPos = ref<{
  rows: { index: number; left: number; top: number; height: number }[]
  cols: { index: number; top: number; left: number; width: number }[]
}>({ rows: [], cols: [] })
const rowMenuShow = ref(false)
const colMenuShow = ref(false)

function emitMenuOpenChange() {
  const open = rowMenuShow.value || colMenuShow.value
  emit('menu-open-change', open)
  if (open) setTableBubbleSuppressed(true)
}

function setTableBubbleSuppressed(suppressed: boolean) {
  const editorRoot = props.editor?.view.dom.closest('.tvp-editor') as HTMLElement | null
  if (suppressed) editorRoot?.setAttribute('data-table-grip-suppress-bubble', 'true')
  else editorRoot?.removeAttribute('data-table-grip-suppress-bubble')
}

function clearTableBubbleSuppress() {
  if (rowMenuShow.value || colMenuShow.value) return
  setTableBubbleSuppressed(false)
}
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
  const Icon = iconMap[opt.key as string] ?? Plus
  const isRotated = opt.key === 'moveLeft' || opt.key === 'moveRight'
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;line-height:1;vertical-align:middle;' }, [
    h(Icon, { size: 14, style: isRotated ? 'display:block;flex:0 0 auto;transform:rotate(-90deg)' : 'display:block;flex:0 0 auto;' }),
    opt.label as string,
  ])
}

// 抓手尺寸 + 与表格的间隙。负值让小点阵更贴近表格边缘,热区仍保留 28px。
const GRIP_SIZE = 22
const GRIP_GAP = -3
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
let rowMenuCell: HTMLElement | null = null
let colMenuCell: HTMLElement | null = null
let rowMenuIndex: number | null = null
let colMenuIndex: number | null = null
let activeEditor: Editor | null = null

function describeCell(cell: HTMLElement | null) {
  if (!cell) return null
  const rect = cell.getBoundingClientRect()
  const row = cell.parentElement as HTMLTableRowElement | null
  const table = row?.closest('table')
  return {
    tag: cell.tagName,
    text: cell.textContent?.trim(),
    rowIndex: row && table ? Array.from(table.querySelectorAll('tr')).indexOf(row) : null,
    colIndex: row ? Array.from(row.children).indexOf(cell) : null,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  }
}

function tableGripDebug(event: string, payload: Record<string, unknown> = {}) {
  props.debugLog?.('table', event, payload)
}

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
    gripPos.value = { rows: [], cols: [] }
    return
  }
  const scrollRect = scrollEl.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()
  // 表格滚出容器视口则不显示
  if (tableRect.bottom < scrollRect.top || tableRect.top > scrollRect.bottom) {
    gripPos.value = { rows: [], cols: [] }
    return
  }
  if (hoverRow.value == null && hoverCol.value == null && !rowMenuShow.value && !colMenuShow.value) {
    gripPos.value = { rows: [], cols: [] }
    return
  }
  const pos: typeof gripPos.value = { rows: [], cols: [] }

  const rows = Array.from(table.querySelectorAll('tr'))
  for (const [index, tr] of rows.entries()) {
    const r = tr.getBoundingClientRect()
    pos.rows.push({ index, left: tableRect.left - GRIP_SIZE - GRIP_GAP, top: r.top, height: r.height })
  }
  const firstRow = table.querySelector('tr')
  if (firstRow) {
    const cells = Array.from(firstRow.querySelectorAll('th, td'))
    for (const [index, cell] of cells.entries()) {
      const c = cell.getBoundingClientRect()
      pos.cols.push({ index, top: tableRect.top - GRIP_SIZE - GRIP_GAP, left: c.left, width: c.width })
    }
  }
  gripPos.value = pos
}

function getActiveGripPositions() {
  const shouldRender = hoverRow.value != null || hoverCol.value != null || rowMenuShow.value || colMenuShow.value
  return {
    rows: shouldRender ? gripPos.value.rows : [],
    cols: shouldRender ? gripPos.value.cols : [],
  }
}

const activeGripPos = computed(getActiveGripPositions)

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
  const changed = hoverRow.value !== rowIndex || hoverCol.value !== colIndex
  activeTable = table
  activeCell = td
  hoverRow.value = rowIndex >= 0 ? rowIndex : null
  hoverCol.value = colIndex >= 0 ? colIndex : null
  if (changed) {
    tableGripDebug('hover-cell', {
      rowIndex,
      colIndex,
      activeCell: describeCell(activeCell),
    })
  }
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
function onContainerMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('.tvp-table-grip')) return
  clearTableBubbleSuppress()
}
function onRowGripEnter(index: number) {
  cancelHide()
  hoverRow.value = index
  rowMenuCell = getCellAt(index, hoverCol.value ?? 0) ?? rowMenuCell ?? activeCell
  tableGripDebug('row-grip:enter', {
    rowIndex: index,
    rowMenuCell: describeCell(rowMenuCell),
  })
}

function onColGripEnter(index: number) {
  cancelHide()
  hoverCol.value = index
  colMenuCell = getCellAt(hoverRow.value ?? 0, index) ?? colMenuCell ?? activeCell
  tableGripDebug('col-grip:enter', {
    colIndex: index,
    colMenuCell: describeCell(colMenuCell),
  })
}

function getCellAt(rowIndex: number | null | undefined, colIndex: number | null | undefined) {
  if (!activeTable || rowIndex == null || colIndex == null) return null
  const row = activeTable.querySelectorAll('tr')[rowIndex]
  return (row?.children[colIndex] as HTMLElement | undefined) ?? null
}

function lockRowGripTarget(index: number) {
  cancelHide()
  rowMenuIndex = index
  rowMenuCell = getCellAt(index, hoverCol.value ?? 0) ?? activeCell
  tableGripDebug('row-grip:lock', {
    rowIndex: rowMenuIndex,
    rowMenuCell: describeCell(rowMenuCell),
  })
}

function lockColGripTarget(index: number) {
  cancelHide()
  colMenuIndex = index
  colMenuCell = getCellAt(hoverRow.value ?? 0, index) ?? activeCell
  tableGripDebug('col-grip:lock', {
    colIndex: colMenuIndex,
    colMenuCell: describeCell(colMenuCell),
  })
}

function clearHover() {
  hoverRow.value = null
  hoverCol.value = null
  gripPos.value = { rows: [], cols: [] }
  activeTable = null
  activeCell = null
}

function focusCell(cell: HTMLElement | null = activeCell) {
  const ed = props.editor
  if (!ed || !cell) {
    tableGripDebug('focusCell:skip', { hasEditor: !!ed, cell: describeCell(cell) })
    return
  }
  const candidates: number[] = []
  const addCandidate = (pos: number | null | undefined) => {
    if (typeof pos === 'number' && Number.isFinite(pos)) candidates.push(pos)
  }
  const addDomPos = (node: Node, offset: number, deltas: number[] = [0]) => {
    try {
      const base = ed.view.posAtDOM(node, offset)
      for (const delta of deltas) addCandidate(base + delta)
    } catch {
      // Some DOM nodes are outside ProseMirror's managed tree.
    }
  }

  const walker = document.createTreeWalker(cell, 4)
  let textNode = walker.nextNode() as Text | null
  while (textNode && !textNode.textContent?.length) textNode = walker.nextNode() as Text | null
  if (textNode) addDomPos(textNode, Math.min(1, textNode.textContent?.length ?? 0))
  const textBlock = cell.querySelector('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote')
  if (textBlock) addDomPos(textBlock, 0, [1, 2, 0])
  addDomPos(cell, 0, [2, 1, 3])

  const rect = cell.getBoundingClientRect()
  const hit = ed.view.posAtCoords({
    left: rect.left + Math.min(8, Math.max(1, rect.width / 2)),
    top: rect.top + Math.min(8, Math.max(1, rect.height / 2)),
  })
  addCandidate(hit?.pos)
  if (typeof hit?.inside === 'number' && hit.inside >= 0) {
    addCandidate(hit.inside + 2)
    addCandidate(hit.inside + 1)
  }

  const pos = candidates.find((candidate, index) => {
    if (candidates.indexOf(candidate) !== index) return false
    if (candidate < 0 || candidate > ed.state.doc.content.size) return false
    try {
      return ed.state.doc.resolve(candidate).parent.inlineContent
    } catch {
      return false
    }
  })
  if (pos == null) {
    tableGripDebug('focusCell:no-valid-pos', { candidates, cell: describeCell(cell) })
    return
  }
  tableGripDebug('focusCell:hit', { pos, candidates, cell: describeCell(cell) })
  ed.chain().focus().setTextSelection(pos).run()
}

// 菜单显隐回调:菜单打开瞬间执行 selectRow/Column(选中整行/列)。
// 不在父 div 绑 click(会和 NDropdown 的触发器冲突),选中动作放到菜单打开时机。
function onRowMenuShow(visible: boolean, index?: number) {
  if (!visible && index != null && rowMenuIndex != null && rowMenuIndex !== index) return
  rowMenuShow.value = visible
  emitMenuOpenChange()
  if (visible) {
    if (index != null) lockRowGripTarget(index)
    rowMenuCell = rowMenuCell ?? activeCell
    rowMenuIndex = rowMenuIndex ?? describeCell(rowMenuCell)?.rowIndex ?? null
    tableGripDebug('row-menu:open', {
      activeCell: describeCell(activeCell),
      rowMenuCell: describeCell(rowMenuCell),
      rowMenuIndex,
    })
    focusCell(rowMenuCell)
    props.ctx.commands.selectRow(rowMenuIndex ?? describeCell(rowMenuCell)?.rowIndex ?? undefined)
  } else {
    tableGripDebug('row-menu:close')
  }
}
function onColMenuShow(visible: boolean, index?: number) {
  if (!visible && index != null && colMenuIndex != null && colMenuIndex !== index) return
  colMenuShow.value = visible
  emitMenuOpenChange()
  if (visible) {
    if (index != null) lockColGripTarget(index)
    colMenuCell = colMenuCell ?? activeCell
    colMenuIndex = colMenuIndex ?? describeCell(colMenuCell)?.colIndex ?? null
    tableGripDebug('col-menu:open', {
      activeCell: describeCell(activeCell),
      colMenuCell: describeCell(colMenuCell),
      colMenuIndex,
    })
    focusCell(colMenuCell)
    props.ctx.commands.selectColumn(colMenuIndex ?? describeCell(colMenuCell)?.colIndex ?? undefined)
  } else {
    tableGripDebug('col-menu:close')
  }
}

function runRowCmd(key: string | number) {
  const c = props.ctx.commands
  const op = String(key)
  const cell = rowMenuCell ?? activeCell
  const targetCell = describeCell(cell)
  const targetRowIndex = rowMenuIndex ?? targetCell?.rowIndex ?? undefined
  tableGripDebug('row-command:start', {
    op,
    cell: targetCell,
    rowMenuIndex,
    rowMenuCell: describeCell(rowMenuCell),
    activeCell: describeCell(activeCell),
  })
  focusCell(cell)
  c.selectRow(targetRowIndex)
  if (op === 'addUp') c.addRowBefore()
  else if (op === 'addDown') c.addRowAfter()
  else if (op === 'delete') {
    rowMenuShow.value = false
    emitMenuOpenChange()
    setTableBubbleSuppressed(true)
    clearHover()
    runAfterPopperClose(() => {
      tableGripDebug('row-command:delete-run', { cell: targetCell, rowMenuIndex })
      focusCell(cell)
      c.selectRow(targetRowIndex)
      c.deleteRow(targetRowIndex)
      rowMenuCell = null
      rowMenuIndex = null
    })
    return
  }
  else if (op === 'moveUp') c.moveRowUp()
  else if (op === 'moveDown') c.moveRowDown()
  rowMenuCell = null
  rowMenuIndex = null
  rowMenuShow.value = false
  emitMenuOpenChange()
  setTableBubbleSuppressed(true)
  clearHover()
}
function runColCmd(key: string | number) {
  const c = props.ctx.commands
  const op = String(key)
  const cell = colMenuCell ?? activeCell
  const targetCell = describeCell(cell)
  const targetColIndex = colMenuIndex ?? targetCell?.colIndex ?? undefined
  tableGripDebug('col-command:start', {
    op,
    cell: targetCell,
    colMenuIndex,
    colMenuCell: describeCell(colMenuCell),
    activeCell: describeCell(activeCell),
  })
  focusCell(cell)
  c.selectColumn(targetColIndex)
  if (op === 'addLeft') c.addColumnBefore()
  else if (op === 'addRight') c.addColumnAfter()
  else if (op === 'delete') {
    colMenuShow.value = false
    emitMenuOpenChange()
    setTableBubbleSuppressed(true)
    clearHover()
    runAfterPopperClose(() => {
      tableGripDebug('col-command:delete-run', { cell: targetCell, colMenuIndex })
      focusCell(cell)
      c.selectColumn(targetColIndex)
      c.deleteColumn(targetColIndex)
      colMenuCell = null
      colMenuIndex = null
    })
    return
  }
  else if (op === 'moveLeft') c.moveColumnLeft()
  else if (op === 'moveRight') c.moveColumnRight()
  colMenuCell = null
  colMenuIndex = null
  colMenuShow.value = false
  emitMenuOpenChange()
  setTableBubbleSuppressed(true)
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
    scrollEl.addEventListener('mousedown', onContainerMouseDown)
    scrollEl.addEventListener('mouseleave', onContainerMouseLeave)
    scrollEl.addEventListener('scroll', updateGripPos, { passive: true })
  }
  window.addEventListener('resize', updateGripPos)
  refresh()
}
function teardown() {
  cancelHide()
  clearDestructiveTimer()
  const editorRoot = props.editor?.view.dom.closest('.tvp-editor') as HTMLElement | null
  editorRoot?.removeAttribute('data-table-grip-suppress-bubble')
  const ed = activeEditor
  if (ed) ed.off('transaction', refresh)
  activeEditor = null
  if (scrollEl) {
    scrollEl.removeEventListener('mousemove', onContainerMouseMove)
    scrollEl.removeEventListener('mousedown', onContainerMouseDown)
    scrollEl.removeEventListener('mouseleave', onContainerMouseLeave)
    scrollEl.removeEventListener('scroll', updateGripPos)
  }
  window.removeEventListener('resize', updateGripPos)
  activeTable = null
  activeCell = null
  rowMenuCell = null
  colMenuCell = null
  rowMenuIndex = null
  colMenuIndex = null
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
      v-for="row in activeGripPos.rows"
      :key="'row-' + row.index"
      class="tvp-table-grip tvp-table-grip--row"
      :class="{ 'is-active': row.index === hoverRow || row.index === rowMenuIndex }"
      :style="{ left: row.left + 'px', top: row.top + 'px', height: row.height + 'px' }"
      @mouseenter="onRowGripEnter(row.index)"
      @mousedown.stop="lockRowGripTarget(row.index)"
    >
      <NDropdown trigger="click" :show="rowMenuShow && rowMenuIndex === row.index" @update:show="(visible: boolean) => onRowMenuShow(visible, row.index)" placement="right-start" :options="rowOptions" :render-label="renderLabel" @select="runRowCmd">
        <span class="tvp-table-grip__icon" aria-label="行操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
      </NDropdown>
    </div>

    <!-- 列抓手(表格上外侧)-->
    <div
      v-for="col in activeGripPos.cols"
      :key="'col-' + col.index"
      class="tvp-table-grip tvp-table-grip--col"
      :class="{ 'is-active': col.index === hoverCol || col.index === colMenuIndex }"
      :style="{ left: col.left + 'px', top: col.top + 'px', width: col.width + 'px' }"
      @mouseenter="onColGripEnter(col.index)"
      @mousedown.stop="lockColGripTarget(col.index)"
    >
      <NDropdown trigger="click" :show="colMenuShow && colMenuIndex === col.index" @update:show="(visible: boolean) => onColMenuShow(visible, col.index)" placement="top-start" :options="colOptions" :render-label="renderLabel" @select="runColCmd">
        <span class="tvp-table-grip__icon" aria-label="列操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
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
  display: grid;
  grid-template-columns: repeat(2, 2.5px);
  grid-template-rows: repeat(2, 2.5px);
  gap: 3px;
  place-content: center;
  width: 28px;
  height: 28px;
  color: #595959;
  opacity: 0;
  transition: opacity 0.12s, color 0.15s;
}
.tvp-table-grip__dot {
  width: 2.5px;
  height: 2.5px;
  border-radius: 999px;
  background: currentColor;
}
.tvp-table-grip.is-active .tvp-table-grip__icon {
  opacity: 1;
}
/* NDropdown 的 trigger 只包住 4 点附近,但比点阵本身大,降低点击精度要求。 */
.tvp-table-grip :deep(.n-dropdown-trigger) {
  width: 28px;
  height: 28px;
}
.tvp-table-grip:hover {
  background: transparent;
}
.tvp-table-grip:hover .tvp-table-grip__icon {
  color: var(--n-primary-color, #18a058);
}
.tvp-table-grip--row {
  width: 22px;
  background: transparent;
}
.tvp-table-grip--row:hover {
  background: transparent;
}
.tvp-table-grip--col {
  height: 22px;
  background: transparent;
}
.tvp-table-grip--col:hover {
  background: transparent;
}
</style>
