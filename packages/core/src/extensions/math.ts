import { InputRule, mergeAttributes, Node, type NodeViewRenderer } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { NodeSelection } from '@tiptap/pm/state'
import type { MathRenderer, SafeKatexOptions } from '../mathRenderer'

export interface MathNodeOptions {
  HTMLAttributes: Record<string, unknown>
  /** 注入自定义「LaTeX → HTML」渲染函数(替换引擎/服务端预渲染用) */
  render?: MathRenderer
  /** 安全透传的 KaTeX 配置(trust/output/throwOnError 由 core 固定) */
  katexOptions?: SafeKatexOptions
  /** adapter 注入各自的 Vue NodeView(mermaid 的 nodeViewRenderer 同款模式) */
  nodeViewRenderer?: NodeViewRenderer
}

export const MATH_NODE_NAMES = ['mathInline', 'mathBlock'] as const
export type MathNodeName = typeof MATH_NODE_NAMES[number]

export const DEFAULT_MATH_INLINE_LATEX = 'a^2 + b^2 = c^2'
export const DEFAULT_MATH_BLOCK_LATEX = 'E = mc^2'

export function isMathNodeName(name: string): name is MathNodeName {
  return name === 'mathInline' || name === 'mathBlock'
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /** 插入行内公式。不传 latex 时用默认示例,便于用户直接改源码 */
      insertMathInline: (options?: { latex?: string; pos?: number }) => ReturnType
      /** 插入块级公式(slash command / 工具栏入口) */
      insertMathBlock: (options?: { latex?: string; pos?: number }) => ReturnType
      /**
       * 更新公式源码。优先用保存的 from(编辑弹层失焦后 selection 不可靠,
       * 按 { from } 绝对位置回写);不传 from 时退回当前 NodeSelection 中的公式节点。
       */
      updateMath: (options: { latex: string; from?: number }) => ReturnType
      /**
       * 转换公式类型(行内 ↔ 块级)并写入新源码,单事务单步撤销。
       * - 行内 → 块级:整段只有这一个公式时整段替换;混排时块级插到段落后、行内移除(内容无损);
       * - 块级 → 行内:替换为包含行内公式的段落(行内节点必须住在段落里)。
       * 类型未变时退化为仅更新源码。
       */
      convertMath: (options: { kind: 'inline' | 'block'; latex?: string; from?: number }) => ReturnType
      /** 删除公式节点。from 语义同 updateMath */
      deleteMath: (options?: { from?: number }) => ReturnType
    }
  }
}

/**
 * 行内 `$...$` 输入规则。约束(刻意收窄,规避货币误判):
 * - 内容非空、不含 `$`、不跨行,且首尾不能是空白(闭合 `$` 前贴空白视为普通文本);
 * - 起始 `$` 前不能是反斜杠(转义美元)、`$`、字母或数字;
 * - 结束 `$` 后不能紧跟字母或数字。
 * 已知取舍:「$5 and 3$」这类与合法公式「$2x$」在纯语法层不可区分,会按公式转换
 * (Pandoc/Obsidian 同样如此),需要货币语义时用 `\$` 转义。
 */
export const INLINE_MATH_INPUT_REGEX = /(?<![\\$A-Za-z0-9])\$([^$\s](?:[^$\n]*[^$\s])?)\$(?![A-Za-z0-9])/

function resolveMathFrom(
  state: EditorState,
  from?: number,
): { from: number; node: PMNode } | null {
  if (typeof from === 'number') {
    const node = state.doc.nodeAt(from)
    if (node && isMathNodeName(node.type.name)) return { from, node }
  }
  if (state.selection instanceof NodeSelection) {
    const node = state.selection.node
    if (node && isMathNodeName(node.type.name)) {
      return { from: state.selection.from, node }
    }
  }
  return null
}

function mathNodeOptions(): MathNodeOptions {
  return {
    HTMLAttributes: {},
    render: undefined,
    katexOptions: undefined,
    nodeViewRenderer: undefined,
  }
}

