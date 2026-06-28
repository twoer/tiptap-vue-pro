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
import { GripVertical, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  /** 滚动容器(覆盖层相对它定位)。由主组件传入 tvp-content-wrap */
  scrollContainer: HTMLElement | null
}>()

// 当前 hover 的行号/列号(null = 未 hover 表格区域)
const hoverRow = ref<number | null>(null)
const hoverCol = ref<number | null>(null)

// 抓手的像素位置(相对 scrollContainer)
const gripPos = ref<{ row?: { left: number; top: number; height: number }; col?: { top: number; left: number; width: number } }>({})

// 菜单弹出状态(行菜单/列菜单分别控制)
const rowMenuShow = ref(false)
const colMenuShow = ref(false)

const hasEditor = computed(() => !!props.editor && !!props.scrollContainer)

// 抓手尺寸 + 与表格的间隙(飞书贴边风格:2px 间隙,几乎贴着表格边缘)
const GRIP_SIZE = 22
const GRIP_GAP = 2

// 当前鼠标悬停的表格/单元格。不要依赖 tableState.tablePos:
// tableState 只跟随「当前选区」,用户纯 hover 表格时选区可能还在表格外。
let activeTable: HTMLTableElement | null = null
let activeCell: HTMLElement | null = null

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
    gripPos.value = {}
    return
  }
  // 表格若整体滚出容器视口,不显示抓手
  const scrollRect = scrollEl.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()
  if (tableRect.bottom < scrollRect.top || tableRect.top > scrollRect.bottom) {
    gripPos.value = {}
    return
  }
  const pos: typeof gripPos.value = {}

  // 行抓手:fixed 定位,坐标直接用视口坐标(getBoundingClientRect 的返回值)
  if (hoverRow.value != null) {
    const rows = table.querySelectorAll('tr')
    const tr = rows[hoverRow.value]
    if (tr) {
      const r = tr.getBoundingClientRect()
      pos.row = {
        left: tableRect.left - GRIP_SIZE - GRIP_GAP,
        top: r.top,
        height: r.height,
      }
    }
  }

  // 列抓手
  if (hoverCol.value != null) {
    const firstRow = table.querySelector('tr')
    if (firstRow) {
      const cells = firstRow.querySelectorAll('th, td')
      const cell = cells[hoverCol.value]
      if (cell) {
        const c = cell.getBoundingClientRect()
        pos.col = {
          top: tableRect.top - GRIP_SIZE - GRIP_GAP,
          left: c.left,
          width: c.width,
        }
      }
    }
  }
  gripPos.value = pos
}

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
  activeTable = table
  activeCell = td
  hoverRow.value = rowIndex >= 0 ? rowIndex : null
  hoverCol.value = colIndex >= 0 ? colIndex : null
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
// 抓手自身 hover 保活:鼠标进抓手区域取消挂起的隐藏
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
  // 从 DOM 坐标反查 ProseMirror pos,比 posAtDOM 更能避开 tableCell 边界位置。
  const hit = ed.view.posAtCoords({
    left: rect.left + Math.min(8, Math.max(1, rect.width / 2)),
    top: rect.top + Math.min(8, Math.max(1, rect.height / 2)),
  })
  if (!hit) return
  ed.chain().focus().setTextSelection(hit.pos).run()
}

// 点击 6 点热区打开菜单时,先把选区落到当前 hover 的 cell,再选中整行/整列。
// 外层长条只负责 hover 保活和视觉定位,不直接触发菜单。
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

