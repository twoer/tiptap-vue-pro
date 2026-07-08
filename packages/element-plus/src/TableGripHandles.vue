<script setup lang="ts">
/**
 * 表格行/列抓手(飞书式)。
 *
 * 交互:鼠标悬停某行 → 表格左外侧浮现该行的 ⋮⋮ 抓手;悬停某列 → 上方浮现抓手。
 * 点击抓手 → 选中整行/列 + 弹菜单(上插/下插/删除/上移/下移)。
 *
 * 实现要点:
 * - 不用 BubbleMenuPlugin(它一个实例只定位一个 element,而抓手要逐行/逐列多个)。
 *   改用手写覆盖层:根据 ctx.tableState.tablePos 拿 table DOM,遍历 <tr>/<td> 的
 *   getBoundingClientRect,absolute 定位渲染抓手。
 * - 定位锚点:tvp-content-wrap(滚动容器),抓手 absolute 其内,滚动时自动跟随。
 * - hover 检测:事件委托到 table DOM 的 mousemove,用 posAtCoords 反查行/列号,
 *   缓存当前 hover 的行/列,驱动抓手显隐与位置。
 * - 菜单用 ElDropdown,命令转发到 core 的 moveRow, selectRow, addRow, deleteRow 等。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext, ProEditorDebugLogFn } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  /** 滚动容器(覆盖层相对它定位)。由主组件传入 tvp-content-wrap */
  scrollContainer: HTMLElement | null
  /** adapter 层开发者诊断日志 */
  debugLog?: ProEditorDebugLogFn
}>()
const emit = defineEmits<{
  'menu-open-change': [open: boolean]
}>()

// 当前 hover 的行号/列号(null = 未 hover 表格区域)
const hoverRow = ref<number | null>(null)
const hoverCol = ref<number | null>(null)

// 抓手的像素位置。进入表格后为每行/每列都计算一个抓手,点击时用抓手自带的 index。
const gripPos = ref<{
  rows: { index: number; left: number; top: number; height: number }[]
  cols: { index: number; top: number; left: number; width: number }[]
}>({ rows: [], cols: [] })

// 菜单弹出状态(行菜单/列菜单分别控制)
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

// 当前鼠标悬停的表格/单元格。不要依赖 tableState.tablePos:
// tableState 只跟随「当前选区」,用户纯 hover 表格时选区可能还在表格外。
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

// 拿当前表格的 DOM 元素
function getTableEl(): HTMLTableElement | null {
  if (activeTable) return activeTable
  const pos = props.ctx.tableState.value.tablePos
  if (pos == null) return null
  const node = props.editor?.view.nodeDOM(pos) as HTMLElement | null
  // nodeDOM 可能返回 table 本身或其包装(TableView 的 tableWrapper)
  return (node?.querySelector('table') as HTMLTableElement) ?? (node as HTMLTableElement)
}

