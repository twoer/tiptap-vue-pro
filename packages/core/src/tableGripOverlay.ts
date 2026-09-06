import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext } from './types'
import type { ProEditorDebugLogFn } from './debug'

/**
 * 表格行/列抓手覆盖层引擎(飞书式),三个 UI 适配器共用。
 *
 * 交互:鼠标悬停某行 → 表格左外侧浮现该行的 ⋮⋮ 抓手;悬停某列 → 上方浮现抓手。
 * 点击抓手 → 选中整行/列 + 弹菜单(插入/删除/移动)。
 *
 * 实现要点:
 * - 不用 BubbleMenuPlugin(它一个实例只定位一个 element,而抓手要逐行/逐列多个)。
 *   改用手写覆盖层:根据 ctx.tableState.tablePos 拿 table DOM,遍历 <tr>/<td> 的
 *   getBoundingClientRect,fixed 定位渲染抓手。
 * - hover 检测:事件委托到滚动容器的 mousemove,用 cell 的 DOM 索引反查行/列号,
 *   缓存当前 hover 的行/列,驱动抓手显隐与位置。
 * - 菜单组件(El/N/Ant Dropdown)与样式留在适配器;本引擎只负责
 *   定位、hover、菜单目标锁定、选区落点(focusCell)与命令转发。
 */
export interface TableGripOverlayOptions {
  getEditor: () => Editor | undefined
  getScrollContainer: () => HTMLElement | null
  getContext: () => ProEditorContext
  /**
   * 抓手覆盖层的挂载元素(适配器传抓手容器 ref)。用于探测抓手 DOM 链上最近的
   * fixed 包含块祖先并把视口坐标换算过去;缺省时退回编辑器根元素。
   */
  getOverlayHost?: () => HTMLElement | null
  /** adapter 层开发者诊断日志 */
  debugLog?: ProEditorDebugLogFn
  /** 菜单打开时的选中时序:antd 菜单关闭时序需要 rAF 延迟 + 先关另一菜单 */
  deferMenuOpen?: boolean
  /** 菜单弹出状态变化回调(适配器转发给父组件,用于压住表格气泡) */
  onMenuOpenChange?: (open: boolean) => void
}

export interface TableGripRowPos {
  index: number
  left: number
  top: number
  height: number
}

export interface TableGripColPos {
  index: number
  top: number
  left: number
  width: number
}

export interface TableGripOverlay {
  hasEditor: ComputedRef<boolean>
  hoverRow: Ref<number | null>
  hoverCol: Ref<number | null>
  activeGripPos: ComputedRef<{ rows: TableGripRowPos[]; cols: TableGripColPos[] }>
  rowMenuShow: Ref<boolean>
  colMenuShow: Ref<boolean>
  rowMenuIndex: Ref<number | null>
  colMenuIndex: Ref<number | null>
  onRowGripEnter: (index: number) => void
  onColGripEnter: (index: number) => void
  lockRowGripTarget: (index: number) => void
  lockColGripTarget: (index: number) => void
  onRowMenuShow: (visible: boolean, index?: number) => void
  onColMenuShow: (visible: boolean, index?: number) => void
  runRowCmd: (op: string) => void
  runColCmd: (op: string) => void
  setup: () => void
  teardown: () => void
  refresh: () => void
}

export interface FixedContainingBlockStyle {
  transform?: string | null
  translate?: string | null
  rotate?: string | null
  scale?: string | null
  perspective?: string | null
  filter?: string | null
  backdropFilter?: string | null
  willChange?: string | null
  contain?: string | null
}

const WILL_CHANGE_FIXED_TOKENS = new Set([
  'transform', 'translate', 'rotate', 'scale', 'perspective', 'filter', 'backdrop-filter',
])
const CONTAIN_FIXED_TOKENS = new Set(['layout', 'paint', 'strict', 'content'])

/**
 * 判断一组 computed style 是否会让该元素成为 fixed 后代的包含块。
 * CSS 规范:transform/translate/rotate/scale/perspective/filter/backdrop-filter
 * 非 none、will-change 声明这些属性、或 contain 含 layout/paint/strict/content
 * 时,fixed 后代改为相对该元素定位(而非视口)。
 */
