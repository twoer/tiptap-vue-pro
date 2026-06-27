import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useEditor, type Editor } from '@tiptap/vue-3'
import type { Editor as CoreEditor } from '@tiptap/core'
import { createDefaultExtensions } from './extensions'
import { getMarkdown, importMarkdown } from './markdown'
import type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
} from './types'

/**
 * tiptap-vue-pro 的核心 composable。
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
    output = 'html',
    extensions,
    placeholder,
    uploadImage,
    editable = true,
    editorProps,
  } = options

  const exts = extensions ?? createDefaultExtensions(placeholder)

  // ---- 通过官方 useEditor 创建实例 ----
  // 注意:useEditor 内部用 Vue 生命周期管理 Editor,返回 Ref<Editor | undefined>
  const editor = useEditor({
    extensions: exts,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    editable,
    editorProps: editorProps ?? {},
    onUpdate: ({ editor: ed }) => {
      isUpdatingFromEditor = true
      emitValue(ed)
      syncWordCount(ed)
    },
  })

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

  const commands: ProEditorCommands = {
    undo: () => cmd()?.chain().focus().undo().run(),
    redo: () => cmd()?.chain().focus().redo().run(),
    bold: () => cmd()?.chain().focus().toggleBold().run(),
    italic: () => cmd()?.chain().focus().toggleItalic().run(),
    strike: () => cmd()?.chain().focus().toggleStrike().run(),
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
    blockquote: () => cmd()?.chain().focus().toggleBlockquote().run(),
    codeBlock: () => cmd()?.chain().focus().toggleCodeBlock().run(),
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
        }
      } catch {
        // 上传失败提示由 adapter 负责,Core 保持 UI 无关
      }
    },
    insertTable: (rows = 3, cols = 3) =>
      cmd()?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).scrollIntoView().run(),
    hr: () => cmd()?.chain().focus().setHorizontalRule().run(),
    clearNodes: () => cmd()?.chain().focus().clearNodes().run(),
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
  }
}
