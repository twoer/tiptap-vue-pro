import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import type { Extensions } from '@tiptap/core'

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
 * 这里额外补 StarterKit 不含的四类能力:
 *   1. Placeholder —— 空内容占位
 *   2. CharacterCount —— 字数统计
 *   3. Image —— 图片插入(配合上传)
 *   4. TableKit —— 表格(Table/Row/Cell/Header 一站式,v3 合并包)
 *
 * 暂未纳入(第二阶段):
 *   - TaskList: v3 需要显式配 @tiptap/extension-list 的 taskItem 模式,
 *     接入有细节坑,留待后续单独处理,避免污染 Core 的干净构建。
 *
 * StarterKit 的 Link 默认新窗口打开、autolink,满足大多数 CMS 场景。
 * 返回类型用 v3 的 Extensions(同时接受 Extension 和 Node),因为 Image 是 Node。
 */
export function createDefaultExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
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
    Placeholder.configure({
      placeholder: placeholder ?? '请输入内容...',
    }),
    CharacterCount,
    Image.configure({
      inline: false,
      allowBase64: false, // 强制走上传,避免 base64 撑大文档
    }),
    TableKit.configure({
      table: { resizable: true },
    }),
  ]
}