export function styleCreatesFixedContainingBlock(style: FixedContainingBlockStyle): boolean {
  const notNone = (value?: string | null) => !!value && value !== 'none'
  if (
    notNone(style.transform) || notNone(style.translate) || notNone(style.rotate)
    || notNone(style.scale) || notNone(style.perspective) || notNone(style.filter)
    || notNone(style.backdropFilter)
  ) {
    return true
  }
  const willChange = (style.willChange ?? '').toLowerCase()
  if (willChange && willChange !== 'auto' && willChange !== 'will-change') {
    for (const token of willChange.split(',')) {
      if (WILL_CHANGE_FIXED_TOKENS.has(token.trim())) return true
    }
  }
  const contain = (style.contain ?? '').toLowerCase()
  if (contain && contain !== 'none') {
    for (const token of contain.split(/[\s,]+/)) {
      if (CONTAIN_FIXED_TOKENS.has(token)) return true
    }
  }
  return false
}

/** 从 start 的父级向上找最近的 fixed 包含块祖先(不含 start 自身),直到 body。 */
export function findFixedContainingBlock(start: Element | null): HTMLElement | null {
  let el = start?.parentElement ?? null
  while (el && el !== document.body && el !== document.documentElement) {
    let style: FixedContainingBlockStyle
    try {
      const computed = window.getComputedStyle(el)
      style = {
        transform: computed.transform,
        translate: computed.translate,
        rotate: computed.rotate,
        scale: computed.scale,
        perspective: computed.perspective,
        filter: computed.filter,
        backdropFilter: computed.backdropFilter,
        willChange: computed.willChange,
        contain: computed.contain,
      }
    } catch {
      return null
    }
    if (styleCreatesFixedContainingBlock(style)) return el
    el = el.parentElement
  }
  return null
}

/**
 * 解析 fixed 定位坐标的原点:没有包含块祖先时是视口 (0,0),
 * 否则是该祖先的左上角(getBoundingClientRect 的视口坐标)。
 */
export function resolveFixedOrigin(start: Element | null): { left: number; top: number } {
  const containingBlock = findFixedContainingBlock(start)
  if (!containingBlock) return { left: 0, top: 0 }
  const rect = containingBlock.getBoundingClientRect()
  return { left: rect.left, top: rect.top }
}

