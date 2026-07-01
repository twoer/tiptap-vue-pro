import type { Editor } from '@tiptap/core'
import {
  normalizeHorizontalRuleVariant,
  type HorizontalRuleVariant,
} from './extensions/horizontalRule'

export interface ActiveHorizontalRule {
  from: number
  to: number
  attrs: Record<string, unknown>
  variant: HorizontalRuleVariant
}

export function getSelectedHorizontalRule(editor: Editor): ActiveHorizontalRule | null {
  const selection = editor.state.selection as {
    from: number
    to: number
    node?: {
      type: { name: string }
      attrs: Record<string, unknown>
    }
  }
  const node = selection.node
  if (!node || node.type.name !== 'horizontalRule') return null

  return {
    from: selection.from,
    to: selection.to,
    attrs: node.attrs,
    variant: normalizeHorizontalRuleVariant(node.attrs.variant),
  }
}