// 行菜单命令(作用于当前选中行)
function runRowCmd(op: string) {
  const c = props.ctx.commands
  if (op === 'addUp') c.addRowBefore()
  else if (op === 'addDown') c.addRowAfter()
  else if (op === 'delete') c.deleteRow()
  else if (op === 'moveUp') c.moveRowUp()
  else if (op === 'moveDown') c.moveRowDown()
  rowMenuShow.value = false
  clearHover()
}
function runColCmd(op: string) {
  const c = props.ctx.commands
  if (op === 'addLeft') c.addColumnBefore()
  else if (op === 'addRight') c.addColumnAfter()
  else if (op === 'delete') c.deleteColumn()
  else if (op === 'moveLeft') c.moveColumnLeft()
  else if (op === 'moveRight') c.moveColumnRight()
  colMenuShow.value = false
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
  const ed = props.editor
  if (ed) ed.off('transaction', refresh)
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
      v-if="gripPos.row && hoverRow != null"
      class="tvp-table-grip tvp-table-grip--row"
      :style="{ left: gripPos.row.left + 'px', top: gripPos.row.top + 'px', height: gripPos.row.height + 'px' }"
      @mouseenter="onGripEnter"
      @mousedown.stop.prevent
    >
      <ElDropdown
        v-model:visible="rowMenuShow"
        trigger="click"
        placement="right-start"
        @visible-change="onRowMenuShow"
        @command="runRowCmd"
      >
        <span class="tvp-table-grip__icon"><GripVertical :size="14" /></span>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="addUp"><Plus :size="14" /><span style="margin-left:6px">在上方插入行</span></ElDropdownItem>
            <ElDropdownItem command="addDown"><Plus :size="14" /><span style="margin-left:6px">在下方插入行</span></ElDropdownItem>
            <ElDropdownItem command="moveUp"><ArrowUp :size="14" /><span style="margin-left:6px">上移行</span></ElDropdownItem>
            <ElDropdownItem command="moveDown"><ArrowDown :size="14" /><span style="margin-left:6px">下移行</span></ElDropdownItem>
            <ElDropdownItem command="delete" divided><Trash2 :size="14" /><span style="margin-left:6px">删除行</span></ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>

    <!-- 列抓手(表格上外侧)-->
    <div
      v-if="gripPos.col && hoverCol != null"
      class="tvp-table-grip tvp-table-grip--col"
      :style="{ left: gripPos.col.left + 'px', top: gripPos.col.top + 'px', width: gripPos.col.width + 'px' }"
      @mouseenter="onGripEnter"
      @mousedown.stop.prevent
    >
      <ElDropdown
        v-model:visible="colMenuShow"
        trigger="click"
        placement="bottom-start"
        @visible-change="onColMenuShow"
        @command="runColCmd"
      >
        <span class="tvp-table-grip__icon"><GripVertical :size="14" /></span>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="addLeft"><Plus :size="14" /><span style="margin-left:6px">在左侧插入列</span></ElDropdownItem>
            <ElDropdownItem command="addRight"><Plus :size="14" /><span style="margin-left:6px">在右侧插入列</span></ElDropdownItem>
            <ElDropdownItem command="moveLeft"><ArrowUp :size="14" :style="'transform:rotate(-90deg)'" /><span style="margin-left:6px">左移列</span></ElDropdownItem>
            <ElDropdownItem command="moveRight"><ArrowDown :size="14" :style="'transform:rotate(-90deg)'" /><span style="margin-left:6px">右移列</span></ElDropdownItem>
            <ElDropdownItem command="delete" divided><Trash2 :size="14" /><span style="margin-left:6px">删除列</span></ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>
  </template>
</template>

<style scoped>
/* 抓手:fixed 浮层(相对视口),不受 content-wrap overflow 裁剪。
   图标(6 点)默认清晰可见,背景默认透明;hover 时背景淡淡浮现,点击区域 22px 不变。 */
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #595959; /* 明确的深灰,不依赖 CSS 变量继承 */
}
/* Dropdown 触发器只包住 6 点附近,但比 SVG 本身大,避免要求精确点中图标路径。 */
.tvp-table-grip :deep(.el-dropdown) {
  width: 28px;
  height: 28px;
}
.tvp-table-grip:hover {
  /* hover 背景用更淡的色(lighter 比 light 更轻),不抢视觉 */
  background: var(--el-fill-color-lighter, #fafafa);
}
.tvp-table-grip:hover .tvp-table-grip__icon {
  color: var(--el-color-primary, #409eff);
}
/* 行抓手:竖条状,宽度固定,高度跟随行高 */
.tvp-table-grip--row {
  width: 22px;
}
/* 列抓手:横条状,高度固定,宽度跟随列宽 */
.tvp-table-grip--col {
  height: 22px;
}
</style>