export function useTableGripOverlay(options: TableGripOverlayOptions): TableGripOverlay {
  const { getEditor, getScrollContainer, getContext, debugLog, deferMenuOpen = false } = options

  // 当前 hover 的行号/列号(null = 未 hover 表格区域)
  const hoverRow = ref<number | null>(null)
  const hoverCol = ref<number | null>(null)

  // 抓手的像素位置。进入表格后为每行/每列都计算一个抓手,点击时用抓手自带的 index。
  const gripPos = ref<{
    rows: TableGripRowPos[]
    cols: TableGripColPos[]
  }>({ rows: [], cols: [] })

  // 菜单弹出状态(行菜单/列菜单分别控制)
  const rowMenuShow = ref(false)
  const colMenuShow = ref(false)
  const rowMenuIndex = ref<number | null>(null)
  const colMenuIndex = ref<number | null>(null)

  function emitMenuOpenChange() {
    const open = rowMenuShow.value || colMenuShow.value
    options.onMenuOpenChange?.(open)
    if (open) setTableBubbleSuppressed(true)
  }

  function getEditorView(editor = getEditor()): Editor['view'] | null {
    try {
      return editor?.view ?? null
    } catch {
      return null
    }
  }

  function getEditorDom(editor = getEditor()): HTMLElement | null {
    try {
      return getEditorView(editor)?.dom ?? null
    } catch {
      return null
    }
  }

  function getEditorRoot(editor = getEditor()): HTMLElement | null {
    return getEditorDom(editor)?.closest('.tvp-editor') as HTMLElement | null
  }

  function setTableBubbleSuppressed(suppressed: boolean) {
    const editorRoot = getEditorRoot()
    if (suppressed) editorRoot?.setAttribute('data-table-grip-suppress-bubble', 'true')
    else editorRoot?.removeAttribute('data-table-grip-suppress-bubble')
  }

  function clearTableBubbleSuppress() {
    if (rowMenuShow.value || colMenuShow.value) return
    setTableBubbleSuppressed(false)
  }

  const hasEditor = computed(() => !!getEditorDom() && !!getScrollContainer())

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
    debugLog?.('table', event, payload)
  }

  // 拿当前表格的 DOM 元素
  function getTableEl(): HTMLTableElement | null {
    if (activeTable) return activeTable
    const pos = getContext().tableState.value.tablePos
    if (pos == null) return null
    let node: HTMLElement | null = null
    try {
      node = getEditorView()?.nodeDOM(pos) as HTMLElement | null
    } catch {
      node = null
    }
    // nodeDOM 可能返回 table 本身或其包装(TableView 的 tableWrapper)
    return (node?.querySelector('table') as HTMLTableElement) ?? (node as HTMLTableElement)
  }

  // 计算抓手位置(position:fixed,坐标用视口坐标 getBoundingClientRect 直接用)。
  // fixed 浮层不受 content-wrap 的 overflow 裁剪,抓手能完整伸出表格左/上外侧。
  // 例外:抓手 DOM 链上若有 transform/contain 等祖先,它会取代视口成为 fixed 的
  // 包含块(CSS 规范),坐标须换算成相对该祖先——否则抓手整体偏移宿主布局偏移量。
  function updateGripPos() {
    const table = getTableEl()
    const scrollEl = getScrollContainer()
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
    const overlayHost = options.getOverlayHost?.() ?? getEditorRoot()
    const origin = resolveFixedOrigin(overlayHost)
    const pos: typeof gripPos.value = { rows: [], cols: [] }

    // 行抓手:fixed 定位,坐标直接用视口坐标(getBoundingClientRect 的返回值)
    const rows = Array.from(table.querySelectorAll('tr'))
    for (const [index, tr] of rows.entries()) {
      const r = tr.getBoundingClientRect()
      pos.rows.push({
        index,
        left: tableRect.left - origin.left - GRIP_SIZE - GRIP_GAP,
        top: r.top - origin.top,
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
          top: tableRect.top - origin.top - GRIP_SIZE - GRIP_GAP,
          left: c.left - origin.left,
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
    const editorDom = getEditorDom()
    if (!editorDom) return
    const target = e.target as HTMLElement
    const td = target.closest('td, th') as HTMLElement | null
    if (!td || !editorDom.contains(td)) return
    const tr = td.parentElement as HTMLTableRowElement
    const table = tr?.closest('table') as HTMLTableElement
    if (!table || !editorDom.contains(table)) return
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
    rowMenuIndex.value = index
    rowMenuCell = getCellAt(index, hoverCol.value ?? 0) ?? activeCell
    tableGripDebug('row-grip:lock', {
      rowIndex: rowMenuIndex.value,
      rowMenuCell: describeCell(rowMenuCell),
    })
  }

  function lockColGripTarget(index: number) {
    cancelHide()
    colMenuIndex.value = index
    colMenuCell = getCellAt(hoverRow.value ?? 0, index) ?? activeCell
    tableGripDebug('col-grip:lock', {
      colIndex: colMenuIndex.value,
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
    const ed = getEditor()
    const view = getEditorView(ed)
    if (!ed || !view || !getEditorDom(ed) || !cell) {
      tableGripDebug('focusCell:skip', { hasEditor: !!ed, cell: describeCell(cell) })
      return
    }
    const candidates: number[] = []
    const addCandidate = (pos: number | null | undefined) => {
      if (typeof pos === 'number' && Number.isFinite(pos)) candidates.push(pos)
    }
    const addDomPos = (node: Node, offset: number, deltas: number[] = [0]) => {
      try {
        const base = view.posAtDOM(node, offset)
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
    const hit = view.posAtCoords({
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
  function focusAndSelectRow() {
    focusCell(rowMenuCell)
    getContext().commands.selectRow(rowMenuIndex.value ?? describeCell(rowMenuCell)?.rowIndex ?? undefined)
  }
  function focusAndSelectCol() {
    focusCell(colMenuCell)
    getContext().commands.selectColumn(colMenuIndex.value ?? describeCell(colMenuCell)?.colIndex ?? undefined)
  }

  function onRowMenuShow(visible: boolean, index?: number) {
    if (!visible && index != null && rowMenuIndex.value != null && rowMenuIndex.value !== index) return
    rowMenuShow.value = visible
    emitMenuOpenChange()
    if (visible) {
      if (index != null) lockRowGripTarget(index)
      rowMenuCell = rowMenuCell ?? activeCell
      rowMenuIndex.value = rowMenuIndex.value ?? describeCell(rowMenuCell)?.rowIndex ?? null
      tableGripDebug('row-menu:open', {
        activeCell: describeCell(activeCell),
        rowMenuCell: describeCell(rowMenuCell),
        rowMenuIndex: rowMenuIndex.value,
      })
      if (deferMenuOpen) {
        // antd 菜单关闭时序:先关另一菜单,rAF 后确认本菜单仍打开再落选区
        colMenuShow.value = false
        requestAnimationFrame(() => {
          if (!rowMenuShow.value) return
          focusAndSelectRow()
        })
      } else {
        focusAndSelectRow()
      }
    } else {
      tableGripDebug('row-menu:close')
    }
  }
  function onColMenuShow(visible: boolean, index?: number) {
    if (!visible && index != null && colMenuIndex.value != null && colMenuIndex.value !== index) return
    colMenuShow.value = visible
    emitMenuOpenChange()
    if (visible) {
      if (index != null) lockColGripTarget(index)
      colMenuCell = colMenuCell ?? activeCell
      colMenuIndex.value = colMenuIndex.value ?? describeCell(colMenuCell)?.colIndex ?? null
      tableGripDebug('col-menu:open', {
        activeCell: describeCell(activeCell),
        colMenuCell: describeCell(colMenuCell),
        colMenuIndex: colMenuIndex.value,
      })
      if (deferMenuOpen) {
        rowMenuShow.value = false
        requestAnimationFrame(() => {
          if (!colMenuShow.value) return
          focusAndSelectCol()
        })
      } else {
        focusAndSelectCol()
      }
    } else {
      tableGripDebug('col-menu:close')
    }
  }

  // 行菜单命令(作用于当前选中行)
  function runRowCmd(op: string) {
    const c = getContext().commands
    const cell = rowMenuCell ?? activeCell
    const targetCell = describeCell(cell)
    const targetRowIndex = rowMenuIndex.value ?? targetCell?.rowIndex ?? undefined
    tableGripDebug('row-command:start', {
      op,
      cell: targetCell,
      rowMenuIndex: rowMenuIndex.value,
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
        tableGripDebug('row-command:delete-run', { cell: targetCell, rowMenuIndex: rowMenuIndex.value })
        focusCell(cell)
        c.selectRow(targetRowIndex)
        c.deleteRow(targetRowIndex)
        rowMenuCell = null
        rowMenuIndex.value = null
      })
      return
    }
    else if (op === 'moveUp') c.moveRowUp()
    else if (op === 'moveDown') c.moveRowDown()
    rowMenuCell = null
    rowMenuIndex.value = null
    rowMenuShow.value = false
    emitMenuOpenChange()
    setTableBubbleSuppressed(true)
    clearHover()
  }
  function runColCmd(op: string) {
    const c = getContext().commands
    const cell = colMenuCell ?? activeCell
    const targetCell = describeCell(cell)
    const targetColIndex = colMenuIndex.value ?? targetCell?.colIndex ?? undefined
    tableGripDebug('col-command:start', {
      op,
      cell: targetCell,
      colMenuIndex: colMenuIndex.value,
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
        tableGripDebug('col-command:delete-run', { cell: targetCell, colMenuIndex: colMenuIndex.value })
        focusCell(cell)
        c.selectColumn(targetColIndex)
        c.deleteColumn(targetColIndex)
        colMenuCell = null
        colMenuIndex.value = null
      })
      return
    }
    else if (op === 'moveLeft') c.moveColumnLeft()
    else if (op === 'moveRight') c.moveColumnRight()
    colMenuCell = null
    colMenuIndex.value = null
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
    const ed = getEditor()
    scrollEl = getScrollContainer()
    if (!ed || !getEditorDom(ed)) return
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
    const editorRoot = getEditorRoot(activeEditor ?? undefined)
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
    rowMenuIndex.value = null
    colMenuIndex.value = null
  }

  return {
    hasEditor,
    hoverRow,
    hoverCol,
    activeGripPos,
    rowMenuShow,
    colMenuShow,
    rowMenuIndex,
    colMenuIndex,
    onRowGripEnter,
    onColGripEnter,
    lockRowGripTarget,
    lockColGripTarget,
    onRowMenuShow,
    onColMenuShow,
    runRowCmd,
    runColCmd,
    setup,
    teardown,
    refresh,
  }
}
