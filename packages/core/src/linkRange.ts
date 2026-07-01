import type { Editor } from '@tiptap/core'

export interface ActiveLinkRange {
  from: number
  to: number
  text: string
  href: string
  target?: string
}

interface MarkLike {
  type?: unknown
  attrs?: Record<string, unknown>
  eq?: (other: unknown) => boolean
}

interface LinkMarkRange {
  from: number
  to: number
  mark: MarkLike
}

function findMark(marks: readonly unknown[], markType: unknown) {
  return marks.find((mark) => (mark as MarkLike).type === markType) as MarkLike | undefined
}

function sameMark(left: unknown, right: unknown) {
  if (!left || !right) return false
  const mark = left as MarkLike
  return typeof mark.eq === 'function' ? mark.eq(right) : left === right
}

function getLinkMarkRange($pos: unknown, markType: unknown): LinkMarkRange | null {
  if (!$pos) return null
  const resolved = $pos as {
    marks?: () => readonly unknown[]
    parent?: {
      childCount: number
      child: (index: number) => { marks: readonly unknown[]; nodeSize: number }
      childAfter: (offset: number) => { node?: { marks: readonly unknown[]; nodeSize: number }; index: number; offset: number }
      childBefore: (offset: number) => { node?: { marks: readonly unknown[]; nodeSize: number }; index: number; offset: number }
    }
    parentOffset?: number
    start?: () => number
  }
  const activeMark = findMark(resolved.marks?.() ?? [], markType)
  const parent = resolved.parent
  if (!activeMark || !parent || typeof resolved.parentOffset !== 'number' || typeof resolved.start !== 'function') {
    return null
  }

  let child = parent.childAfter(resolved.parentOffset)
  let node = child.node
  let index = child.index
  let offset = child.offset

  if (!node || !sameMark(findMark(node.marks, markType), activeMark)) {
    child = parent.childBefore(resolved.parentOffset)
    node = child.node
    index = child.index
    offset = child.offset
  }
  if (!node || !sameMark(findMark(node.marks, markType), activeMark)) return null

  let from = resolved.start() + offset
  let to = from + node.nodeSize

  for (let i = index - 1; i >= 0; i -= 1) {
    const previous = parent.child(i)
    if (!sameMark(findMark(previous.marks, markType), activeMark)) break
    from -= previous.nodeSize
  }

  for (let i = index + 1; i < parent.childCount; i += 1) {
    const next = parent.child(i)
    if (!sameMark(findMark(next.marks, markType), activeMark)) break
    to += next.nodeSize
  }

  return { from, to, mark: activeMark }
}

function getSelectedLinkRange(editor: Editor, markType: unknown): LinkMarkRange | null {
  const { selection, doc } = editor.state
  const range = getLinkMarkRange(selection.$from, markType)
    ?? getLinkMarkRange(doc.resolve(Math.min(selection.from + 1, selection.to)), markType)

  if (!range) return null
  if (selection.from < range.from || selection.to > range.to) return null

  return {
    ...range,
    from: selection.from,
    to: selection.to,
  }
}

export function getActiveLinkRange(editor: Editor): ActiveLinkRange | null {
  const selection = editor.state.selection
  const markType = editor.state.schema.marks.link
  if (!markType) return null

  const range = selection.empty
    ? getLinkMarkRange(selection.$from, markType)
    : getSelectedLinkRange(editor, markType)

  if (!range) return null
  const attrs = range.mark.attrs as { href?: string; target?: string } | undefined
  if (!attrs?.href) return null

  return {
    from: range.from,
    to: range.to,
    text: editor.state.doc.textBetween(range.from, range.to, ' '),
    href: attrs.href,
    target: attrs.target,
  }
}