// 计算抓手位置(position:fixed,坐标用视口坐标 getBoundingClientRect 直接用)。
// fixed 浮层不受 content-wrap 的 overflow 裁剪,抓手能完整伸出表格左/上外侧。
function updateGripPos() {
  const table = getTableEl()
  const scrollEl = props.scrollContainer
  if (!table || !scrollEl) {
    gripPos.value = { rows: [], cols: [] }
    return
  }
  // 表格若整体滚出容器视口,不显示抓手
  const scrollRect = scrollEl.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()
  if (tableRect.bottom < scrollRect.top || tableRect.top > scrollRect.bottom) {
    gripPos.value = { rows: [], cols: [] }
    return
  }
  if (hoverRow.value == null && hoverCol.value == null && !rowMenuShow.value && !colMenuShow.value) {
    gripPos.value = { rows: [], cols: [] }
    return
  }
  const pos: typeof gripPos.value = { rows: [], cols: [] }

  // 行抓手:fixed 定位,坐标直接用视口坐标(getBoundingClientRect 的返回值)
  const rows = Array.from(table.querySelectorAll('tr'))
  for (const [index, tr] of rows.entries()) {
    const r = tr.getBoundingClientRect()
    pos.rows.push({
      index,
      left: tableRect.left - GRIP_SIZE - GRIP_GAP,
      top: r.top,
      height: r.height,
    })
  }

  // 列抓手
  const firstRow = table.querySelector('tr')
  if (firstRow) {
    const cells = Array.from(firstRow.querySelectorAll('th, td'))
    for (const [index, cell] of cells.entries()) {
      const c = cell.getBoundingClientRect()
      pos.cols.push({
        index,
        top: tableRect.top - GRIP_SIZE - GRIP_GAP,
        left: c.left,
        width: c.width,
      })
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

// hover 检测:委托到 table 的 mousemove,用 cell 的 DOM 索引反查行列号
function onContainerMouseMove(e: MouseEvent) {
  // 一进表格区域就取消任何挂起的隐藏(覆盖延迟隐藏)
  cancelHide()
  const target = e.target as HTMLElement
  const td = target.closest('td, th') as HTMLElement | null
  if (!td || !props.editor?.view.dom.contains(td)) return
  const tr = td.parentElement as HTMLTableRowElement
  const table = tr?.closest('table') as HTMLTableElement
  if (!table || !props.editor.view.dom.contains(table)) return
  // 行号 = tr 在 table 中的索引;列号 = td 在 tr 中的索引
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

// 延迟隐藏:抓手在表格外侧,鼠标从单元格移向抓手必经「表格外」区域,
// 若 mouseleave 立即隐藏,用户永远 hover 不到抓手。故用 200ms 缓冲:
// 离开表格先挂起隐藏,进抓手区域(或回表格)立刻取消。飞书/Notion 同款做法。
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

// 点击 4 点热区打开菜单时,先把选区落到当前 hover 的 cell,再选中整行/整列。
// 外层长条只负责 hover 保活和视觉定位,不直接触发菜单。
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

// 行菜单命令(作用于当前选中行)
function runRowCmd(op: string) {
  const c = props.ctx.commands
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
function runColCmd(op: string) {
  const c = props.ctx.commands
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

// 内容变化/滚动/resize 时重算定位
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
// editor/scrollContainer/tableState 变化时重新 setup
watch(() => [props.editor, props.scrollContainer], () => {
  teardown()
  setup()
})
watch(() => props.ctx.tableState.value.tablePos, refresh)
</script>

<template>
  <!-- 覆盖层:随鼠标 hover 的表格渲染,不依赖编辑器当前选区 -->
  <template v-if="hasEditor">
    <!-- 行抓手(表格左外侧)-->
    <div
      v-for="row in activeGripPos.rows"
      :key="'row-' + row.index"
      class="tvp-table-grip tvp-table-grip--row"
      :class="{ 'is-active': row.index === hoverRow || row.index === rowMenuIndex }"
      :style="{ left: row.left + 'px', top: row.top + 'px', height: row.height + 'px' }"
      @mouseenter="onRowGripEnter(row.index)"
      @mousedown.stop.prevent="lockRowGripTarget(row.index)"
    >
      <ElDropdown
        :visible="rowMenuShow && rowMenuIndex === row.index"
        trigger="click"
        placement="right-start"
        popper-class="tvp-table-grip-dropdown"
        @visible-change="(visible: boolean) => onRowMenuShow(visible, row.index)"
        @command="runRowCmd"
      >
        <span class="tvp-table-grip__icon" aria-label="行操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="addUp"><span class="tvp-menu-item"><Plus :size="14" />在上方插入</span></ElDropdownItem>
            <ElDropdownItem command="addDown"><span class="tvp-menu-item"><Plus :size="14" />在下方插入</span></ElDropdownItem>
            <ElDropdownItem command="moveUp"><span class="tvp-menu-item"><ArrowUp :size="14" />上移</span></ElDropdownItem>
            <ElDropdownItem command="moveDown"><span class="tvp-menu-item"><ArrowDown :size="14" />下移</span></ElDropdownItem>
            <ElDropdownItem command="delete" divided><span class="tvp-menu-item"><Trash2 :size="14" />删除</span></ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>

    <!-- 列抓手(表格上外侧)-->
    <div
      v-for="col in activeGripPos.cols"
      :key="'col-' + col.index"
      class="tvp-table-grip tvp-table-grip--col"
      :class="{ 'is-active': col.index === hoverCol || col.index === colMenuIndex }"
      :style="{ left: col.left + 'px', top: col.top + 'px', width: col.width + 'px' }"
      @mouseenter="onColGripEnter(col.index)"
      @mousedown.stop.prevent="lockColGripTarget(col.index)"
    >
      <ElDropdown
        :visible="colMenuShow && colMenuIndex === col.index"
        trigger="click"
        placement="top-start"
        popper-class="tvp-table-grip-dropdown"
        @visible-change="(visible: boolean) => onColMenuShow(visible, col.index)"
        @command="runColCmd"
      >
        <span class="tvp-table-grip__icon" aria-label="列操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="addLeft"><span class="tvp-menu-item"><Plus :size="14" />在左侧插入</span></ElDropdownItem>
            <ElDropdownItem command="addRight"><span class="tvp-menu-item"><Plus :size="14" />在右侧插入</span></ElDropdownItem>
            <ElDropdownItem command="moveLeft"><span class="tvp-menu-item"><ArrowUp :size="14" :style="'transform:rotate(-90deg)'" />左移</span></ElDropdownItem>
            <ElDropdownItem command="moveRight"><span class="tvp-menu-item"><ArrowDown :size="14" :style="'transform:rotate(-90deg)'" />右移</span></ElDropdownItem>
            <ElDropdownItem command="delete" divided><span class="tvp-menu-item"><Trash2 :size="14" />删除</span></ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>
  </template>
</template>

<style scoped>
/* 抓手:fixed 浮层(相对视口),不受 content-wrap overflow 裁剪。 */
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
/* 图标颜色强制指定,避免 ElDropdown 触发器样式或继承把图标吃掉 */
.tvp-table-grip__icon {
  display: grid;
  grid-template-columns: repeat(2, 2.5px);
  grid-template-rows: repeat(2, 2.5px);
  gap: 3px;
  place-content: center;
  width: 28px;
  height: 28px;
  color: #595959; /* 明确的深灰,不依赖 CSS 变量继承 */
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
/* Dropdown 触发器只包住 4 点附近,但比点阵本身大,避免要求精确点中。 */
.tvp-table-grip :deep(.el-dropdown) {
  width: 28px;
  height: 28px;
}
.tvp-table-grip:hover {
  background: transparent;
}
.tvp-table-grip:hover .tvp-table-grip__icon {
  color: var(--el-color-primary, #409eff);
}

.tvp-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
  vertical-align: middle;
}

.tvp-menu-item svg {
  display: block;
  flex: 0 0 auto;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu) {
  min-width: 150px;
  padding: 6px 0;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu__item) {
  min-height: 38px;
  padding: 8px 18px;
  color: var(--el-text-color-regular, #606266);
  font-size: 14px;
  line-height: 20px;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu__item--divided) {
  margin-top: 6px;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu__item--divided::before) {
  margin: 0 -18px 6px;
}

:global(.tvp-table-grip-dropdown .tvp-menu-item) {
  line-height: 20px;
}

/* 行抓手:竖条状,宽度固定,高度跟随行高 */
.tvp-table-grip--row {
  width: 22px;
  background: transparent;
}
.tvp-table-grip--row:hover {
  background: transparent;
}
/* 列抓手:横条状,高度固定,宽度跟随列宽 */
.tvp-table-grip--col {
  height: 22px;
  background: transparent;
}
.tvp-table-grip--col:hover {
  background: transparent;
}
</style>
