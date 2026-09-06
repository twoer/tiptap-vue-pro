import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Editor } from '@tiptap/core'
import {
  MATH_NODE_VIEW_CONTEXT,
  useMathNodeView,
  type MathNodeViewContext,
  type MathNodeViewProps,
} from './mathNodeView'
import { createDefaultExtensions } from './extensions'
import type { MathRenderOptions, MathRenderState, MathRenderer } from './mathRenderer'
import type { LocaleTranslate } from './locale'

const editors: Editor[] = []

function newEditor(): Editor {
  const editor = new Editor({
    extensions: createDefaultExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
  editors.push(editor)
  return editor
}

function createMathNode(editor: Editor, kind: 'inline' | 'block', latex: string) {
  const nodeName = kind === 'block' ? 'mathBlock' : 'mathInline'
  const type = editor.state.schema.nodes[nodeName]
  if (!type) throw new Error(`schema missing ${nodeName}`)
  return type.create({ latex })
}

/**
 * 宿主组件:真实走 useMathNodeView 的挂载/监听/卸载生命周期,
 * 通过 expose 把 view 暴露给测试断言(context 在 mount 时经 provide 注入)。
 */
function createHost() {
  return defineComponent({
    props: { node: { type: Object, required: true }, editor: { type: Object, required: true } },
    setup(props: MathNodeViewProps) {
      const view = useMathNodeView(props)
      return { view }
    },
    render() {
      return h('div', this.view.renderState.value.status)
    },
  })
}

async function flush() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

/** katex 走动态 import,首次渲染需真实等待模块加载完成 */
async function waitForStatus(
  view: ReturnType<typeof useMathNodeView>,
  status: MathRenderState['status'],
) {
  await vi.waitFor(() => {
    expect(view.renderState.value.status).toBe(status)
  }, { timeout: 3000 })
}

describe('useMathNodeView', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    while (editors.length) editors.pop()?.destroy()
  })

  function mountView(
    editor: Editor,
    node: MathNodeViewProps['node'],
    context?: MathNodeViewContext,
  ) {
    const Host = createHost()
    wrapper = mount(Host, {
      props: { node, editor },
      global: context ? { provide: { [MATH_NODE_VIEW_CONTEXT as symbol]: context } } : {},
    })
    return (wrapper.vm as unknown as { view: ReturnType<typeof useMathNodeView> }).view
  }

  it('块级公式按 displayMode 渲染(真实 KaTeX),状态进入 ready', async () => {
    const editor = newEditor()
    const view = mountView(editor, createMathNode(editor, 'block', '\\frac{1}{2}'))
    await waitForStatus(view, 'ready')

    expect(view.renderState.value.html).toContain('katex-display')
    expect(view.isBlock.value).toBe(true)
    expect(view.latex.value).toBe('\\frac{1}{2}')
  })

  it('行内公式不含 katex-display', async () => {
    const editor = newEditor()
    const view = mountView(editor, createMathNode(editor, 'inline', 'x^2'))
    await waitForStatus(view, 'ready')

    expect(view.renderState.value.html).not.toContain('katex-display')
  })

  it('空源码保持 idle(reset),不发起渲染', async () => {
    const editor = newEditor()
    const view = mountView(editor, createMathNode(editor, 'block', '   '))
    await flush()

    expect(view.renderState.value).toEqual({ status: 'idle', html: '', error: '' })
  })

  it('非法源码进入 error 状态并带出错误信息', async () => {
    const editor = newEditor()
    const view = mountView(editor, createMathNode(editor, 'inline', '\\fra'))
    await waitForStatus(view, 'error')

    expect(view.renderState.value.error).toMatch(/parse error/i)
    expect(view.renderState.value.html).toBe('')
  })

  it('latex 变化触发重新渲染', async () => {
    const editor = newEditor()
    const view = mountView(editor, createMathNode(editor, 'inline', 'a+b'))
    await waitForStatus(view, 'ready')

    wrapper!.setProps({ node: createMathNode(editor, 'inline', 'c+d'), editor })
    await vi.waitFor(() => {
      expect(view.renderState.value.html).toContain('c+d')
    }, { timeout: 3000 })
  })

  it('宿主注入的 render 优先生效,并透传 katexOptions', async () => {
    const render = vi.fn(async (_latex: string, _options: MathRenderOptions) => '<span>custom</span>')
    const editor = new Editor({
      extensions: createDefaultExtensions(undefined, {}, {
        math: { render, katexOptions: { macros: { '\\RR': '\\mathbb{R}' } } },
      }),
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    editors.push(editor)

    const view = mountView(editor, createMathNode(editor, 'block', '\\RR'))
    await waitForStatus(view, 'ready')

    expect(render).toHaveBeenCalledWith('\\RR', {
      displayMode: true,
      katexOptions: { macros: { '\\RR': '\\mathbb{R}' } },
    })
    expect(view.renderState.value.html).toBe('<span>custom</span>')
  })

  it('卸载后迟到的渲染结果不再写入状态(cancel 生效)', async () => {
    let resolveRender!: (html: string) => void
    const render: MathRenderer = () => new Promise(resolve => { resolveRender = resolve })
    const editor = new Editor({
      extensions: createDefaultExtensions(undefined, {}, { math: { render } }),
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    editors.push(editor)

    const view = mountView(editor, createMathNode(editor, 'inline', 'x'))
    await flush()
    expect(view.renderState.value.status).toBe('loading')

    wrapper!.unmount()
    wrapper = undefined
    resolveRender('<span>late</span>')
    await flush()

    expect(view.renderState.value.status).toBe('loading')
  })

  it('注入 context 时 dark/editable/t 来自 context', async () => {
    const editor = newEditor()
    const context: MathNodeViewContext = {
      dark: ref(true),
      editable: ref(false),
      t: ((key: string) => `zh:${key}`) as LocaleTranslate,
    }
    const view = mountView(editor, createMathNode(editor, 'inline', 'x'), context)

    expect(view.theme.value).toBe('dark')
    expect(view.editable.value).toBe(false)
    expect(view.t('math.node.label')).toBe('zh:math.node.label')
  })

  it('未注入 context 时回退编辑器 editable,t 回退返回 key 本身', async () => {
    const editor = newEditor()
    editor.setEditable(false)
    const view = mountView(editor, createMathNode(editor, 'inline', 'x'))

    expect(view.editable.value).toBe(false)
    expect(view.theme.value).toBe('light')
    expect(view.t('math.node.label')).toBe('math.node.label')
  })

  it('context 的 dark 支持响应式更新', async () => {
    const editor = newEditor()
    const dark = ref(false)
    const context: MathNodeViewContext = {
      dark,
      editable: computed(() => true),
      t: (() => '') as unknown as LocaleTranslate,
    }
    const view = mountView(editor, createMathNode(editor, 'inline', 'x'), context)
    expect(view.theme.value).toBe('light')

    dark.value = true
    await nextTick()
    expect(view.theme.value).toBe('dark')
  })
})
