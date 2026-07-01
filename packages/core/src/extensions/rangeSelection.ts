import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const RANGE_SELECTED_NODE_TYPES = new Set([
  'image',
  'video',
  'audio',
  'fileAttachment',
  'horizontalRule',
])

export const RangeSelectionDecorations = Extension.create({
  name: 'rangeSelectionDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { selection, doc } = state
            if (selection.empty || 'node' in selection) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            const { from, to } = selection
            doc.descendants((node, pos) => {
              if (!RANGE_SELECTED_NODE_TYPES.has(node.type.name)) return
              const nodeFrom = pos
              const nodeTo = pos + node.nodeSize
              if (nodeTo <= from || nodeFrom >= to) return
              decorations.push(Decoration.node(nodeFrom, nodeTo, {
                class: 'tvp-range-selected-node',
              }))
            })

            return decorations.length > 0
              ? DecorationSet.create(doc, decorations)
              : DecorationSet.empty
          },
        },
      }),
    ]
  },
})
