import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useEditor, type Editor } from '@tiptap/vue-3'
import { isNodeSelection, type Editor as CoreEditor } from '@tiptap/core'
// 表格几何/选区/移动的纯计算与命令执行在 ./tableController
// (走 @tiptap/pm/tables,core 已依赖 @tiptap/pm,不引入新包)。
import { TextSelection } from '@tiptap/pm/state'
import { createDefaultExtensions } from './extensions'
import { createTableController } from './tableController'
import { createMediaInserter } from './mediaInsertion'
import { insertHorizontalRule } from './extensions/horizontalRule'
import { EMPTY_FIND_REPLACE_STATE } from './findReplace'
import { createFindReplaceCommandEntries } from './findReplaceCommands'
import { getSelectedMediaNode } from './mediaSelection'
import { getMarkdown, importMarkdown } from './markdown'
import { resolveEditorBehaviorOptions } from './editorBehaviorOptions'
import {
  notifyImageFileValidationFailure,
  validateImageFile,
} from './handleImageUpload'
import { resolveLocale } from './locale'
import { setNodeViewLocale } from './nodeViewLocale'
import { createDebugLogger } from './debug'
import type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
  NotifyFn,
  TableState,
} from './types'
import type { ProEditorDebugLogFn } from './debug'
import { getDefaultMermaidSource } from './mermaid'
import { createAutosaveController } from './autosave'
import { createLocalDraftController } from './localDraft'

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

  // 只创建一次:debugLog 挂在每个 transaction/selectionUpdate 上,
  // 每次调用重建闭包是不可接受的热路径开销。getter 保持调用时动态读取。
  const debugLog: ProEditorDebugLogFn = createDebugLogger({
    get debug() {
      return options.debug
    },
    get debugLogger() {
      return options.debugLogger
    },
    source: 'core',
  })
  const getOutput = () => options.output ?? 'html'
  const getBehaviorOptions = () => resolveEditorBehaviorOptions(options.editorBehaviorOptions)
  const resolvedLocale = computed(() => resolveLocale(options.locale))
  const findReplaceState = ref(EMPTY_FIND_REPLACE_STATE)
  const t = ((key, paramsOrFallback, fallback) =>
    resolvedLocale.value.t(key, paramsOrFallback, fallback)) as ReturnType<typeof resolveLocale>['t']
  // NodeView 层 UI 文案(题注 placeholder 等)跟随当前 locale
  watch(resolvedLocale, (loc) => setNodeViewLocale(loc.t), { immediate: true })

  // ---- 消息提示 ----
  // adapter 注入的 UI 库实现;未注入时静默(no-op),保证 headless 场景不崩。
  // 放在 commands 之前,因为 uploadAndInsertImage 等命令内部会调用它。
  const notifyFn: NotifyFn = notify ?? (() => {})

  // 媒体插入器:文件/视频/音频资产的节点构造与上传编排。
  // 扩展配置的 fileTypeLabel 与 commands 均在运行时调用其方法。
  const mediaInserter = createMediaInserter({
    getEditor: () => editor.value,
    getBehaviorOptions,
    t,
    notify: notifyFn,
    debugLog,
    uploadAsset,
  })
  const autosaveController = createAutosaveController(
    () => options.autosave,
    options.content,
  )
  const localDraftController = createLocalDraftController(
    () => options.draft,
    options.content,
  )
  const exts = extensions ?? createDefaultExtensions(
    placeholder ?? t('placeholder.default'),
    {},
    {
      fileAttachment: { fileTypeLabel: mediaInserter.localizedFileTypeText },
      slashCommand: options.slashCommand === false ? undefined : options.slashCommand,
      findReplace: {
        onUpdate: (state) => {
          findReplaceState.value = state
        },
      },
      mermaid: {
        ...options.mermaid,
        defaultSource: options.mermaid?.defaultSource
          ?? getDefaultMermaidSource(resolvedLocale.value.locale),
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
          return table.selectCellRangeFromMouseDown(view, event)
        }
        if (event instanceof MouseEvent) table.rememberPointerTableCell(view, event)
        return false
      },
    },
    handleKeyDown: (view: unknown, event: KeyboardEvent) => {
      if (userHandleKeyDown?.(view, event)) return true
      if (table.isSelectAllShortcut(event)) return table.selectCurrentTable()
      return false
    },
    handleClick: (view: unknown, pos: number, event: MouseEvent) => {
      if (userHandleClick?.(view, pos, event)) return true
      if (event.shiftKey) return table.selectCellRangeFromClick(pos, event)
      return false
    },
  }
  const editorOptions = {
    extensions: exts,
    content: content as NonNullable<Parameters<typeof useEditor>[0]>['content'],
    editable,
    immediatelyRender,
    editorProps: resolvedEditorProps,
    onUpdate: ({ editor: ed }: { editor: CoreEditor }) => {
      // flag 必须在 emit 链后立即复位:若新值与旧值相同,Vue 的 watch 不会触发,
      // flag 会永久卡在 true,吞掉下一次真正的外部内容同步。
      // 回环防护由 watch 侧的值比较兜底(与编辑器当前内容一致则跳过)。
      isUpdatingFromEditor = true
      try {
        const value = emitValue(ed)
        autosaveController.schedule(value)
        localDraftController.schedule(value)
        syncWordCount(ed)
      } finally {
        isUpdatingFromEditor = false
      }
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

  // 表格控制器:几何解析 + 移动/选区/删除命令。
  // editorProps 的事件闭包在运行时(事件触发)才访问,晚于这里初始化。
  const table = createTableController({
    getEditor: () => editor.value,
    debugLog,
  })

  const loaded = computed(() => !!editor.value)
  const wordCount = ref({ characters: 0, words: 0 })
  let draftDiscoveryStarted = false

  // 防止 v-model 回写触发内容重置导致的循环
  let isUpdatingFromEditor = false

  // ---- 字数统计 ----
  function syncWordCount(ed: CoreEditor) {
    const cc = (ed.storage as unknown as Record<
      string,
      { characters?: () => number; words?: () => number } | undefined
    >).characterCount
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
        if (!draftDiscoveryStarted) {
          draftDiscoveryStarted = true
          const current = getOutput() === 'html' ? ed.getHTML() : ed.getJSON()
          autosaveController.reset(current)
          localDraftController.reset(current)
          void localDraftController.discover(current)
        }
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
    return val
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
      autosaveController.reset(next)
      localDraftController.reset(next)
      void localDraftController.discover(next)
      debugLog('content', 'external-sync', {
        output,
        contentLength: contentLength(next),
      })
      ed.commands.setContent(next ?? '', { emitUpdate: false })
    },
  )

  watch(
    [
      () => {
        const autosave = options.autosave
        return !!autosave && autosave.enabled !== false
      },
      () => {
        const autosave = options.autosave
        return autosave ? autosave.key : undefined
      },
    ],
    () => {
      const ed = editor.value
      const current = ed
        ? (getOutput() === 'html' ? ed.getHTML() : ed.getJSON())
        : options.content
      autosaveController.reset(current)
    },
  )

  watch(
    [
      () => {
        const draft = options.draft
        return !!draft && draft.enabled !== false
      },
      () => {
        const draft = options.draft
        return draft ? draft.key : undefined
      },
    ],
    () => {
      const ed = editor.value
      const current = ed
        ? (getOutput() === 'html' ? ed.getHTML() : ed.getJSON())
        : options.content
      localDraftController.reset(current)
      void localDraftController.discover(current)
    },
  )

  watch(
    () => autosaveController.state.value,
    (autosaveState) => {
      if (autosaveState.status !== 'saved') return
      void localDraftController.markRemoteSaved(autosaveController.getLastSavedContent())
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
        const chain = ed.chain().focus()
        if (ed.isActive('taskList')) chain.sinkListItem('taskItem').run()
        else chain.sinkListItem('listItem').run()
        return
      }
      ;ed.chain().focus().increaseBlockIndent().run()
    },
    decreaseIndent: () => {
      const ed = cmd()
      if (!ed) return
      if (inList(ed)) {
        const chain = ed.chain().focus()
        if (ed.isActive('taskList')) chain.liftListItem('taskItem').run()
        else chain.liftListItem('listItem').run()
        return
      }
      ;ed.chain().focus().decreaseBlockIndent().run()
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
    insertMermaidBlock: (source, viewMode) => {
      cmd()?.chain().focus().insertMermaidBlock({
        source,
        viewMode,
      }).run()
    },
    setMermaidViewMode: (viewMode) => {
      cmd()?.chain().focus().setMermaidViewMode(viewMode).run()
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
    insertVideo: mediaInserter.insertVideoAsset,
    uploadAndInsertVideo: (file) => mediaInserter.uploadAndInsertAsset(file, 'video', mediaInserter.insertVideoAsset),
    insertAudio: mediaInserter.insertAudioAsset,
    uploadAndInsertAudio: (file) => mediaInserter.uploadAndInsertAsset(file, 'audio', mediaInserter.insertAudioAsset),
    insertFile: (asset) => mediaInserter.insertFileAsset(asset, 'file'),
    uploadAndInsertFile: (file) => mediaInserter.uploadAndInsertAsset(file, 'file', (asset) => mediaInserter.insertFileAsset(asset, 'file')),
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
    deleteRow: (rowIndex?: number) => table.deleteLine('row', rowIndex),
    addColumnBefore: () => cmd()?.chain().focus().addColumnBefore().run(),
    addColumnAfter: () => cmd()?.chain().focus().addColumnAfter().run(),
    deleteColumn: (columnIndex?: number) => table.deleteLine('col', columnIndex),
    mergeCells: () => cmd()?.chain().focus().mergeCells().run(),
    splitCell: () => cmd()?.chain().focus().splitCell().run(),
    toggleHeaderRow: () => cmd()?.chain().focus().toggleHeaderRow().run(),
    toggleHeaderColumn: () => cmd()?.chain().focus().toggleHeaderColumn().run(),
    deleteTable: () => cmd()?.chain().focus().deleteTable().run(),
    // ---- 行/列移动(飞书式抓手菜单)----
    // prosemirror-tables 的 moveTableRow/moveTableColumn 接收 {from, to, pos}:
    //   from/to 是行/列索引,pos 是任意 cell 的 doc 绝对 pos(用于定位表格)。
    // 这里从当前选区解析行/列号,默认 moveTableRow 会自动选中移动后的行(select:true 默认)。
    moveRowUp: () => table.moveRow(-1),
    moveRowDown: () => table.moveRow(1),
    moveColumnLeft: () => table.moveColumn(-1),
    moveColumnRight: () => table.moveColumn(1),
    // ---- 选中整行/整列(飞书式抓手点击)----
    selectRow: (rowIndex?: number) => table.selectLine('row', rowIndex),
    selectColumn: (columnIndex?: number) => table.selectLine('col', columnIndex),
    selectTable: () => { table.selectCurrentTable() },
    selectCellRange: (anchor, head) => { table.selectCellRange(anchor, head) },
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
    // 查找替换命令桥(面板联动)见 ./findReplaceCommands
    ...createFindReplaceCommandEntries(cmd),
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
        // 泛型索引写入(给具体成员签名赋泛型包装函数)是 TS 的已知限制,
        // never 是唯一无需构造交集类型的逃生通道;运行时签名由调用方约束。
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
    const g = table.tableGeometry()
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
    if (editor.value) importMarkdown(editor.value, md)
  }

  // ---- 只读 ----
  const setEditable = (val: boolean) => editor.value?.setEditable(val)

  function restoreDraft() {
    const ed = editor.value
    if (!ed) return null
    const candidate = localDraftController.restore()
    if (!candidate) return null
    ed.commands.setContent(candidate.content, { emitUpdate: true })
    return candidate
  }

  // ---- 销毁(useEditor 已自行管理,这里仅占位保持接口完整) ----
  onBeforeUnmount(() => {
    debugLog('lifecycle', 'destroy')
    const autosave = options.autosave
    if (autosave && autosave.enabled !== false && autosave.saveOnUnmount) {
      void autosaveController.flush('unmount')
        .finally(() => autosaveController.dispose())
    } else {
      autosaveController.dispose()
    }
    void localDraftController.flush()
      .finally(() => localDraftController.dispose())
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
    autosaveState: autosaveController.state,
    flushAutosave: autosaveController.flush,
    retryAutosave: autosaveController.retry,
    draftState: localDraftController.state,
    restoreDraft,
    discardDraft: localDraftController.discard,
    flushDraft: localDraftController.flush,
    notify: notifyFn,
    t,
  }
}
