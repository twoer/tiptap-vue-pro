import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { getActiveCodeBlock } from './codeBlockSelection'
import { getSelectedFileAttachment } from './fileAttachmentSelection'
import { getSelectedHorizontalRule } from './horizontalRuleSelection'
import { getActiveLinkRange } from './linkRange'
import { getSelectedMediaNode } from './mediaSelection'

/**
 * 通用文字 BubbleMenu 的显隐谓词,三个 UI 适配器共用:
 *
 * - 仅在有非空选区时显示(纯光标点击不弹)
 * - 链接范围由 LinkBubbleMenu 独占,避免与普通文字 bubble 同时出现
 * - 文件附件/媒体节点/分割线/代码块选中时由各自的 BubbleMenu 接管
 * - 表格内选文字时不弹文字气泡——表格气泡独占,表格内的文字格式化用顶部工具栏
 */
export function shouldShowTextBubbleMenu(editor: Editor, state: EditorState): boolean {
  if (state.selection.empty) return false
  if (getActiveLinkRange(editor)) return false
  if (getSelectedFileAttachment(editor)) return false
  if (getSelectedMediaNode(editor)) return false
  if (getSelectedHorizontalRule(editor)) return false
  if (getActiveCodeBlock(editor)) return false
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name
    if (name === 'tableCell' || name === 'tableHeader') return false
  }
  return true
}
