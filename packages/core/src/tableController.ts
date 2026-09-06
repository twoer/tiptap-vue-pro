import type { Editor as CoreEditor } from '@tiptap/core'
import {
  CellSelection,
  TableMap,
  moveTableColumn,
  moveTableRow,
} from '@tiptap/pm/tables'
import type { ProEditorDebugLogFn } from './debug'
import type { TableCellCoordinate } from './types'

/**
 * 表格控制器:飞书式抓手/移动/选区/删除命令的几何解析与执行单元。
 *
 * 从 useProEditor 中拆出的内聚模块——全部基于 ProseMirror state 计算,
 * 不读 DOM、不依赖 UI(符合 core 无 UI 边界);仅通过 `ed.view.dispatch`
 * 与链式命令写回编辑器。
 *
 * `lastKnownTablePos`/`lastPointerTableCell` 记住最近一次解析到的表格与
 * 单元格,用于选区落在表格外时的兜底定位(抓手菜单在表格外仍可操作
 * 最近聚焦的表格)。
 */
export interface TableControllerDeps {
  getEditor: () => CoreEditor | undefined
  debugLog: ProEditorDebugLogFn
}

export function createTableController(deps: TableControllerDeps) {
  const { getEditor, debugLog } = deps

  // ---- 表格几何解析(飞书式抓手/移动/选区命令共用)----
  // 解析当前选区所在表格的几何信息:table 节点、tableStart(doc 绝对 pos)、
  // TableMap、当前 cell 的行列索引 + doc 绝对 pos。
  // 全部基于 ProseMirror state 纯计算,不读 DOM。
  // 返回 null 表示选区不在表格内(命令静默失效,与 Tiptap 原生命令行为一致)。
  let lastKnownTablePos: number | null = null
  let lastPointerTableCell: { tableStart: number; row: number; col: number } | null = null

  const isTableCellNode = (n: { type: { name: string } }) =>
    n.type.name === 'tableCell' || n.type.name === 'tableHeader'

  function tableGeometryFromTablePos(tablePos: number | null, rowIndex = 0, colIndex = 0) {
    const ed = getEditor()
    if (!ed || tablePos == null) return null
    const tableNode = ed.state.doc.nodeAt(tablePos)
    if (!tableNode || tableNode.type.name !== 'table') return null
    const map = TableMap.get(tableNode)
    const row = Math.max(0, Math.min(rowIndex, map.height - 1))
    const col = Math.max(0, Math.min(colIndex, map.width - 1))
    const tableStart = tablePos + 1
    const cellRelPos = map.positionAt(row, col, tableNode)
    return {
      map,
      tableStart,
      rowCount: map.height,
      colCount: map.width,
      row,
      col,
      cellDocPos: tableStart + cellRelPos,
    }
  }

  function tableGeometryFromPos(pos: number) {
    const ed = getEditor()
    if (!ed) return null
    const doc = ed.state.doc
    const candidates = [pos, pos - 1, pos + 1]

    function geometryFromResolvedPos($pos: ReturnType<typeof doc.resolve>) {
      let cellDepth = -1
      let tableDepth = -1
      for (let d = $pos.depth; d > 0; d--) {
        const name = $pos.node(d).type.name
        if (cellDepth < 0 && isTableCellNode($pos.node(d))) cellDepth = d
        if (tableDepth < 0 && name === 'table') tableDepth = d
      }
      if (cellDepth >= 0 && tableDepth >= 0) {
        const tableNode = $pos.node(tableDepth)
        const tableStart = $pos.start(tableDepth)
        const map = TableMap.get(tableNode)
        const cellRelPos = $pos.before(cellDepth) - tableStart
        const rect = map.findCell(cellRelPos)
        lastKnownTablePos = tableStart - 1
        return {
          map,
          tableStart,
          rowCount: map.height,
          colCount: map.width,
          row: rect.top,
          col: rect.left,
          cellDocPos: tableStart + cellRelPos,
        }
      }

      // CellSelection stores $anchorCell/$headCell at the position before a cell.
      // That boundary is not "inside" the cell, so read nodeAfter before trying
      // adjacent fallback positions; otherwise a selected column can be mistaken
      // for the cell on its left.
      if ($pos.nodeAfter && isTableCellNode($pos.nodeAfter)) {
        const rowDepth = $pos.depth
        if (rowDepth > 0 && $pos.node(rowDepth).type.name === 'tableRow') {
          const boundaryTableDepth = rowDepth - 1
          if (boundaryTableDepth > 0 && $pos.node(boundaryTableDepth).type.name === 'table') {
            const tableNode = $pos.node(boundaryTableDepth)
            const tableStart = $pos.start(boundaryTableDepth)
            const map = TableMap.get(tableNode)
            const cellRelPos = $pos.pos - tableStart
            const rect = map.findCell(cellRelPos)
            lastKnownTablePos = tableStart - 1
            return {
              map,
              tableStart,
              rowCount: map.height,
              colCount: map.width,
              row: rect.top,
              col: rect.left,
              cellDocPos: tableStart + cellRelPos,
            }
          }
        }
      }

      return null
    }

    for (const rawPos of candidates) {
      if (rawPos < 0 || rawPos > doc.content.size) continue
      const geometry = geometryFromResolvedPos(doc.resolve(rawPos))
      if (geometry) return geometry
    }

    return null
  }

  function tableGeometry(axis?: 'row' | 'col', targetIndex?: number) {
    const ed = getEditor()
    if (!ed) return null
    const sel = ed.state.selection
    // 选区可能是 CellSelection(多选,$anchorCell/$headCell)或普通选区($from)。
    // 统一用 $anchorCell 或 $from 反查所在 cell。
    const anySel = sel as unknown as {
      $anchorCell?: { pos: number }
      $headCell?: { pos: number }
    }
    const anchorPos = anySel.$anchorCell?.pos ?? sel.$from.pos
    // 解析 $pos,沿节点链找 cell + table,记录各自 depth。
    // tryResolve:若传入 pos 恰好落在节点边界(不在 cell 内容内),退一格再解析。
    function resolveInfo(pos: number) {
      const $pos = ed!.state.doc.resolve(pos)
      let cellDepth = -1
      let tableDepth = -1
      for (let d = $pos.depth; d > 0; d--) {
        const name = $pos.node(d).type.name
        if (cellDepth < 0 && isTableCellNode($pos.node(d))) cellDepth = d
        if (tableDepth < 0 && name === 'table') tableDepth = d
      }
      return { $pos, cellDepth, tableDepth }
    }
    let { $pos: $cell, cellDepth, tableDepth } = resolveInfo(anchorPos)
    if (cellDepth < 0 && $cell.nodeAfter && isTableCellNode($cell.nodeAfter)) {
      const rowDepth = $cell.depth
      if (rowDepth > 0 && $cell.node(rowDepth).type.name === 'tableRow') {
        tableDepth = rowDepth - 1
        if (tableDepth > 0 && $cell.node(tableDepth).type.name === 'table') {
          const tableNode = $cell.node(tableDepth)
          const tableStart = $cell.start(tableDepth)
          lastKnownTablePos = tableStart - 1
          const map = TableMap.get(tableNode)
          const cellRelPos = $cell.pos - tableStart
          const rect = map.findCell(cellRelPos)
          return {
            map,
            tableStart,
            rowCount: map.height,
            colCount: map.width,
            row: rect.top,
            col: rect.left,
            cellDocPos: tableStart + cellRelPos,
          }
        }
      }
    }
    // 边界情况:pos 落在 cell 外,退一格重试
    if (cellDepth < 0 && anchorPos > 0) {
      ({ $pos: $cell, cellDepth, tableDepth } = resolveInfo(anchorPos - 1))
    }
    if (cellDepth < 0 || tableDepth < 0) {
      if (!axis || typeof targetIndex !== 'number') return null
      const fallbackRow = axis === 'row' && typeof targetIndex === 'number' ? targetIndex : 0
      const fallbackCol = axis === 'col' && typeof targetIndex === 'number' ? targetIndex : 0
      return tableGeometryFromTablePos(lastKnownTablePos, fallbackRow, fallbackCol)
    }

    const tableNode = $cell.node(tableDepth)
    const tableStart = $cell.start(tableDepth) // table 内容区起始 pos(table pos + 1)
    lastKnownTablePos = tableStart - 1
    const map = TableMap.get(tableNode)
    // cell 节点在文档中的起始 pos,减 tableStart = 相对 table 内容区的 offset。
    const cellRelPos = $cell.before(cellDepth) - tableStart
    const rect = map.findCell(cellRelPos)
    return {
      map,
      tableStart,
      rowCount: map.height,
      colCount: map.width,
      row: rect.top,
      col: rect.left,
      // cell 节点的 doc 绝对 pos(moveTableRow 的 pos 参数需要)
      cellDocPos: tableStart + cellRelPos,
    }
  }

  // 移动当前行/列。dir: -1 上/左,+1 下/右。越界时 moveTableRow/Column 内部静默返回。
  function moveRow(dir: -1 | 1) {
    const g = tableGeometry()
    if (!g) {
      debugLog('table', 'move-line:no-geometry', { axis: 'row', dir })
      return
    }
    const ed = getEditor()!
    const to = g.row + dir
    if (to < 0 || to >= g.rowCount) {
      debugLog('table', 'move-line:out-of-range', { axis: 'row', from: g.row, to, rowCount: g.rowCount })
      return
    }
    moveTableRow({ from: g.row, to, pos: g.cellDocPos })(
      ed.state,
      (tr) => ed.view.dispatch(tr),
    )
    debugLog('table', 'move-line', { axis: 'row', from: g.row, to })
  }
  function moveColumn(dir: -1 | 1) {
    const g = tableGeometry()
    if (!g) {
      debugLog('table', 'move-line:no-geometry', { axis: 'col', dir })
      return
    }
    const ed = getEditor()!
    const to = g.col + dir
    if (to < 0 || to >= g.colCount) {
      debugLog('table', 'move-line:out-of-range', { axis: 'col', from: g.col, to, colCount: g.colCount })
      return
    }
    moveTableColumn({ from: g.col, to, pos: g.cellDocPos })(
      ed.state,
      (tr) => ed.view.dispatch(tr),
    )
    debugLog('table', 'move-line', { axis: 'col', from: g.col, to })
  }

  // 选中整行/整列(飞书式抓手点击)。用 CellSelection.rowSelection/colSelection,
  // 传入该行/列首尾 cell 的 ResolvedPos,自动扩展为整行/整列选区。
  function selectLine(axis: 'row' | 'col', targetIndex?: number) {
    const g = tableGeometry(axis, targetIndex)
    if (!g) {
      debugLog('table', 'select-line:no-geometry', { axis, targetIndex, ok: false })
      return false
    }
    const ed = getEditor()!
    const { map, tableStart, row, col } = g
    const targetRow = axis === 'row' && typeof targetIndex === 'number' ? targetIndex : row
    const targetCol = axis === 'col' && typeof targetIndex === 'number' ? targetIndex : col
    if (targetRow < 0 || targetRow >= map.height || targetCol < 0 || targetCol >= map.width) {
      debugLog('table', 'select-line:out-of-range', {
        axis,
        targetIndex,
        targetRow,
        targetCol,
        rowCount: map.height,
        colCount: map.width,
        ok: false,
      })
      return false
    }
    // 算出该行/列首尾 cell 的相对 pos,转 doc 绝对 pos 后 resolve。
    const firstRel = axis === 'row'
      ? map.positionAt(targetRow, 0, ed.state.doc.nodeAt(tableStart - 1)!)
      : map.positionAt(0, targetCol, ed.state.doc.nodeAt(tableStart - 1)!)
    const lastRel = axis === 'row'
      ? map.positionAt(targetRow, map.width - 1, ed.state.doc.nodeAt(tableStart - 1)!)
      : map.positionAt(map.height - 1, targetCol, ed.state.doc.nodeAt(tableStart - 1)!)
    const $first = ed.state.doc.resolve(tableStart + firstRel)
    const $last = ed.state.doc.resolve(tableStart + lastRel)
    const cellSel = axis === 'row'
      ? CellSelection.rowSelection($first, $last)
      : CellSelection.colSelection($first, $last)
    ed.view.dispatch(ed.state.tr.setSelection(cellSel))
    debugLog('table', 'select-line', {
      axis,
      row,
      col,
      targetIndex,
      targetRow,
      targetCol,
      rowCount: g.rowCount,
      colCount: g.colCount,
      selection: ed.state.selection.constructor.name,
      ok: true,
    })
    return true
  }

  function selectCurrentTable() {
    const g = tableGeometry()
    const ed = getEditor()
    if (!g || !ed) {
      debugLog('table', 'select-table:no-geometry', { ok: false })
      return false
    }
    const tableNode = ed.state.doc.nodeAt(g.tableStart - 1)
    if (!tableNode || tableNode.type.name !== 'table') {
      debugLog('table', 'select-table:no-table-node', { ok: false })
      return false
    }
    const firstRel = g.map.positionAt(0, 0, tableNode)
    const lastRel = g.map.positionAt(g.map.height - 1, g.map.width - 1, tableNode)
    const cellSel = CellSelection.create(
      ed.state.doc,
      g.tableStart + firstRel,
      g.tableStart + lastRel,
    )
    ed.view.dispatch(ed.state.tr.setSelection(cellSel).scrollIntoView())
    debugLog('table', 'select-table', {
      rowCount: g.rowCount,
      colCount: g.colCount,
      ok: true,
    })
    return true
  }

  function selectCellRange(anchor: TableCellCoordinate, head: TableCellCoordinate, tablePos?: number | null) {
    const current = tableGeometry()
    const g = tableGeometryFromTablePos(
      tablePos ?? (current ? current.tableStart - 1 : lastKnownTablePos),
      anchor.row,
      anchor.col,
    )
    const ed = getEditor()
    if (!g || !ed) {
      debugLog('table', 'select-cell-range:no-geometry', { anchor, head, ok: false })
      return false
    }
    const tableNode = ed.state.doc.nodeAt(g.tableStart - 1)
    if (!tableNode || tableNode.type.name !== 'table') {
      debugLog('table', 'select-cell-range:no-table-node', { anchor, head, ok: false })
      return false
    }
    const anchorRow = Math.max(0, Math.min(anchor.row, g.map.height - 1))
    const anchorCol = Math.max(0, Math.min(anchor.col, g.map.width - 1))
    const headRow = Math.max(0, Math.min(head.row, g.map.height - 1))
    const headCol = Math.max(0, Math.min(head.col, g.map.width - 1))
    const anchorRel = g.map.positionAt(anchorRow, anchorCol, tableNode)
    const headRel = g.map.positionAt(headRow, headCol, tableNode)
    const cellSel = CellSelection.create(
      ed.state.doc,
      g.tableStart + anchorRel,
      g.tableStart + headRel,
    )
    ed.view.dispatch(ed.state.tr.setSelection(cellSel).scrollIntoView())
    debugLog('table', 'select-cell-range', {
      anchor: { row: anchorRow, col: anchorCol },
      head: { row: headRow, col: headCol },
      selectedRows: Math.abs(headRow - anchorRow) + 1,
      selectedCols: Math.abs(headCol - anchorCol) + 1,
      ok: true,
    })
    return true
  }

  function selectCellRangeFromClick(pos: number, event: MouseEvent) {
    const anchor = tableGeometry() ?? lastPointerTableCell
    const head = tableGeometryFromPos(pos)
    if (!anchor || !head || anchor.tableStart !== head.tableStart) {
      debugLog('table', 'select-cell-range:click-skip', {
        pos,
        hasAnchor: !!anchor,
        hasHead: !!head,
        sameTable: !!anchor && !!head && anchor.tableStart === head.tableStart,
      })
      return false
    }
    const selected = selectCellRange(
      { row: anchor.row, col: anchor.col },
      { row: head.row, col: head.col },
      anchor.tableStart - 1,
    )
    if (selected) event.preventDefault()
    return selected
  }

  function selectCellRangeFromMouseDown(view: unknown, event: MouseEvent) {
    const anchor = tableGeometry() ?? lastPointerTableCell
    const head = pointerTableGeometry(view, event)
    if (!anchor || !head || anchor.tableStart !== head.tableStart) {
      debugLog('table', 'select-cell-range:mousedown-skip', {
        hasAnchor: !!anchor,
        hasHead: !!head,
        sameTable: !!anchor && !!head && anchor.tableStart === head.tableStart,
      })
      return false
    }
    const selected = selectCellRange(
      { row: anchor.row, col: anchor.col },
      { row: head.row, col: head.col },
      anchor.tableStart - 1,
    )
    if (selected) event.preventDefault()
    return selected
  }

  function pointerTableGeometry(view: unknown, event: MouseEvent) {
    const posAtCoords = (view as {
      posAtCoords?: (coords: { left: number; top: number }) => { pos: number } | null
    }).posAtCoords
    let target: { pos: number } | null | undefined
    try {
      target = posAtCoords?.call(view, { left: event.clientX, top: event.clientY })
    } catch (error) {
      debugLog('table', 'select-cell-range:pos-at-coords-error', {
        clientX: event.clientX,
        clientY: event.clientY,
      }, 'warn', error)
      return null
    }
    if (!target) {
      debugLog('table', 'select-cell-range:no-pos-at-coords', {
        clientX: event.clientX,
        clientY: event.clientY,
      })
      return null
    }
    return tableGeometryFromPos(target.pos)
  }

  function rememberPointerTableCell(view: unknown, event: MouseEvent) {
    const g = pointerTableGeometry(view, event)
    if (!g) return
    lastPointerTableCell = { tableStart: g.tableStart, row: g.row, col: g.col }
    debugLog('table', 'remember-pointer-cell', {
      row: g.row,
      col: g.col,
    })
  }

  function isSelectAllShortcut(event: KeyboardEvent) {
    return event.key.toLowerCase() === 'a' &&
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey
  }

  function deleteLine(axis: 'row' | 'col', targetIndex?: number) {
    const ed = getEditor()
    if (!ed) {
      debugLog('table', 'delete-line:no-editor', { axis, targetIndex, ok: false })
      return
    }
    const before = tableGeometry(axis, targetIndex)
    debugLog('table', 'delete-line:start', {
      axis,
      targetIndex,
      before,
      selection: ed.state.selection.constructor.name,
    })
    const selected = before ? selectLine(axis, targetIndex) : false
    const shouldDeleteTable = selected && (
      (axis === 'row' && before!.rowCount <= 1) ||
      (axis === 'col' && before!.colCount <= 1)
    )
    const ok = shouldDeleteTable
      ? ed.chain().focus().deleteTable().run()
      : axis === 'row'
        ? ed.chain().focus().deleteRow().run()
        : ed.chain().focus().deleteColumn().run()
    const after = tableGeometry()
    debugLog('table', 'delete-line', {
      axis,
      targetIndex,
      deletedTable: shouldDeleteTable,
      ok,
      after,
      selection: ed.state.selection.constructor.name,
    })
  }

  return {
    tableGeometry,
    moveRow,
    moveColumn,
    selectLine,
    selectCurrentTable,
    selectCellRange,
    selectCellRangeFromClick,
    selectCellRangeFromMouseDown,
    rememberPointerTableCell,
    isSelectAllShortcut,
    deleteLine,
  }
}

export type TableController = ReturnType<typeof createTableController>
