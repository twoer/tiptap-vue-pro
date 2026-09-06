import type { Editor } from '@tiptap/core'

export type SelectedMathKind = 'inline' | 'block'

export interface ActiveMathNode {
  from: number
  to: number
  kind: SelectedMathKind
  latex: string
}

/**
 * 当前选区是否为公式节点(NodeSelection)。驱动 MathBubbleMenu 的可见性,
 * 以及编辑弹层打开前保存 { from, to, kind }——弹层失焦后按保存位置回写,
 * 不依赖 DOM selection(mediaSelection / horizontalRuleSelection 同款模式)。
 */
export function getSelectedMathNode(editor: Editor): ActiveMathNode | null {
  const selection = editor.state.selection as {
    from: number
    to: number
    node?: {
      type: { name: string }
      attrs: Record<string, unknown>
    }
  }
  const node = selection.node
  if (!node) return null
  const name = node.type.name
  if (name !== 'mathInline' && name !== 'mathBlock') return null

  return {
    from: selection.from,
    to: selection.to,
    kind: name === 'mathBlock' ? 'block' : 'inline',
    latex: String(node.attrs.latex ?? ''),
  }
}
