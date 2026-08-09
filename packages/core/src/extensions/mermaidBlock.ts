import { Node, mergeAttributes, type NodeViewRenderer } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { getDefaultMermaidSource, mermaidMarkdownFence, normalizeMermaidViewMode, type MermaidViewMode } from '../mermaid'

export interface MermaidBlockOptions {
  HTMLAttributes: Record<string, unknown>
  defaultSource: string
  defaultViewMode: MermaidViewMode
  nodeViewRenderer?: NodeViewRenderer
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      insertMermaidBlock: (options?: { source?: string; viewMode?: MermaidViewMode }) => ReturnType
      setMermaidViewMode: (viewMode: MermaidViewMode) => ReturnType
    }
  }
}

export function replaceMermaidBlockSource(
  view: EditorView,
  getPos: () => number | undefined,
  source: string,
): boolean {
  const pos = getPos()
  if (typeof pos !== 'number') return false
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'mermaidBlock') return false

  const from = pos + 1
  const to = pos + node.nodeSize - 1
  const tr = source
    ? view.state.tr.replaceWith(from, to, view.state.schema.text(source))
    : view.state.tr.delete(from, to)
  view.dispatch(tr)
  return true
}

export const MermaidBlock = Node.create<MermaidBlockOptions>({
  name: 'mermaidBlock',
  priority: 110,
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultSource: getDefaultMermaidSource(),
      defaultViewMode: 'split',
      nodeViewRenderer: undefined,
    }
  },

  addAttributes() {
    return {
      viewMode: {
        default: this.options.defaultViewMode,
        parseHTML: element => normalizeMermaidViewMode(element.getAttribute('data-view-mode')),
      },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-type="mermaid-block"]',
      preserveWhitespace: 'full',
      contentElement: (element: HTMLElement) => element.querySelector('code') ?? element,
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mermaid-block',
        'data-view-mode': normalizeMermaidViewMode(node.attrs.viewMode),
      }),
      ['pre', ['code', { class: 'language-mermaid' }, 0]],
    ]
  },

  markdownTokenName: 'code',

  parseMarkdown(token, helpers) {
    if (String(token.lang ?? '').trim().toLowerCase() !== 'mermaid') return []
    return helpers.createNode(
      'mermaidBlock',
      { viewMode: 'split' },
      token.text ? [helpers.createTextNode(token.text)] : [],
    )
  },

  renderMarkdown(node, helpers) {
    return mermaidMarkdownFence(node.content ? helpers.renderChildren(node.content) : '')
  },

  addCommands() {
    return {
      insertMermaidBlock: options => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: {
          viewMode: normalizeMermaidViewMode(options?.viewMode ?? this.options.defaultViewMode),
        },
        content: (options?.source ?? this.options.defaultSource)
          ? [{ type: 'text', text: options?.source ?? this.options.defaultSource }]
          : [],
      }),
      setMermaidViewMode: viewMode => ({ commands }) => commands.updateAttributes(
        this.name,
        { viewMode: normalizeMermaidViewMode(viewMode) },
      ),
    }
  },

  addNodeView() {
    return this.options.nodeViewRenderer ?? null
  },
})
