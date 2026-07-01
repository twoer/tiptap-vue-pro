import type { Editor } from '@tiptap/core'

export interface ActiveFileAttachment {
  from: number
  to: number
  attrs: Record<string, unknown>
  href: string
  name: string
}

export function getSelectedFileAttachment(editor: Editor): ActiveFileAttachment | null {
  const selection = editor.state.selection as {
    from: number
    to: number
    node?: {
      type: { name: string }
      attrs: Record<string, unknown>
    }
  }
  const node = selection.node
  if (!node || node.type.name !== 'fileAttachment') return null
  const href = String(node.attrs.href ?? '')
  if (!href) return null

  return {
    from: selection.from,
    to: selection.to,
    attrs: node.attrs,
    href,
    name: String(node.attrs.name || href),
  }
}
