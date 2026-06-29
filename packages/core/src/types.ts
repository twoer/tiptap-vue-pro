import type { Editor } from '@tiptap/vue-3'
import type { Extensions } from '@tiptap/core'
import type { CodeBlockLanguage } from './codeBlock'
import type { ImageAlign, ImageSizePreset } from './extensions/image'

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
 * - 失败时抛错或返回 null(返回 null 时 Core 跳过插入,Core 会调 notify
 *   提示用户;adapter 负责注入具体的提示 UI,见 NotifyFn)
 */
export type UploadImage = (file: File) => Promise<string | null>

/**
 * 消息提示类型。
 */
export type NotifyType = 'success' | 'error' | 'warning' | 'info'

/**
 * 消息提示回调契约。
 *
 * 这是 Core 与 UI 库之间的「提示」边界:Core 在需要提示用户的时机
 * (上传失败、移除链接、导入结果等)调用它;adapter 注入各自的实现
 * (EP 的 ElMessage、Naive 的 useMessage、或自定义)。
 *
 * 设计动机:让两个 adapter 的「提示时机 + 文案」完全对等——文案集中
 * 在调用处,adapter 只决定「用什么组件显示」。不传时静默(纯 headless)。
 */
export type NotifyFn = (message: string, type?: NotifyType) => void

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
  /**
   * 消息提示回调。adapter 注入各自 UI 库的实现(EP 的 ElMessage / Naive 的
   * useMessage)。Core 在上传失败等场景调用它;不传则静默。
   */
  notify?: NotifyFn
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
  /** 命令是否可用。name 可传扩展名,或传 attrs-only 对象(如 { textAlign: 'center' }) */
  isActive: (
    name: string | Record<string, unknown>,
    attrs?: Record<string, unknown>,
  ) => boolean
  /** 聚合命令,工具栏按钮直接调用 */
  commands: ProEditorCommands
  /** 当前内容字符串(按 output 格式) */
  getHTML: () => string
  getJSON: () => object
  /** 当前内容序列化为 Markdown。未启用 Markdown 扩展时返回空串 */
  getMarkdown: () => string
  /** 把一段 Markdown 写入编辑器(替换全部内容);解析失败则降级直接塞入 */
  importMarkdown: (md: string) => void
  /** 字数统计 */
  wordCount: Ref<{ characters: number; words: number }>
  /** 切换只读 */
  setEditable: (editable: boolean) => void
  /**
   * 表格选区状态(响应式)。驱动表格气泡里「合并/拆分」按钮的可用性,
   * 避免 ProseMirror splitCell 对未合并单元格静默 return false 导致「点了没反应」。
   * 光标不在表格内时,几何字段为默认值(inTable=false)。
   */
  tableState: Ref<TableState>
  /**
   * 消息提示。adapter 注入的 UI 库实现(EP 的 ElMessage / Naive 的 useMessage),
   * 供工具栏等组件在「导入成功 / 链接校验失败」等场景统一调用,文案与触发点对齐。
   */
  notify: NotifyFn
}

/**
 * 表格选区状态。用于驱动「合并/拆分」按钮的禁用态,解释 ProseMirror 的隐式约束:
 * - mergeCells 只在「选中多个单元格」(CellSelection 跨格)时有效
 * - splitCell 只在「光标在被合并的单元格」(colspan/rowspan > 1)时有效
 * 把这两个隐式约束显式化,让 UI 能给出禁用反馈而非静默失败。
 *
 * 几何字段(tablePos/rowCount/colCount)供 adapter 渲染飞书式覆盖层定位:
 * core 不读 DOM,只暴露纯数据;adapter 用 editor.view.nodeDOM(tablePos) 拿 table DOM 算 rect。
 */
