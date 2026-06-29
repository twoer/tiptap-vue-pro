import { Extension } from '@tiptap/core'

export const INDENT_STEP_EM = 2
export const MAX_INDENT_LEVEL = 8

const INDENT_TYPES = ['paragraph', 'heading'] as const

type IndentType = typeof INDENT_TYPES[number]

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockIndent: {
      increaseBlockIndent: () => ReturnType
      decreaseBlockIndent: () => ReturnType
    }
  }
}

function isIndentType(name: string): name is IndentType {
  return INDENT_TYPES.includes(name as IndentType)
}

function clampIndent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_INDENT_LEVEL, Math.round(value)))
}

function parseIndentFromStyle(style: string | null) {
  if (!style) return 0
  const match = style.match(/margin-left:\s*([0-9.]+)em/i)
  if (!match) return 0
  return clampIndent(Number(match[1]) / INDENT_STEP_EM)
}

export const BlockIndent = Extension.create({
  name: 'blockIndent',

  addGlobalAttributes() {
    return [
      {
        types: [...INDENT_TYPES],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const attr = element.getAttribute('data-indent')
              if (attr) return clampIndent(Number(attr))
              return parseIndentFromStyle(element.getAttribute('style'))
            },
            renderHTML: (attrs) => {
              const indent = clampIndent(attrs.indent)
              if (!indent) return {}
              return {
                'data-indent': String(indent),
                style: `margin-left: ${indent * INDENT_STEP_EM}em`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      increaseBlockIndent:
        () =>
        ({ state, dispatch }) => {
          const tr = state.tr
          const { from, to } = state.selection
          let changed = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!isIndentType(node.type.name)) return
            const current = clampIndent(node.attrs.indent ?? 0)
            const next = clampIndent(current + 1)
            if (next === current) return false
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next }, node.marks)
            changed = true
            return false
          })

          if (!changed) return false
          dispatch?.(tr)
          return true
        },
      decreaseBlockIndent:
        () =>
        ({ state, dispatch }) => {
          const tr = state.tr
          const { from, to } = state.selection
          let changed = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!isIndentType(node.type.name)) return
            const current = clampIndent(node.attrs.indent ?? 0)
            const next = clampIndent(current - 1)
            if (next === current) return false
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next }, node.marks)
            changed = true
            return false
          })

          if (!changed) return false
          dispatch?.(tr)
          return true
        },
    }
  },
})
