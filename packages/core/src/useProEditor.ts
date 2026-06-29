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
import { createDefaultExtensions } from './extensions'
import { getMarkdown, importMarkdown } from './markdown'
import { resolveEditorBehaviorOptions } from './editorBehaviorOptions'
import type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
  NotifyFn,
  TableState,
} from './types'

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
    editable = true,
    editorProps,
    notify,
    immediatelyRender = false,
  } = options

  const exts = extensions ?? createDefaultExtensions(placeholder)
  const getOutput = () => options.output ?? 'html'
  const getBehaviorOptions = () => resolveEditorBehaviorOptions(options.editorBehaviorOptions)

  // ---- 通过官方 useEditor 创建实例 ----
  // 注意:useEditor 内部用 Vue 生命周期管理 Editor,返回 Ref<Editor | undefined>
  const editorOptions = {
    extensions: exts,
    content: content as never,
    editable,
    immediatelyRender,
    editorProps: editorProps ?? {},
    onUpdate: ({ editor: ed }: { editor: CoreEditor }) => {
      isUpdatingFromEditor = true
      emitValue(ed)
      syncWordCount(ed)
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
      if (ed) syncWordCount(ed)
    },
    { immediate: true },
  )

  // ---- v-model 双向绑定 ----
  function emitValue(ed: CoreEditor) {
    const output = getOutput()
    const val = output === 'html' ? ed.getHTML() : ed.getJSON()
    // 通过 setter 回写(由 adapter 组件把 content setter 接到 v-model)
    options.content = val
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
  function tableGeometry() {
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
    const isCell = (n: { type: { name: string } }) =>
      n.type.name === 'tableCell' || n.type.name === 'tableHeader'

    // 解析 $pos,沿节点链找 cell + table,记录各自 depth。
    // tryResolve:若传入 pos 恰好落在节点边界(不在 cell 内容内),退一格再解析。
    function resolveInfo(pos: number) {
      const $pos = ed!.state.doc.resolve(pos)
      let cellDepth = -1
      let tableDepth = -1
      for (let d = $pos.depth; d > 0; d--) {
        const name = $pos.node(d).type.name
        if (cellDepth < 0 && isCell($pos.node(d))) cellDepth = d
        if (tableDepth < 0 && name === 'table') tableDepth = d
      }
      return { $pos, cellDepth, tableDepth }
    }
    let { $pos: $cell, cellDepth, tableDepth } = resolveInfo(anchorPos)
    // 边界情况:pos 落在 cell 外,退一格重试
    if (cellDepth < 0 && anchorPos > 0) {
      ({ $pos: $cell, cellDepth, tableDepth } = resolveInfo(anchorPos - 1))
    }
    if (cellDepth < 0 || tableDepth < 0) return null

    const tableNode = $cell.node(tableDepth)
    const tableStart = $cell.start(tableDepth) // table 内容区起始 pos(table pos + 1)
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
    if (!g) return
    const ed = editor.value!
    const to = g.row + dir
    if (to < 0 || to >= g.rowCount) return
    moveTableRow({ from: g.row, to, pos: g.cellDocPos })(
      ed.state,
      (tr) => ed.view.dispatch(tr),
    )
  }
  function moveColumn(dir: -1 | 1) {
    const g = tableGeometry()
    if (!g) return
    const ed = editor.value!
    const to = g.col + dir
    if (to < 0 || to >= g.colCount) return
    moveTableColumn({ from: g.col, to, pos: g.cellDocPos })(
      ed.state,
      (tr) => ed.view.dispatch(tr),
    )
  }

  // 选中整行/整列(飞书式抓手点击)。用 CellSelection.rowSelection/colSelection,
  // 传入该行/列首尾 cell 的 ResolvedPos,自动扩展为整行/整列选区。
  function selectLine(axis: 'row' | 'col') {
    const g = tableGeometry()
    if (!g) return
    const ed = editor.value!
    const { map, tableStart, row, col } = g
    // 算出该行/列首尾 cell 的相对 pos,转 doc 绝对 pos 后 resolve。
    const firstRel = axis === 'row'
      ? map.positionAt(row, 0, ed.state.doc.nodeAt(tableStart - 1)!)
      : map.positionAt(0, col, ed.state.doc.nodeAt(tableStart - 1)!)
    const lastRel = axis === 'row'
      ? map.positionAt(row, map.width - 1, ed.state.doc.nodeAt(tableStart - 1)!)
      : map.positionAt(map.height - 1, col, ed.state.doc.nodeAt(tableStart - 1)!)
    const $first = ed.state.doc.resolve(tableStart + firstRel)
    const $last = ed.state.doc.resolve(tableStart + lastRel)
    const cellSel = axis === 'row'
      ? CellSelection.rowSelection($first, $last)
      : CellSelection.colSelection($first, $last)
    ed.view.dispatch(ed.state.tr.setSelection(cellSel))
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

  // ---- 消息提示 ----
  // adapter 注入的 UI 库实现;未注入时静默(no-op),保证 headless 场景不崩。
  // 放在 commands 之前,因为 uploadAndInsertImage 等命令内部会调用它。
  const notifyFn: NotifyFn = notify ?? (() => {})

  const commands: ProEditorCommands = {
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
        const c = ed.chain().focus()
        if (range) c.setTextSelection(range)
      c.extendMarkRange('link').unsetLink().scrollIntoView().run()
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
      try {
        const url = await uploadImage(file)
        if (url) {
          ed.chain().focus().setImage({ src: url }).scrollIntoView().run()
        } else {
          // uploadImage 返回 null 视为失败(约定见 UploadImage 文档)
          notifyFn('图片上传失败', 'error')
        }
      } catch {
        // 提示由 notify 负责(adapter 注入),Core 保持 UI 无关
        notifyFn('图片上传失败', 'error')
      }
    },
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
    deleteRow: () => cmd()?.chain().focus().deleteRow().run(),
    addColumnBefore: () => cmd()?.chain().focus().addColumnBefore().run(),
    addColumnAfter: () => cmd()?.chain().focus().addColumnAfter().run(),
    deleteColumn: () => cmd()?.chain().focus().deleteColumn().run(),
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
    selectRow: () => selectLine('row'),
    selectColumn: () => selectLine('col'),
    hr: () => cmd()?.chain().focus().setHorizontalRule().run(),
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
  }

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
    const fromCell = cellAt(sel.$from)
    const toCell = cellAt(sel.$to)
    const canMerge = !!fromCell && !!toCell && fromCell !== toCell

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
  const getMarkdownFn = () => (editor.value ? getMarkdown(editor.value) : '')
  const importMarkdownFn = (md: string) => {
    editor.value && importMarkdown(editor.value, md)
  }

  // ---- 只读 ----
  const setEditable = (val: boolean) => editor.value?.setEditable(val)

  // ---- 销毁(useEditor 已自行管理,这里仅占位保持接口完整) ----
  onBeforeUnmount(() => {
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
    notify: notifyFn,
  }
}
