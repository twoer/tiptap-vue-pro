import { canInsertNode, isNodeSelection, mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

export const HORIZONTAL_RULE_VARIANTS = ['solid', 'thick', 'dashed', 'dotted'] as const
export type HorizontalRuleVariant = typeof HORIZONTAL_RULE_VARIANTS[number]

export interface HorizontalRuleAttributes {
  variant?: HorizontalRuleVariant
}

export interface HorizontalRuleOptions {
  HTMLAttributes: Record<string, unknown>
  nextNodeType: string
}

export function normalizeHorizontalRuleVariant(value: unknown): HorizontalRuleVariant {
  return HORIZONTAL_RULE_VARIANTS.includes(value as HorizontalRuleVariant)
    ? value as HorizontalRuleVariant
    : 'solid'
}

export const HorizontalRuleExtended = Node.create<HorizontalRuleOptions>({
  name: 'horizontalRule',

  addOptions() {
    return {
      HTMLAttributes: {},
      nextNodeType: 'paragraph',
    }
  },

  group: 'block',

  addAttributes() {
    return {
      variant: {
        default: 'solid',
        parseHTML: (element: HTMLElement) =>
          normalizeHorizontalRuleVariant(element.getAttribute('data-hr-variant')),
        renderHTML: (attributes: HorizontalRuleAttributes) => {
          const variant = normalizeHorizontalRuleVariant(attributes.variant)
          return variant === 'solid' ? {} : { 'data-hr-variant': variant }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'hr' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  markdownTokenName: 'hr',

  parseMarkdown: (_token, helpers) => helpers.createNode('horizontalRule'),

  renderMarkdown: () => '---',

  addInputRules() {
    return [
      nodeInputRule({
        find: /^(?:---|—-|___\s|\*\*\*\s)$/,
        type: this.type,
      }),
    ]
  },
})

export function insertHorizontalRule(
  editor: Editor,
  attrs: HorizontalRuleAttributes = {},
): boolean {
  const type = editor.schema.nodes.horizontalRule
  if (!type || !canInsertNode(editor.state, type)) return false

  const variant = normalizeHorizontalRuleVariant(attrs.variant)
  const rule = { type: 'horizontalRule', attrs: { variant } }
  const { selection } = editor.state
  const { $to: $originTo } = selection
  const chain = editor.chain().focus()

  if (isNodeSelection(selection)) {
    chain.insertContentAt($originTo.pos, rule)
  } else {
    chain.insertContent(rule)
  }

  return chain
    .command(({ state, tr, dispatch }) => {
      if (!dispatch) return true

      const { $to } = tr.selection
      const posAfter = $to.end()

      if ($to.nodeAfter) {
        if ($to.nodeAfter.isTextblock) {
          tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1))
        } else if ($to.nodeAfter.isBlock) {
          tr.setSelection(NodeSelection.create(tr.doc, $to.pos))
        } else {
          tr.setSelection(TextSelection.create(tr.doc, $to.pos))
        }
      } else {
        const nodeType = state.schema.nodes.paragraph || $to.parent.type.contentMatch.defaultType
        const node = nodeType?.create()

        if (node) {
          tr.insert(posAfter, node)
          tr.setSelection(TextSelection.create(tr.doc, posAfter + 1))
        }
      }

      tr.scrollIntoView()
      return true
    })
    .run()
}
