import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useEditor, type Editor } from '@tiptap/vue-3'
import { isNodeSelection, type Editor as CoreEditor } from '@tiptap/core'
// 飞书式表格移动/选区命令所需的 prosemirror-tables API。
// 走 @tiptap/pm/tables(core 已依赖 @tiptap/pm),不引入新包;
// 这些都是纯逻辑函数(不操作 DOM、不依赖 UI),符合 core 无 UI 边界。
import {
  CellSelection,
  TableMap,
  moveTableRow,
  moveTableColumn,
} from '@tiptap/pm/tables'
import { TextSelection } from '@tiptap/pm/state'
import { createDefaultExtensions } from './extensions'
import { insertHorizontalRule } from './extensions/horizontalRule'
import { detectFileAttachmentIcon } from './extensions/media'
import { EMPTY_FIND_REPLACE_STATE } from './findReplace'
import { getSelectedMediaNode } from './mediaSelection'
import { getMarkdown, importMarkdown } from './markdown'
import { resolveEditorBehaviorOptions, type EditorFileRenderOptions } from './editorBehaviorOptions'
import {
  notifyImageFileValidationFailure,
  validateImageFile,
} from './handleImageUpload'
import {
  normalizeUploadedAsset,
  notifyAssetFileValidationFailure,
  notifyAssetUploadFailure,
  validateAssetFile,
} from './handleAssetUpload'
import { resolveLocale } from './locale'
import { createDebugLogger } from './debug'
import type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
  NotifyFn,
  TableState,
  TableCellCoordinate,
  UploadedAsset,
} from './types'
import type { ProEditorDebugLogFn } from './debug'

function contentLength(value: unknown) {
  if (typeof value === 'string') return value.length
  try {
    return JSON.stringify(value ?? null).length
  } catch {
    return 0
  }
}

function selectionDebugPayload(ed: CoreEditor) {
  const selection = ed.state.selection
  return {
    from: selection.from,
    to: selection.to,
    empty: selection.empty,
    type: selection.constructor.name,
  }
}

function summarizeCommandArgs(args: unknown[]) {
  return args.map((arg) => {
    if (typeof File !== 'undefined' && arg instanceof File) {
      return {
        fileName: arg.name,
        fileSize: arg.size,
        mimeType: arg.type,
      }
    }
    if (typeof arg === 'string') {
      return { type: 'string', length: arg.length }
    }
    if (arg && typeof arg === 'object') return '[object]'
    return arg
  })
}

/**
 * Tiptap Vue Pro 的核心 composable。
 *
 * 职责:
 * 1. 通过官方 useEditor 创建编辑器实例(必须用 useEditor,不能用 new Editor,
 *    否则 vue-3 的 Editor 在构造时 reactiveState 初始化会崩)
 * 2. 实现 v-model 双向绑定(支持 html / json 两种输出)
 * 3. 聚合命令对象 commands,供工具栏按钮直接调用
 * 4. 处理图片上传(从 File 到 url 再到文档插入)
 * 5. 字数统计、只读切换
 *
 * 不做的事(故意下推给 adapter):
 * - 任何 DOM 渲染、UI 组件
 * - toast / message 提示(上传失败等由 adapter 用各自 UI 库展示)
 *
 * 用法:adapter 组件在 setup 里调用此 composable,把返回的 editor 传给 EditorContent。
 */