export const MathInline = Node.create<MathNodeOptions>({
  name: 'mathInline',

  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  marks: '',

  addOptions() {
    return mathNodeOptions()
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex') ?? '',
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-type="math-inline"]' },
      // 官方 @tiptap/extension-mathematics 的互操作格式,粘贴可直接还原
      { tag: 'span[data-type="inline-math"]' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'math-inline',
        'data-latex': String(node.attrs.latex ?? ''),
      }),
    ]
  },

  // v1 只做导出兜底($latex$ 保留源码,导入侧 tokenizer 留 v1.x 解决货币误判)
  renderMarkdown: node => {
    const latex = String(node.attrs?.latex ?? '').trim()
    return latex ? `$${latex}$` : ''
  },

  addCommands() {
    return {
      // 插入后把选区落到新节点(NodeSelection):气泡菜单立即出现,
      // adapter 据此直接打开编辑弹层——用户插入后第一件事就是改源码
      insertMathInline:
        options => ({ chain, state }) => {
          const anchor = options?.pos ?? state.selection.from
          return chain()
            .insertContentAt(anchor, {
              type: this.name,
              attrs: { latex: options?.latex ?? DEFAULT_MATH_INLINE_LATEX },
            })
            .command(({ tr, dispatch }) => {
              if (!dispatch) return true
              let target: number | null = null
              tr.doc.nodesBetween(Math.max(0, anchor - 2), Math.min(anchor + 256, tr.doc.content.size), (node, pos) => {
                if (target === null && node.type.name === this.name) target = pos
              })
              if (target !== null) tr.setSelection(NodeSelection.create(tr.doc, target))
              return true
            })
            .run()
        },
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: INLINE_MATH_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const [, latex] = match
          const node = this.type.create({ latex })
          const { tr } = state
          tr.replaceWith(range.from, range.to, node)
        },
      }),
    ]
  },

  addNodeView() {
    return this.options.nodeViewRenderer ?? null
  },
})

