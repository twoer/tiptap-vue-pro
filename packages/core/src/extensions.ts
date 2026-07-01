import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { ImageExtended as Image } from './extensions/image'
import { AudioExtended, FileAttachment, VideoExtended, type FileAttachmentOptions } from './extensions/media'
import {
  TextStyle,
  FontFamily,
  FontSize,
  LineHeight,
} from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Markdown as MarkdownExtension } from '@tiptap/markdown'
import type { Extensions } from '@tiptap/core'
import { codeBlockLowlight } from './codeBlock'
import { BlockIndent } from './extensions/blockIndent'
import { HorizontalRuleExtended } from './extensions/horizontalRule'
import { RangeSelectionDecorations } from './extensions/rangeSelection'
import type { EditorExtensionConfig } from './extensionRegistry'

export type { Extensions } from '@tiptap/core'

/**
 * 默认扩展包。
 *
 * Tiptap v3 的 StarterKit 已经非常完整,自带:
 *   Document, Paragraph, Text, History(undo/redo),
 *   Bold, Italic, Strike, Underline, Code,
 *   Heading(1-6), Blockquote, CodeBlock, HorizontalRule, HardBreak,
 *   BulletList, OrderedList, ListItem(来自 @tiptap/extension-list),
 *   Link, Dropcursor, TrailingNode。
 *
 * 这里额外补 StarterKit 不含的能力:
 *   1. Placeholder —— 空内容占位
 *   2. CharacterCount —— 字数统计
 *   3. Image —— 图片插入(配合上传)
 *   4. TableKit —— 表格(Table/Row/Cell/Header 一站式,v3 合并包)
 *   5. TextStyle + FontFamily + FontSize + LineHeight + Color —— 行内文字样式
 *   6. Highlight —— 文字背景高亮(multicolor 支持多色)
 *   7. TaskList + TaskItem —— 任务列表(checkbox),来自 @tiptap/extension-list
 *      (v3 中 TaskList/TaskItem 都在 extension-list,不是独立的 task-list 包)
 *   8. CodeBlockLowlight —— 带语言 class 与语法高亮的代码块。
 *   9. Superscript + Subscript —— 上标 / 下标,用于公式、脚注、化学式等。
 *   10. BlockIndent —— 段落/标题块级缩进,列表缩进走原生 list item 命令。
 *   11. Video / Audio / FileAttachment —— 视频、音频、文件附件节点。
 *   12. Markdown —— 官方 @tiptap/markdown,提供导入/导出 MD 能力。
 *      无对应 MD 语法的样式(颜色/高亮/对齐)在导出时会被丢弃——这是
 *      Markdown 格式本身的局限,非本组件能力缺失。
 *
 * StarterKit 的 Link 默认新窗口打开、autolink,满足大多数 CMS 场景。
 * 返回类型用 v3 的 Extensions(同时接受 Extension 和 Node),因为 Image 是 Node。
 */
export function createDefaultExtensions(
  placeholder?: string,
  config: EditorExtensionConfig = {},
  options: {
    fileAttachment?: FileAttachmentOptions
  } = {},
): Extensions {
  const enabled = {
    placeholder: true,
    starterKit: true,
    characterCount: true,
    image: true,
    table: true,
    typography: true,
    highlight: true,
    textAlign: true,
    blockIndent: true,
    codeBlock: true,
    script: true,
    taskList: true,
    media: true,
    rangeSelection: true,
    markdown: true,
    ...config,
  }
  const extensions: Extensions = []

  if (enabled.starterKit) {
    extensions.push(
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
          },
        },
      }),
    )
    extensions.push(HorizontalRuleExtended)
  }

  if (enabled.placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: placeholder ?? '请输入内容...',
      }),
    )
  }

  if (enabled.characterCount) {
    extensions.push(CharacterCount)
  }

  if (enabled.image) {
    extensions.push(Image) // ImageExtended:在官方基础上开启 resize + 预留 align/caption 属性(对标飞书)
  }

  if (enabled.table) {
    extensions.push(
      TableKit.configure({
        table: { resizable: true },
      }),
    )
  }

  if (enabled.typography) {
    extensions.push(
      // 行内文字样式:字体/字号/行高/颜色均依赖 TextStyle mark
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize.configure({ types: ['textStyle'] }),
      LineHeight.configure({ types: ['textStyle'] }),
      Color,
    )
  }

  if (enabled.highlight) {
    // 背景高亮:multicolor 允许多种颜色共存
    extensions.push(Highlight.configure({ multicolor: true }))
  }

  if (enabled.textAlign) {
    // 文本对齐:作用于段落和标题
    extensions.push(TextAlign.configure({ types: ['heading', 'paragraph'] }))
  }

  if (enabled.blockIndent) {
    // 段落/标题缩进:列表缩进由 sink/liftListItem 维护嵌套结构
    extensions.push(BlockIndent)
  }

  if (enabled.codeBlock) {
    // 代码块:替换 StarterKit 的纯文本 CodeBlock,增加 lowlight 高亮
    extensions.push(
      CodeBlockLowlight.configure({
        lowlight: codeBlockLowlight,
        defaultLanguage: 'plaintext',
        languageClassPrefix: 'language-',
      }),
    )
  }

  if (enabled.script) {
    // 上标 / 下标:StarterKit 不包含,需单独接入
    extensions.push(Superscript, Subscript)
  }

  if (enabled.taskList) {
    // 任务列表:TaskList 需要 TaskItem 提供 checkbox 行为
    extensions.push(TaskList, TaskItem.configure({ nested: true }))
  }

  if (enabled.media) {
    extensions.push(
      VideoExtended,
      AudioExtended,
      options.fileAttachment ? FileAttachment.configure(options.fileAttachment) : FileAttachment,
    )
  }

  if (enabled.rangeSelection) {
    extensions.push(RangeSelectionDecorations)
  }

  if (enabled.markdown) {
    // Markdown 导入/导出:官方扩展,自动接管 setContent(contentType:'markdown')
    // 并提供 editor.storage.markdown.manager 用于序列化
    extensions.push(MarkdownExtension)
  }

  return extensions
}
