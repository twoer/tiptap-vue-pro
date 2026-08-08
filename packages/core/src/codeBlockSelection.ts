import type { Editor } from '@tiptap/core'

export interface ActiveCodeBlock {
  from: number
  to: number
  attrs: Record<string, unknown>
  language: string
  text: string
}

interface CodeBlockLikeNode {
  type: { name: string }
  attrs: Record<string, unknown>
  textContent: string
}

export function getActiveCodeBlock(editor: Editor): ActiveCodeBlock | null {
  const selection = (editor as { state?: { selection?: unknown } }).state?.selection
  if (!selection) return null
  const selectedNode = (selection as { node?: CodeBlockLikeNode }).node
  if (selectedNode?.type.name === 'codeBlock') {
    return {
      from: (selection as { from: number }).from,
      to: (selection as { to: number }).to,
      attrs: selectedNode.attrs,
      language: String(selectedNode.attrs.language ?? 'plaintext'),
      text: selectedNode.textContent,
    }
  }

  const { $from } = selection as {
    $from?: {
      depth: number
      node: (depth: number) => CodeBlockLikeNode
      before: (depth: number) => number
      after: (depth: number) => number
    }
  }
  if (!$from) return null
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'codeBlock') continue
    return {
      from: $from.before(depth),
      to: $from.after(depth),
      attrs: node.attrs,
      language: String(node.attrs.language ?? 'plaintext'),
      text: node.textContent,
    }
  }

  return null
}