export const MathBlock = Node.create<MathNodeOptions>({
  name: 'mathBlock',

  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,
  marks: '',

  addOptions() {
    return mathNodeOptions()
  },

  // 宿主通过 ProEditorOptions.math 注入的 render/katexOptions 存放在此
  // (两个节点共享同一份配置),useMathNodeView 每次渲染时读取
  addStorage() {
    return {
      getKatexOptions: () => this.options.katexOptions,
      getRender: () => this.options.render,
    }
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex') ?? '',
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="math-block"]' },
      // 官方 @tiptap/extension-mathematics 的互操作格式
      { tag: 'div[data-type="block-math"]' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'math-block',
        'data-latex': String(node.attrs.latex ?? ''),
      }),
    ]
  },

  markdownTokenName: 'mathBlock',

  parseMarkdown: (token, helpers) =>
    helpers.createNode('mathBlock', { latex: String(token.latex ?? '') }),

  renderMarkdown: node => {
    const latex = String(node.attrs?.latex ?? '').trim()
    return latex ? ['$$', latex, '$$'].join('\n') : ''
  },

  markdownTokenizer: {
    name: 'mathBlock',
    level: 'block',
    start: (src: string) => src.indexOf('$$'),
    tokenize: (src: string) => {
      // 独占行的 $$...$$ 块(内容可含换行,参考 GitHub/Obsidian 行规)
      const match = src.match(/^\$\$([\s\S]+?)\$\$(?:\n|$)/)
      if (!match) return undefined
      return {
        type: 'mathBlock',
        raw: match[0],
        latex: match[1].trim(),
      }
    },
  },

  addCommands() {
    return {
      // 同 insertMathInline:插入后选中新节点,adapter 自动打开编辑弹层
      insertMathBlock:
        options => ({ chain, state }) => {
          const anchor = options?.pos ?? state.selection.from
          return chain()
            .insertContentAt(anchor, {
              type: this.name,
              attrs: { latex: options?.latex ?? DEFAULT_MATH_BLOCK_LATEX },
            })
            .command(({ tr, dispatch }) => {
              if (!dispatch) return true
              let target: number | null = null
              tr.doc.nodesBetween(Math.max(0, anchor - 2), Math.min(anchor + 256, tr.doc.content.size), (node, pos) => {
                if (target === null && node.type.name === this.name) target = pos
              })
              if (target !== null) tr.setSelection(NodeSelection.create(tr.doc, target))
              return true
            })
            .run()
        },
      updateMath:
        options => ({ state, tr }) => {
          const target = resolveMathFrom(state, options.from)
          if (!target) return false
          tr.setNodeMarkup(target.from, undefined, { ...target.node.attrs, latex: options.latex })
          return true
        },
      convertMath:
        options => ({ state, tr }) => {
          const targetName = options.kind === 'block' ? 'mathBlock' : 'mathInline'
          const targetType = state.schema.nodes[targetName]
          if (!targetType) return false
          const target = resolveMathFrom(state, options.from)
          if (!target) return false

          const { from, node } = target
          const latex = options.latex ?? String(node.attrs.latex ?? '')

          if (node.type.name === targetName) {
            // 类型未变:退化为仅更新源码
            tr.setNodeMarkup(from, undefined, { ...node.attrs, latex })
            return true
          }

          let selectPos: number
          if (options.kind === 'block') {
            const $pos = state.doc.resolve(from)
            const parent = $pos.parent
            const block = targetType.create({ latex })
            if (parent.type.name === 'paragraph' && parent.childCount === 1) {
              // 整段只有这一个行内公式:整段替换为块级(参考块级输入规则的整段替换)
              tr.replaceWith($pos.before(), $pos.after(), block)
              selectPos = tr.mapping.map($pos.before())
            } else {
              // 与文字混排:行内公式从句中移除(文字无损),块级插到当前段落之后。
              // 先删后插:插入位置经映射计算,同时就是新块的选区位置
              const blockPos = $pos.after()
              tr.delete(from, from + node.nodeSize)
              const insertAt = tr.mapping.map(blockPos)
              tr.insert(insertAt, block)
              selectPos = insertAt
            }
          } else {
            // 块级 → 行内:行内节点必须住在段落里,替换为包含它的段落
            const inline = targetType.create({ latex })
            tr.replaceWith(from, from + node.nodeSize, state.schema.nodes.paragraph.create(null, inline))
            selectPos = tr.mapping.map(from) + 1
          }

          tr.setSelection(NodeSelection.create(tr.doc, selectPos))
          tr.scrollIntoView()
          return true
        },
      deleteMath:
        options => ({ state, tr }) => {
          const target = resolveMathFrom(state, options?.from)
          if (!target) return false
          tr.delete(target.from, target.from + target.node.nodeSize)
          tr.scrollIntoView()
          return true
        },
    }
  },

  addInputRules() {
    return [
      new InputRule({
        // 整个段落恰为 $$...$$ 时整段替换为块级公式。
        // 官方 @tiptap/extension-mathematics 的 canReplaceHostTextblock 逻辑:
        // 公式占满宿主 textblock 时直接替换段落本身,避免残留空段。
        find: /^\$\$([^$]+)\$\$$/,
        handler: ({ state, range, match }) => {
          const [, latex] = match
          const { tr } = state
          const $from = state.doc.resolve(range.from)
          const node = this.type.create({ latex: latex.trim() })

          const consumesHostTextblock =
            $from.depth > 0 &&
            $from.parent.isTextblock &&
            range.from === $from.start() &&
            range.to === $from.end()
          const canReplaceHostTextblock =
            consumesHostTextblock &&
            $from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), this.type)

          const replacementRange = canReplaceHostTextblock
            ? { from: $from.before(), to: $from.after() }
            : range
          tr.replaceWith(replacementRange.from, replacementRange.to, node)
        },
      }),
    ]
  },

  addNodeView() {
    return this.options.nodeViewRenderer ?? null
  },
})

