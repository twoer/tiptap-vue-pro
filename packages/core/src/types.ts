import type { Editor } from '@tiptap/vue-3'
import type { Extensions } from '@tiptap/core'

/**
 * 扩展数组类型,v3 用 Extensions(同时接受 Extension 和 Node)。
 */
export type { Extensions } from '@tiptap/core'

/**
 * 编辑器输出格式
 */
export type OutputFormat = 'html' | 'json'

/**
 * 图片上传函数契约。
 *
 * adapter 接收到上传/粘贴/拖拽的 File,交给 Core 调用此函数拿到 url,
 * 再插入文档。Core 不关心上传到 OSS/COS/本地,只关心返回 url。
 *
 * 实现方应负责:
 * - 上传进度(可选,Core 不强求)
 * - 失败时抛错或返回 null(返回 null 时 Core 跳过插入,不弹 toast——
 *   提示由 adapter 用各自 UI 库处理,保持 UI 无关)
 */
export type UploadImage = (file: File) => Promise<string | null>

/**
 * useProEditor 的配置项
 */
export interface ProEditorOptions {
  /** v-model 绑定值,字符串(html/json 文本)或对象(json) */
  content: string | object
  /** 输出格式,默认 'html' */
  output?: OutputFormat
  /** 扩展数组。传入则覆盖默认扩展包;不传使用默认包 */
  extensions?: Extensions
  /** placeholder 文案 */
  placeholder?: string
  /** 图片上传函数。不传则图片只能以已有 url 插入,粘贴/拖拽上传失效 */
  uploadImage?: UploadImage
  /** 是否只读 */
  editable?: boolean
  /** 额外编辑器属性,透传给 Editor 构造函数(如 autofocus, editorProps) */
  editorProps?: Record<string, unknown>
}

/**
 * useProEditor 返回的结构
 */
export interface ProEditorContext {
  /** Tiptap Editor 实例(loaded 后才有值) */
  editor: Ref<Editor | undefined>
  /** 编辑器是否已挂载 */
  loaded: Ref<boolean>
  /** 命令是否可用 */
  isActive: (name: string, attrs?: Record<string, unknown>) => boolean
  /** 聚合命令,工具栏按钮直接调用 */
  commands: ProEditorCommands
  /** 当前内容字符串(按 output 格式) */
  getHTML: () => string
  getJSON: () => object
  /** 字数统计 */
  wordCount: Ref<{ characters: number; words: number }>
  /** 切换只读 */
  setEditable: (editable: boolean) => void
}

/**
 * 命令契约。每个方法对应工具栏一个按钮。
 * adapter 的工具栏直接消费这个对象。
 *
 * 命名原则:动词在前,和 Tiptap 原生命名对齐,降低心智成本。
 */
export interface ProEditorCommands {
  undo: () => void
  redo: () => void
  bold: () => void
  italic: () => void
  strike: () => void
  /** 切换标题级别,level 0 表示取消标题(转普通段落) */
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6 | 0) => void
  bulletList: () => void
  orderedList: () => void
  blockquote: () => void
  codeBlock: () => void
  /** 设置/更新链接;href 为空则移除链接 */
  setLink: (href: string, opts?: { target?: string }) => void
  /** 插入图片(已有 url) */
  setImage: (src: string, alt?: string) => void
  /** 插入图片(从 File,走 uploadImage) */
  uploadAndInsertImage: (file: File) => Promise<void>
  insertTable: (rows?: number, cols?: number) => void
  hr: () => void
  clearNodes: () => void
  /** 设置文字颜色;color 为空字符串则清除颜色 */
  setColor: (color: string) => void
  /** 切换背景高亮;color 为空则清除高亮 */
  toggleHighlight: (color: string) => void
}

// 局部类型引入,避免污染对外导出
import type { Ref } from 'vue'