export function useProEditor(options: ProEditorOptions): ProEditorContext {
  const {
    content,
    extensions,
    placeholder,
    uploadImage,
    uploadAsset,
    editable = true,
    editorProps,
    notify,
    immediatelyRender = false,
  } = options

  const debugLog: ProEditorDebugLogFn = (...args) => {
    createDebugLogger({
      debug: options.debug,
      debugLogger: options.debugLogger,
      source: 'core',
    })(...args)
  }
  const getOutput = () => options.output ?? 'html'
  const getBehaviorOptions = () => resolveEditorBehaviorOptions(options.editorBehaviorOptions)
  const resolvedLocale = computed(() => resolveLocale(options.locale))
  const findReplaceState = ref(EMPTY_FIND_REPLACE_STATE)
  const t = ((key, paramsOrFallback, fallback) =>
    resolvedLocale.value.t(key, paramsOrFallback, fallback)) as ReturnType<typeof resolveLocale>['t']
  const exts = extensions ?? createDefaultExtensions(
    placeholder ?? t('placeholder.default'),
    {},
    {
      fileAttachment: { fileTypeLabel: localizedFileTypeText },
      slashCommand: options.slashCommand === false ? undefined : options.slashCommand,
      findReplace: {
        onUpdate: (state) => {
          findReplaceState.value = state
        },
      },
    },
  )

  // ---- 通过官方 useEditor 创建实例 ----
  // 注意:useEditor 内部用 Vue 生命周期管理 Editor,返回 Ref<Editor | undefined>
  debugLog('lifecycle', 'init', { editable, output: getOutput(), immediatelyRender })
  const userHandleKeyDown = typeof editorProps?.handleKeyDown === 'function'
    ? editorProps.handleKeyDown as (view: unknown, event: KeyboardEvent) => boolean
    : undefined
  const userHandleClick = typeof editorProps?.handleClick === 'function'
    ? editorProps.handleClick as (view: unknown, pos: number, event: MouseEvent) => boolean
    : undefined
  const userHandleDOMEvents = (editorProps?.handleDOMEvents && typeof editorProps.handleDOMEvents === 'object')
    ? editorProps.handleDOMEvents as Record<string, (view: unknown, event: Event) => boolean>
    : undefined
  const resolvedEditorProps = {
    ...(editorProps ?? {}),
    handleDOMEvents: {
      ...(userHandleDOMEvents ?? {}),
      mousedown: (view: unknown, event: Event) => {
        if (userHandleDOMEvents?.mousedown?.(view, event)) return true
        if (event instanceof MouseEvent && event.shiftKey) {
          debugLog('table', 'shift-mousedown', {
            clientX: event.clientX,
            clientY: event.clientY,
          })
          return selectCellRangeFromMouseDown(view, event)
        }
        if (event instanceof MouseEvent) rememberPointerTableCell(view, event)
        return false
      },
    },
    handleKeyDown: (view: unknown, event: KeyboardEvent) => {
      if (userHandleKeyDown?.(view, event)) return true
      if (isSelectAllShortcut(event)) return selectCurrentTable()
      return false
    },
    handleClick: (view: unknown, pos: number, event: MouseEvent) => {
      if (userHandleClick?.(view, pos, event)) return true
      if (event.shiftKey) return selectCellRangeFromClick(pos, event)
      return false
    },
  }
  const editorOptions = {
    extensions: exts,
    content: content as never,
    editable,
    immediatelyRender,
    editorProps: resolvedEditorProps,
    onUpdate: ({ editor: ed }: { editor: CoreEditor }) => {
      isUpdatingFromEditor = true
      emitValue(ed)
      syncWordCount(ed)
    },
    onSelectionUpdate: ({ editor: ed }: { editor: CoreEditor }) => {
      debugLog('selection', 'update', selectionDebugPayload(ed))
    },
    onTransaction: ({ transaction }: { transaction: {
      docChanged?: boolean
      selectionSet?: boolean
      steps?: unknown[]
    } }) => {
      debugLog('transaction', 'apply', {
        docChanged: !!transaction.docChanged,
        selectionSet: !!transaction.selectionSet,
        steps: transaction.steps?.length ?? 0,
      })
    },
  }
  const editor = useEditor(editorOptions as Parameters<typeof useEditor>[0])

  const loaded = computed(() => !!editor.value)
  const wordCount = ref({ characters: 0, words: 0 })

  // 防止 v-model 回写触发内容重置导致的循环
  let isUpdatingFromEditor = false

  // ---- 字数统计 ----
  function syncWordCount(ed: CoreEditor) {
    const storage = ed.storage as any
    const cc = storage.characterCount
    if (cc) {
      wordCount.value = {
        characters: cc.characters?.() ?? 0,
        words: cc.words?.() ?? 0,
      }
    }
  }

  // 编辑器就绪后初始化字数
  watch(
    () => editor.value,
    (ed) => {
      if (ed) {
        debugLog('lifecycle', 'editor-ready', { hasEditor: true })
        syncWordCount(ed)
      }
    },
    { immediate: true },
  )

  // ---- v-model 双向绑定 ----
  function emitValue(ed: CoreEditor) {
    const output = getOutput()
    const val = output === 'html' ? ed.getHTML() : ed.getJSON()
    // 通过 setter 回写(由 adapter 组件把 content setter 接到 v-model)
    options.content = val
    debugLog('content', 'update', {
      output,
      contentLength: contentLength(val),
    })
  }

  // 外部值变化 → 写入编辑器(跳过编辑器自己触发的回写)
  //
  // 去重:只有当外部值与编辑器当前内容「实质不同」时才 setContent,避免循环。
  // html 模式直接字符串比较;json 模式按序列化后的字符串比较
  // (对象引用比较不可靠,JSON.stringify 保证语义一致)。
  watch(
    () => options.content,
    (next) => {
      if (isUpdatingFromEditor) {
        isUpdatingFromEditor = false
        return
      }
      const ed = editor.value
      if (!ed) return
      const output = getOutput()
      const incoming =
        output === 'json' ? JSON.stringify(next ?? null) : (next as string)
      const current =
        output === 'json'
          ? JSON.stringify(ed.getJSON())
          : ed.getHTML()
      if (incoming === current) return
      debugLog('content', 'external-sync', {
        output,
        contentLength: contentLength(next),
      })
      ed.commands.setContent(next ?? '', { emitUpdate: false })
    },
  )

  // ---- 命令聚合 ----
  function cmd(): Editor | undefined {
    return editor.value
  }

  type TypographyChain = ReturnType<Editor['chain']> & {
    setFontFamily: (value: string) => TypographyChain
    unsetFontFamily: () => TypographyChain
    setFontSize: (value: string) => TypographyChain
    unsetFontSize: () => TypographyChain
    setLineHeight: (value: string) => TypographyChain
    unsetLineHeight: () => TypographyChain
  }

  function typographyChain(): TypographyChain | undefined {
    return cmd()?.chain().focus() as TypographyChain | undefined
  }

  function inList(ed: Editor | CoreEditor) {
    return ed.isActive('bulletList') || ed.isActive('orderedList') || ed.isActive('taskList')
  }

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
    const ed = editor.value
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
    const ed = editor.value
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
    const ed = editor.value
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
    const ed = editor.value!
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
    const ed = editor.value!
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
    const ed = editor.value!
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
    const ed = editor.value
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
    const ed = editor.value
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
    const ed = editor.value
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

  /**
   * 判断当前选区是否「选中了一个图片节点」。
   *
   * 点击图片会进入 ProseMirror 的 NodeSelection(整节点选中)。图片对齐/尺寸/题注/
   * 删除命令只应在这种状态下生效——光标在文字里时这些命令是 no-op。
   * 用 isNodeSelection type guard 收窄类型,再核对节点类型名。
   */
  function isImageSelected(ed: Editor | CoreEditor): boolean {
    const sel = ed.state.selection
    return isNodeSelection(sel) && sel.node.type.name === 'image'
  }

  function selectedMediaType(ed: Editor | CoreEditor): 'video' | 'audio' | null {
    const media = getSelectedMediaNode(ed as CoreEditor)
    return media?.type ?? null
  }

  // ---- 消息提示 ----
  // adapter 注入的 UI 库实现;未注入时静默(no-op),保证 headless 场景不崩。
  // 放在 commands 之前,因为 uploadAndInsertImage 等命令内部会调用它。
  const notifyFn: NotifyFn = notify ?? (() => {})

  function normalizeAssetForNode(asset: UploadedAsset | string): UploadedAsset {
    if (typeof asset === 'string') return { url: asset }
    return {
      ...asset,
      uploadedAt: asset.uploadedAt instanceof Date
        ? asset.uploadedAt.toISOString()
        : asset.uploadedAt,
    }
  }

  function formatFileUploadedAt(
    value: UploadedAsset['uploadedAt'],
    format: EditorFileRenderOptions['uploadedAtFormat'],
  ) {
    if (value == null || value === '') return ''
    if (typeof format === 'function') return format(value)
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (n: number) => String(n).padStart(2, '0')
    const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    if (format === 'date') return datePart
    return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function formatFileDuration(
    value: UploadedAsset['duration'],
    format: EditorFileRenderOptions['durationFormat'],
  ) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return ''
    if (typeof format === 'function') return format(value)
    return ''
  }

  function localizedFileTypeText(attrs: Record<string, unknown>) {
    const fileTypeText = String(attrs.fileTypeText ?? '')
    if (fileTypeText) return fileTypeText
    const icon = detectFileAttachmentIcon({
      name: attrs.name,
      href: attrs.href,
      mimeType: attrs.mimeType ?? '',
      mediaKind: attrs.mediaKind,
    })
    const name = String(attrs.name ?? attrs.href ?? '').toLowerCase()
    if (icon === 'pdf') return 'PDF'
    if (icon === 'doc') return 'Word'
    if (icon === 'sheet') return name.endsWith('.csv') ? 'CSV' : 'Excel'
    if (icon === 'slide') return 'PPT'
    if (icon === 'archive') return t('file.type.archive')
    if (icon === 'image') return t('file.type.image')
    if (icon === 'video') return t('file.type.video')
    if (icon === 'audio') return t('file.type.audio')
    if (icon === 'text') return t('file.type.text')
    if (icon === 'code') return t('file.type.code')
    const subtype = String(attrs.mimeType ?? '').split('/')[1]?.split(';')[0]
    return subtype ? subtype.toUpperCase() : t('file.type.file')
  }

  function insertFileAsset(
    asset: UploadedAsset | string,
    mediaKind: 'video' | 'audio' | 'file' = 'file',
  ) {
    const ed = cmd()
    if (!ed) return
    const normalized = normalizeAssetForNode(asset)
    const render = getBehaviorOptions().media.file.render
    ed.chain().focus().insertContent({
      type: 'fileAttachment',
      attrs: {
        href: normalized.url,
        name: normalized.name ?? normalized.url,
        size: normalized.size ?? null,
        mimeType: normalized.mimeType ?? '',
        mediaKind,
        uploadedAt: normalized.uploadedAt ?? '',
        uploadedAtText: formatFileUploadedAt(normalized.uploadedAt, render.uploadedAtFormat),
        duration: normalized.duration ?? null,
        durationText: formatFileDuration(normalized.duration, render.durationFormat),
        fileTypeText: localizedFileTypeText({
          name: normalized.name ?? normalized.url,
          href: normalized.url,
          mimeType: normalized.mimeType ?? '',
          mediaKind,
          fileTypeText: normalized.fileTypeText,
        }),
        showIcon: render.showIcon,
        iconMode: render.iconMode,
        showName: render.showName,
        showSize: render.showSize,
        showMimeType: render.showMimeType,
        showUploadedAt: render.showUploadedAt,
        showDuration: render.showDuration,
        openInNewTab: render.openInNewTab,
        download: render.download,
      },
    }).scrollIntoView().run()
  }

  function insertVideoAsset(asset: UploadedAsset | string) {
    const ed = cmd()
    if (!ed) return
    const normalized = normalizeAssetForNode(asset)
    const render = getBehaviorOptions().media.video.render
    if (render.displayMode === 'file') {
      insertFileAsset(normalized, 'video')
      return
    }
    const poster = typeof render.poster === 'function'
      ? render.poster(normalized)
      : render.poster ?? normalized.poster ?? ''
    ed.chain().focus().insertContent({
      type: 'video',
      attrs: {
        src: normalized.url,
        name: normalized.name ?? '',
        mimeType: normalized.mimeType ?? '',
        poster,
        duration: normalized.duration ?? null,
        controls: render.controls,
        muted: render.muted,
        loop: render.loop,
        autoplay: render.autoplay,
        playsInline: render.playsInline,
        preload: render.preload,
        allowFullscreen: render.allowFullscreen,
        allowDownload: render.allowDownload,
        allowPictureInPicture: render.allowPictureInPicture,
        width: render.width ?? null,
      },
    }).scrollIntoView().run()
  }

  function insertAudioAsset(asset: UploadedAsset | string) {
    const ed = cmd()
    if (!ed) return
    const normalized = normalizeAssetForNode(asset)
    const render = getBehaviorOptions().media.audio.render
    if (render.displayMode === 'file') {
      insertFileAsset(normalized, 'audio')
      return
    }
    ed.chain().focus().insertContent({
      type: 'audio',
      attrs: {
        src: normalized.url,
        name: normalized.name ?? '',
        mimeType: normalized.mimeType ?? '',
        duration: normalized.duration ?? null,
        controls: render.controls,
        muted: render.muted,
        loop: render.loop,
        autoplay: render.autoplay,
        preload: render.preload,
        allowDownload: render.allowDownload,
        width: render.width ?? null,
      },
    }).scrollIntoView().run()
  }

  async function uploadAndInsertAsset(
    file: File,
    kind: 'video' | 'audio' | 'file',
    insert: (asset: UploadedAsset) => void,
  ) {
    if (!uploadAsset) return
    const ed = cmd()
    if (!ed) return
    const mediaOptions = getBehaviorOptions().media[kind]
    const validationFailure = validateAssetFile(file, kind, mediaOptions)
    if (validationFailure) {
      notifyAssetFileValidationFailure({ notify: notifyFn, t }, validationFailure)
      return
    }
    debugLog('upload', 'asset:start', {
      kind,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, 'info')
    try {
      const result = await uploadAsset(file, kind)
      if (result) {
        const normalized = normalizeUploadedAsset(result, file)
        debugLog('upload', 'asset:success', {
          kind,
          fileName: file.name,
          url: normalized.url,
        }, 'info')
        insert(normalized)
        return
      }
      debugLog('upload', 'asset:error', { kind, fileName: file.name }, 'error')
      notifyAssetUploadFailure(notifyFn, t, kind)
    } catch (error) {
      debugLog('upload', 'asset:error', { kind, fileName: file.name }, 'error', error)
      notifyAssetUploadFailure(notifyFn, t, kind)
    }
  }

  const rawCommands: ProEditorCommands = {
    undo: () => cmd()?.chain().focus().undo().run(),
    redo: () => cmd()?.chain().focus().redo().run(),
    bold: () => cmd()?.chain().focus().toggleBold().run(),
    italic: () => cmd()?.chain().focus().toggleItalic().run(),
    strike: () => cmd()?.chain().focus().toggleStrike().run(),
    code: () => cmd()?.chain().focus().toggleCode().run(),
    superscript: () => cmd()?.chain().focus().toggleSuperscript().run(),
    subscript: () => cmd()?.chain().focus().toggleSubscript().run(),
    toggleHeading: (level) => {
      const ed = cmd()
      if (!ed) return
      if (level === 0) {
        ed.chain().focus().setParagraph().run()
      } else {
        ed.chain().focus().toggleHeading({ level }).run()
      }
    },
    bulletList: () => cmd()?.chain().focus().toggleBulletList().run(),
    orderedList: () => cmd()?.chain().focus().toggleOrderedList().run(),
    increaseIndent: () => {
      const ed = cmd()
      if (!ed) return
      if (inList(ed)) {
        const chain = ed.chain().focus() as any
        if (ed.isActive('taskList')) chain.sinkListItem('taskItem').run()
        else chain.sinkListItem('listItem').run()
        return
      }
      ;(ed.chain().focus() as any).increaseBlockIndent().run()
    },
    decreaseIndent: () => {
      const ed = cmd()
      if (!ed) return
      if (inList(ed)) {
        const chain = ed.chain().focus() as any
        if (ed.isActive('taskList')) chain.liftListItem('taskItem').run()
        else chain.liftListItem('listItem').run()
        return
      }
      ;(ed.chain().focus() as any).decreaseBlockIndent().run()
    },
    blockquote: () => cmd()?.chain().focus().toggleBlockquote().run(),
    codeBlock: (language) => {
      const chain = cmd()?.chain().focus()
      if (!chain) return
      if (language) {
        chain.setCodeBlock({ language }).run()
      } else {
        chain.toggleCodeBlock().run()
      }
    },
    setLink: (href, o) => {
      const ed = cmd()
      if (!ed) return
      const range = o?.range
      const target = o?.target ?? '_blank'
      // 空字符串 = 移除链接
      if (!href) {
        const selectionTo = range?.to ?? ed.state.selection.to
        const c = ed.chain().focus()
        if (range) c.setTextSelection(range)
        c.extendMarkRange('link').unsetLink().run()

        const linkMark = ed.schema.marks.link
        const pos = Math.min(Math.max(selectionTo, 0), ed.state.doc.content.size)
        const tr = ed.state.tr.setSelection(TextSelection.create(ed.state.doc, pos))
        if (linkMark) tr.removeStoredMark(linkMark)
        ed.view.dispatch(tr.scrollIntoView())
        return
      }
      // 显式给 range 时,先选到该 range 再 extendMarkRange + setLink,
      // 避免 dialog 失焦后 selection 漂移导致范围错位。
      const c = ed.chain().focus()
      if (range) c.setTextSelection(range)
      c.extendMarkRange('link').setLink({ href, target }).scrollIntoView().run()
    },
    /**
     * 在指定位置插入/替换一段带链接的文本。
     *
     * 用显式 from/to + insertContentAt,不依赖 .focus() 恢复 DOM selection——
     * 因为工具栏/弹窗确认时编辑器已失焦,ProseMirror 的 selection 可能已被
     * 扰乱,chain 内部的 focus 不保证回到正确位置。直接按保存的绝对位置写入
     * 最稳妥。
     *
     * - 光标(空 range)处 → 在该位置插入新文本
     * - 有 range → 用 text 替换该 range 内容并套链接
     * text 为空时回退用 href 作显示文字。
     * 末尾 scrollIntoView,确保插入后视口滚到结果处(尤其光标不在编辑器内时)。
     */
    insertLinkText: (href, text, o) => {
      const ed = cmd()
      if (!ed || !href) return
      const target = o?.target ?? '_blank'
      const label = text?.trim() || href
      const pos = o?.range ?? { from: ed.state.selection.from, to: ed.state.selection.to }
      ed.chain()
        .insertContentAt(pos, {
          type: 'text',
          text: label,
          marks: [{ type: 'link', attrs: { href, target } }],
        })
        .scrollIntoView()
        .run()
    },
    /**
     * 确保编辑器有可用光标位置。
     *
     * 场景:用户从未点进编辑器,直接点工具栏按钮插入内容。此时 ProseMirror
     * 的 selection 停在文档开头,插入到开头用户看不到 → 误以为「没插入」。
     * 此命令把光标移到文档末尾并聚焦,后续插入自然落在用户可视区。
     */
    ensureFocusAtEnd: () => {
      const ed = cmd()
      if (!ed) return
      const end = ed.state.doc.content.size
      ed.chain().focus().setTextSelection(end).scrollIntoView().run()
    },
    setImage: (src, alt) =>
      cmd()?.chain().focus().setImage({ src, alt }).scrollIntoView().run(),
    uploadAndInsertImage: async (file) => {
      if (!uploadImage) return
      const ed = cmd()
      if (!ed) return
      const validationFailure = validateImageFile(file, getBehaviorOptions().image)
      if (validationFailure) {
        notifyImageFileValidationFailure({ notify: notifyFn, t }, validationFailure)
        return
      }
      debugLog('upload', 'image:start', {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }, 'info')
      try {
        const url = await uploadImage(file)
        if (url) {
          debugLog('upload', 'image:success', { fileName: file.name, url }, 'info')
          ed.chain().focus().setImage({ src: url }).scrollIntoView().run()
        } else {
          // uploadImage 返回 null 视为失败(约定见 UploadImage 文档)
          debugLog('upload', 'image:error', { fileName: file.name }, 'error')
          notifyFn(t('notify.imageUploadFailed'), 'error')
        }
      } catch (error) {
        // 提示由 notify 负责(adapter 注入),Core 保持 UI 无关
        debugLog('upload', 'image:error', { fileName: file.name }, 'error', error)
        notifyFn(t('notify.imageUploadFailed'), 'error')
      }
    },
    insertVideo: insertVideoAsset,
    uploadAndInsertVideo: (file) => uploadAndInsertAsset(file, 'video', insertVideoAsset),
    insertAudio: insertAudioAsset,
    uploadAndInsertAudio: (file) => uploadAndInsertAsset(file, 'audio', insertAudioAsset),
    insertFile: (asset) => insertFileAsset(asset, 'file'),
    uploadAndInsertFile: (file) => uploadAndInsertAsset(file, 'file', (asset) => insertFileAsset(asset, 'file')),
    /**
     * 图片对齐/尺寸/题注/删除 —— 仅在当前是图片 NodeSelection 时生效。
     *
     * 这些命令不依赖工具条是否打开:NodeSelection 是 ProseMirror 的「整节点选中」
     * 状态(点击图片即进入),此时 updateAttributes 会作用到该图片节点。
     * 非图片选中态调用时静默 no-op,避免抛错干扰调用方。
     */
    setImageAlign: (align) => {
      const ed = cmd()
      if (!ed) return
      if (!isImageSelected(ed)) return
      ed.chain().focus().updateAttributes('image', { align }).run()
    },
    setImageSize: (preset) => {
      const ed = cmd()
      if (!ed || !isImageSelected(ed)) return
      if (preset === 'original') {
        // 清除宽度,回归自然尺寸(高度由比例自动)
        ed.chain().focus().updateAttributes('image', { width: null, height: null }).run()
        return
      }
      const ratio = preset === 'small' ? 0.25 : preset === 'medium' ? 0.5 : 0.75
      // 编辑器内容区宽度(ProseMirror 编辑区 element 的 clientWidth)
      const containerWidth = ed.view.dom.clientWidth || 0
      if (containerWidth <= 0) return
      ed.chain().focus().updateAttributes('image', { width: Math.round(containerWidth * ratio) }).run()
    },
    setMediaSize: (preset) => {
      const ed = cmd()
      if (!ed) return
      const type = selectedMediaType(ed)
      if (!type) return
      if (preset === 'original') {
        ed.chain().focus().updateAttributes(type, { width: null }).run()
        return
      }
      const ratio = preset === 'small' ? 0.25 : preset === 'medium' ? 0.5 : 0.75
      const containerWidth = ed.view.dom.clientWidth || 0
      if (containerWidth <= 0) return
      ed.chain().focus().updateAttributes(type, { width: Math.round(containerWidth * ratio) }).run()
    },
    setImageCaption: (caption) => {
      const ed = cmd()
      if (!ed || !isImageSelected(ed)) return
      ed.chain().focus().updateAttributes('image', { caption }).run()
    },
    removeImage: () => {
      const ed = cmd()
      if (!ed || !isImageSelected(ed)) return
      ed.chain().focus().deleteSelection().run()
    },
    insertTable: (rows = 3, cols = 3) =>
      cmd()?.chain().focus().insertTable({
        rows,
        cols,
        withHeaderRow: getBehaviorOptions().table.withHeaderRow,
      }).scrollIntoView().run(),
    // ---- 表格结构操作 ----
    // Tiptap TableKit 全部内置这些命令,这里只做转发。命令作用在当前选区(光标所在单元格),
    // adapter 的工具栏用 isActive('table') 判定后才显示对应按钮,所以无需在 core 判断场景。
    addRowBefore: () => cmd()?.chain().focus().addRowBefore().run(),
    addRowAfter: () => cmd()?.chain().focus().addRowAfter().run(),
    deleteRow: (rowIndex?: number) => deleteLine('row', rowIndex),
    addColumnBefore: () => cmd()?.chain().focus().addColumnBefore().run(),
    addColumnAfter: () => cmd()?.chain().focus().addColumnAfter().run(),
    deleteColumn: (columnIndex?: number) => deleteLine('col', columnIndex),
    mergeCells: () => cmd()?.chain().focus().mergeCells().run(),
    splitCell: () => cmd()?.chain().focus().splitCell().run(),
    toggleHeaderRow: () => cmd()?.chain().focus().toggleHeaderRow().run(),
    toggleHeaderColumn: () => cmd()?.chain().focus().toggleHeaderColumn().run(),
    deleteTable: () => cmd()?.chain().focus().deleteTable().run(),
    // ---- 行/列移动(飞书式抓手菜单)----
    // prosemirror-tables 的 moveTableRow/moveTableColumn 接收 {from, to, pos}:
    //   from/to 是行/列索引,pos 是任意 cell 的 doc 绝对 pos(用于定位表格)。
    // 这里从当前选区解析行/列号,默认 moveTableRow 会自动选中移动后的行(select:true 默认)。
    moveRowUp: () => moveRow(-1),
    moveRowDown: () => moveRow(1),
    moveColumnLeft: () => moveColumn(-1),
    moveColumnRight: () => moveColumn(1),
    // ---- 选中整行/整列(飞书式抓手点击)----
    selectRow: (rowIndex?: number) => selectLine('row', rowIndex),
    selectColumn: (columnIndex?: number) => selectLine('col', columnIndex),
    selectTable: () => { selectCurrentTable() },
    selectCellRange: (anchor, head) => { selectCellRange(anchor, head) },
    hr: (variant) => {
      const ed = cmd()
      if (!ed) return
      insertHorizontalRule(ed as unknown as CoreEditor, { variant })
    },
    clearNodes: () => cmd()?.chain().focus().clearNodes().run(),
    setFontFamily: (fontFamily) => {
      const chain = typographyChain()
      if (!chain) return
      if (fontFamily) chain.setFontFamily(fontFamily).run()
      else chain.unsetFontFamily().run()
    },
    setFontSize: (fontSize) => {
      const chain = typographyChain()
      if (!chain) return
      if (fontSize) chain.setFontSize(fontSize).run()
      else chain.unsetFontSize().run()
    },
    setLineHeight: (lineHeight) => {
      const chain = typographyChain()
      if (!chain) return
      if (lineHeight) chain.setLineHeight(lineHeight).run()
      else chain.unsetLineHeight().run()
    },
    clearTypography: () => {
      typographyChain()?.unsetFontFamily().unsetFontSize().unsetLineHeight().run()
    },
    setColor: (color) =>
      cmd()?.chain().focus().setColor(color).run(),
    toggleHighlight: (color) =>
      cmd()?.chain().focus().toggleHighlight({ color }).run(),
    align: (align) =>
      cmd()?.chain().focus().setTextAlign(align).run(),
    underline: () => cmd()?.chain().focus().toggleUnderline().run(),
    clearFormat: () =>
      cmd()?.chain().focus().clearNodes().unsetAllMarks().run(),
    taskList: () => cmd()?.chain().focus().toggleTaskList().run(),
    openFindReplace: () => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).openFindReplace?.()
    },
    closeFindReplace: () => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).closeFindReplace?.()
    },
    setFindReplaceQuery: (query) => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).setFindReplaceQuery?.(query)
    },
    setFindReplaceReplacement: (replacement) => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).setFindReplaceReplacement?.(replacement)
    },
    setFindReplaceCaseSensitive: (caseSensitive) => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).setFindReplaceCaseSensitive?.(caseSensitive)
    },
    findReplaceNext: () => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).findReplaceNext?.()
    },
    findReplacePrevious: () => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).findReplacePrevious?.()
    },
    replaceFindReplaceCurrent: (replacement) => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).replaceFindReplaceCurrent?.(replacement)
    },
    replaceFindReplaceAll: (replacement) => {
      const ed = cmd()
      if (!ed) return
      ;(ed.commands as any).replaceFindReplaceAll?.(replacement)
    },
  }

  function withDebugCommands(commandMap: ProEditorCommands): ProEditorCommands {
    const wrapped: Partial<ProEditorCommands> = {}
    for (const key of Object.keys(commandMap) as Array<keyof ProEditorCommands>) {
      const command = commandMap[key] as (...args: unknown[]) => unknown
      wrapped[key] = ((...args: unknown[]) => {
        debugLog('command', 'run', {
          command: key,
          args: summarizeCommandArgs(args),
        })
        try {
          const result = command(...args)
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return Promise.resolve(result).then(
              (value) => {
                debugLog('command', 'result', { command: key, ok: value !== false })
                return value
              },
              (error) => {
                debugLog('command', 'result', { command: key, ok: false }, 'error', error)
                throw error
              },
            )
          }
          debugLog('command', 'result', { command: key, ok: result !== false })
          return result
        } catch (error) {
          debugLog('command', 'result', { command: key, ok: false }, 'error', error)
          throw error
        }
      }) as never
    }
    return wrapped as ProEditorCommands
  }

  const commands = withDebugCommands(rawCommands)

  // ---- isActive ----
  // Tiptap 的 isActive 有两个重载:(name, attrs) 和 (attrs-only)。
  // 这里按入参类型分派,让两者都能正确命中。
  function isActive(
    name: string | Record<string, unknown>,
    attrs?: Record<string, unknown>,
  ): boolean {
    const ed = editor.value
    if (!ed) return false
    if (typeof name === 'string') {
      return ed.isActive(name, attrs)
    }
    return ed.isActive(name)
  }

  // ---- 表格选区状态 ----
  // 把 ProseMirror 的两个隐式约束显式化,驱动「合并/拆分」按钮的禁用态:
  //   mergeCells 只在 CellSelection 跨多格时有效;
  //   splitCell  只在光标所在单元格 colspan/rowspan > 1 时有效(否则静默 return false)。
  // 响应式实现:ProseMirror 的 state 变化不会自动触发 Vue 重渲染,
  // 用一个 tick ref 在 transaction/selectionUpdate 时自增,computed 依赖它即可。
  const tableTick = ref(0)
  watch(
    editor,
    (ed, _oldEd, onCleanup) => {
      if (!ed) return
      const bump = () => tableTick.value++
      ed.on('transaction', bump)
      ed.on('selectionUpdate', bump)
      onCleanup(() => {
        ed.off('transaction', bump)
        ed.off('selectionUpdate', bump)
      })
    },
    { immediate: true },
  )
  const tableState = computed<TableState>(() => {
    void tableTick.value // 建立依赖
    const ed = editor.value
    if (!ed) return { inTable: false, canMerge: false, canSplit: false, tablePos: null, rowCount: 0, colCount: 0 }
    // 光标在表格内:ProseMirror 节点链中含 table。
    const inTable = ed.isActive('table')
    if (!inTable) return { inTable: false, canMerge: false, canSplit: false, tablePos: null, rowCount: 0, colCount: 0 }

    const sel = ed.state.selection
    // 合并判定:选区跨多个单元格即「可合并」。
    // CellSelection(框选多格)有 $anchorCell/$headCell;普通跨格 TextSelection 没有,
    // 所以统一用「解析 $from/$to 各自所在的 cell 节点,比较是否同一格」来判定,
    // 兼容两种选区形态。
    // cellNode 节点含 attrs(colspan/rowspan),用 unknown 断言读取,避免引入
    // prosemirror-model 的 Node 类型(core 不显式依赖 prosemirror-tables)。
    const cellAt = (
      $r: { depth: number; node: (d: number) => unknown },
    ): { attrs: { colspan?: number; rowspan?: number } } | null => {
      for (let d = $r.depth; d > 0; d--) {
        const node = $r.node(d) as { type: { name: string }; attrs: { colspan?: number; rowspan?: number } }
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          return node
        }
      }
      return null
    }
    const anySel = sel as unknown as {
      $anchorCell?: { pos: number }
      $headCell?: { pos: number }
    }
    const fromCell = cellAt(sel.$from)
    const toCell = cellAt(sel.$to)
    const canMerge = (
      !!anySel.$anchorCell &&
      !!anySel.$headCell &&
      anySel.$anchorCell.pos !== anySel.$headCell.pos
    ) || (!!fromCell && !!toCell && fromCell !== toCell)

    // 拆分判定:当前单元格(以 $from 为准)colspan 或 rowspan > 1。
    const attrs = fromCell?.attrs ?? { colspan: 1, rowspan: 1 }
    const canSplit = (attrs.colspan ?? 1) > 1 || (attrs.rowspan ?? 1) > 1

    // 几何信息:复用 tableGeometry(tablePos/rowCount/colCount),供 adapter 定位覆盖层。
    const g = tableGeometry()
    return {
      inTable,
      canMerge,
      canSplit,
      tablePos: g ? g.tableStart - 1 : null, // tableStart 是内容区 pos,表格节点 pos = start - 1
      rowCount: g?.rowCount ?? 0,
      colCount: g?.colCount ?? 0,
    }
  })

  // ---- getter ----
  const getHTML = () => editor.value?.getHTML() ?? ''
  const getJSON = () => editor.value?.getJSON() ?? {}
  // Markdown:扩展未启用时 getMarkdown 返回空串,importMarkdown 降级为原文塞入
  const getMarkdownFn = () => {
    const value = editor.value ? getMarkdown(editor.value) : ''
    debugLog('markdown', 'export', { length: value.length })
    return value
  }
  const importMarkdownFn = (md: string) => {
    debugLog('markdown', 'import', { length: md.length }, 'info')
    editor.value && importMarkdown(editor.value, md)
  }

  // ---- 只读 ----
  const setEditable = (val: boolean) => editor.value?.setEditable(val)

  // ---- 销毁(useEditor 已自行管理,这里仅占位保持接口完整) ----
  onBeforeUnmount(() => {
    debugLog('lifecycle', 'destroy')
    // useEditor 内部已注册 onBeforeUnmount 销毁 editor
  })

  return {
    editor,
    loaded,
    isActive,
    commands,
    getHTML,
    getJSON,
    getMarkdown: getMarkdownFn,
    importMarkdown: importMarkdownFn,
    wordCount,
    setEditable,
    tableState,
    findReplaceState,
    notify: notifyFn,
    t,
  }
}