export interface TableState {
  /** 光标是否在表格内(任意单元格,含单选/多选) */
  inTable: boolean
  /** 是否选中了多个单元格(CellSelection 且 anchor ≠ head)——合并的前提 */
  canMerge: boolean
  /** 光标所在单元格是否被合并过(colspan 或 rowspan > 1)——拆分的前提 */
  canSplit: boolean
  /** 当前表格在文档中的起始 pos(adapter 用 view.nodeDOM(pos) 定位)。不在表格内为 null */
  tablePos: number | null
  /** 表格行数 */
  rowCount: number
  /** 表格列数 */
  colCount: number
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
  /** 行内代码 */
  code: () => void
  /** 上标 */
  superscript: () => void
  /** 下标 */
  subscript: () => void
  /** 切换标题级别,level 0 表示取消标题(转普通段落) */
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6 | 0) => void
  bulletList: () => void
  orderedList: () => void
  blockquote: () => void
  /** 切换代码块;传入语言时会创建/更新为指定语言 */
  codeBlock: (language?: CodeBlockLanguage) => void
  /** 设置/更新链接;href 为空则移除链接 */
  setLink: (href: string, opts?: { target?: string; range?: { from: number; to: number } }) => void
  /**
   * 在指定位置插入/替换一段带链接的文本。
   * 传 range 时按绝对位置写入(绕开弹窗失焦导致的 selection 漂移);
   * 不传则用当前 selection。text 为空时用 href 作显示文字。
   */
  insertLinkText: (
    href: string,
    text?: string,
    opts?: { target?: string; range?: { from: number; to: number } },
  ) => void
  /**
   * 确保编辑器有可用光标位置。
   * 用户从未点进编辑器时,把光标移到文档末尾并聚焦,
   * 供工具栏「插入类」按钮在操作前调用,避免插入到开头看不到。
   */
  ensureFocusAtEnd: () => void
  /** 插入图片(已有 url) */
  setImage: (src: string, alt?: string) => void
  /** 插入图片(从 File,走 uploadImage) */
  uploadAndInsertImage: (file: File) => Promise<void>
  /**
   * 设置当前选中图片的对齐方式。
   * 仅在当前选中节点是 image 时生效(NodeSelection)。
   */
  setImageAlign: (align: ImageAlign) => void
  /**
   * 按预设设置当前选中图片的宽度。
   * small/medium/large 按编辑器内容区宽度的 25%/50%/75%;
   * original 清除宽度属性,回归自然尺寸。仅 NodeSelection 生效。
   */
  setImageSize: (preset: ImageSizePreset) => void
  /**
   * 设置当前选中图片的题注。空串清除题注。仅 NodeSelection 生效。
   */
  setImageCaption: (caption: string) => void
  /** 删除当前选中图片。仅 NodeSelection 生效。 */
  removeImage: () => void
  insertTable: (rows?: number, cols?: number) => void
  /**
   * 表格结构操作命令(Tiptap TableKit 全部内置,这里只做接线)。
   *
   * 设计为「无参 + 当前选区」:命令作用在光标所在单元格上,与 Tiptap 原生命令
   * 语义一致。adapter 的工具栏在选中表格时才显示这些按钮(用 isActive('table') 判定),
   * 所以 core 不需要在命令里判断「是否在表格内」——adapter 已保证只在有效场景暴露入口。
   *
   * 命名对齐 Tiptap(addRowAfter 等),降低心智成本。
   */
  addRowBefore: () => void
  addRowAfter: () => void
  deleteRow: () => void
  addColumnBefore: () => void
  addColumnAfter: () => void
  deleteColumn: () => void
  /** 合并选区内单元格(需选中多个单元格,通常用拖拽或键盘选区) */
  mergeCells: () => void
  /** 拆分已合并的单元格 */
  splitCell: () => void
  /** 切换首行是否为表头(<th>) */
  toggleHeaderRow: () => void
  /** 切换首列是否为表头 */
  toggleHeaderColumn: () => void
  /** 删除整个表格 */
  deleteTable: () => void
  /**
   * 移动当前行/列(飞书式抓手菜单用)。基于 prosemirror-tables 的 moveTableRow/moveTableColumn。
   * 已是首行/首列时 moveUp/Left 无效,已是末行/末列时 moveDown/Right 无效(命令静默返回)。
   * 作用于当前选区所在行/列,与 addRow/deleteRow 同理。
   */
  moveRowUp: () => void
  moveRowDown: () => void
  moveColumnLeft: () => void
  moveColumnRight: () => void
  /** 选中光标所在整行(CellSelection.rowSelection)——飞书式抓手点击行为 */
  selectRow: () => void
  /** 选中光标所在整列(CellSelection.colSelection) */
  selectColumn: () => void
  hr: () => void
  clearNodes: () => void
  /** 设置字体族;fontFamily 为空字符串则清除字体 */
  setFontFamily: (fontFamily: string) => void
  /** 设置字号;fontSize 为空字符串则清除字号 */
  setFontSize: (fontSize: string) => void
  /** 设置行高;lineHeight 为空字符串则清除行高 */
  setLineHeight: (lineHeight: string) => void
  /** 清除字体、字号、行高,保留颜色/高亮等其他格式 */
  clearTypography: () => void
  /** 增加缩进:列表中嵌套列表,普通段落/标题增加块级 margin-left */
  increaseIndent: () => void
  /** 减少缩进:列表中提升列表项,普通段落/标题减少块级 margin-left */
  decreaseIndent: () => void
  /** 设置文字颜色;color 为空字符串则清除颜色 */
  setColor: (color: string) => void
  /** 切换背景高亮;color 为空则清除高亮 */
  toggleHighlight: (color: string) => void
  /** 设置文本对齐 */
  align: (align: 'left' | 'center' | 'right' | 'justify') => void
  /** 下划线(StarterKit 自带 underline 扩展) */
  underline: () => void
  /** 清除所有格式(节点类型 + marks) */
  clearFormat: () => void
  /** 任务列表(toggle) */
  taskList: () => void
}

// 局部类型引入,避免污染对外导出
import type { Ref } from 'vue'

// 图片对齐/尺寸预设类型(供 ProEditorCommands 引用,并对外 re-export)
export type { ImageAlign, ImageSizePreset } from './extensions/image'
export type { CodeBlockLanguage } from './codeBlock'
