import { ref, shallowRef, watch, onBeforeUnmount, markRaw } from 'vue'
import { Editor } from '@tiptap/core'
import { createDefaultExtensions } from './extensions'
import type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
} from './types'

/**
 * tiptap-vue-pro 的核心 composable。
 *
 * 职责:
 * 1. 创建并持有 Tiptap Editor 实例(shallowRef + markRaw,避免 Vue 深度代理)
 * 2. 实现 v-model 双向绑定(支持 html / json 两种输出)
 * 3. 聚合命令对象 commands,供工具栏按钮直接调用
 * 4. 处理图片上传(从 File 到 url 再到文档插入)
 * 5. 字数统计、只读切换
 *
 * 不做的事(故意下推给 adapter):
 * - 任何 DOM 渲染、UI 组件
 * - toast / message 提示(上传失败等由 adapter 用各自 UI 库展示)
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

  const editor = shallowRef<Editor | undefined>()
  const loaded = ref(false)
  const wordCount = ref({ characters: 0, words: 0 })

  // 防止 v-model 回写触发内容重置导致的循环
  let isUpdatingFromEditor = false

  const exts = extensions ?? createDefaultExtensions(placeholder)

  // ---- 创建实例 ----
  function createEditor() {
    const instance = new Editor({
      extensions: exts,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      editable,
      editorProps: editorProps as any,
      onCreate: ({ editor: ed }) => {
        loaded.value = true
        syncWordCount(ed)
      },
      onUpdate: ({ editor: ed }) => {
        isUpdatingFromEditor = true
        emitValue(ed)
        syncWordCount(ed)
      },
      onSelectionUpdate: ({ editor: ed }) => {
        // 工具栏 active 状态依赖 selection,这里通过 ref 触发响应
        // (commands 本身不响应式,工具栏由 adapter 自行基于 isActive 渲染)
        void ed
      },
    })
    editor.value = markRaw(instance)
  }

  createEditor()

  // ---- v-model 双向绑定 ----
  function emitValue(ed: Editor) {
    const val = output === 'html' ? ed.getHTML() : ed.getJSON()
    // 通过 options 上传入的 setContent 回写(由 adapter 的组件接管 v-model)
    options.content = val
  }

  // 外部值变化 → 写入编辑器(跳过编辑器自己触发的回写)
  watch(
    () => options.content,
    (next) => {
      if (isUpdatingFromEditor) {
        isUpdatingFromEditor = false
        return
      }
      const ed = editor.value
      if (!ed) return
      const incoming = next as string
      const current = output === 'html' ? ed.getHTML() : ed.getText()
      if (incoming === current) return
      // setContent 第二参 emit=false,避免再触发 onUpdate
      ed.commands.setContent(next ?? '', { emitUpdate: false })
    },
  )

  // ---- 字数统计 ----
  function syncWordCount(ed: Editor) {
    const storage = ed.storage as any
    const cc = storage.characterCount
    if (cc) {
      wordCount.value = {
        characters: cc.characters?.() ?? 0,
        words: cc.words?.() ?? 0,
      }
    }
  }

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
      // 空字符串 = 移除链接
      if (!href) {
        ed.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }
      ed.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href,
          target: o?.target ?? '_blank',
        })
        .run()
    },
    setImage: (src, alt) =>
      cmd()?.chain().focus().setImage({ src, alt }).run(),
    uploadAndInsertImage: async (file) => {
      if (!uploadImage) return
      const ed = cmd()
      if (!ed) return
      try {
        const url = await uploadImage(file)
        if (url) {
          ed.chain().focus().setImage({ src: url }).run()
        }
      } catch {
        // 上传失败提示由 adapter 负责,Core 保持 UI 无关
      }
    },
    insertTable: (rows = 3, cols = 3) =>
      cmd()?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(),
    hr: () => cmd()?.chain().focus().setHorizontalRule().run(),
    clearNodes: () => cmd()?.chain().focus().clearNodes().run(),
  }

  // ---- isActive ----
  function isActive(name: string, attrs?: Record<string, unknown>): boolean {
    return editor.value?.isActive(name, attrs) ?? false
  }

  // ---- getter ----
  const getHTML = () => editor.value?.getHTML() ?? ''
  const getJSON = () => editor.value?.getJSON() ?? {}

  // ---- 只读 ----
  const setEditable = (val: boolean) => editor.value?.setEditable(val)

  // ---- 销毁 ----
  onBeforeUnmount(() => {
    editor.value?.destroy()
    editor.value = undefined
  })

  return {
    editor,
    loaded,
    isActive,
    commands,
    getHTML,
    getJSON,
    wordCount,
    setEditable,
  }
}
