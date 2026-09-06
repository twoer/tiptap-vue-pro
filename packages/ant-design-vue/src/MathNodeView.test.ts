import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MathNodeView from './MathNodeView.vue'
import { resolveLocale, type MathNodeViewContext } from 'tiptap-vue-pro-core'
import { MATH_NODE_VIEW_CONTEXT } from 'tiptap-vue-pro-core'
import type { NodeViewProps } from '@tiptap/vue-3'

const t = resolveLocale().t

function createNodeProps(kind: 'inline' | 'block', latex: string) {
  return {
    node: { type: { name: kind === 'block' ? 'mathBlock' : 'mathInline' }, attrs: { latex } },
    editor: { isEditable: true, extensionStorage: {} },
  } as unknown as NodeViewProps
}

function mountNodeView(kind: 'inline' | 'block', latex: string, context?: MathNodeViewContext) {
  return mount(MathNodeView, {
    props: createNodeProps(kind, latex),
    attachTo: document.body,
    global: context ? { provide: { [MATH_NODE_VIEW_CONTEXT as symbol]: context } } : {},
  })
}

async function waitForReady(wrapper: VueWrapper) {
  // KaTeX 走动态 import,首次渲染需真实等待模块加载完成
  await vi.waitFor(() => {
    expect(wrapper.element.getAttribute('data-render-status')).toBe('ready')
  }, { timeout: 3000 })
}

describe('MathNodeView', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('行内公式渲染为 span,带 data-type / data-latex / ready 状态与 KaTeX HTML', async () => {
    wrapper = mountNodeView('inline', 'x^2')
    await waitForReady(wrapper)

    const el = wrapper.element
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('data-type')).toBe('math-inline')
    expect(el.getAttribute('data-latex')).toBe('x^2')
    expect(el.classList.contains('is-inline')).toBe(true)
    expect(wrapper.find('.tvp-math-render .katex').exists()).toBe(true)
    // 未注入 context 时 t 回退为 key 本身(mathNodeView 的显式设计)
    expect(el.getAttribute('aria-label')).toBe('math.node.label')
  })

  it('块级公式渲染为 div,displayMode 输出 katex-display', async () => {
    wrapper = mountNodeView('block', '\\frac{1}{2}')
    await waitForReady(wrapper)

    const el = wrapper.element
    expect(el.tagName).toBe('DIV')
    expect(el.getAttribute('data-type')).toBe('math-block')
    expect(el.classList.contains('is-block')).toBe(true)
    expect(wrapper.find('.tvp-math-render .katex-display').exists()).toBe(true)
  })

  it('空源码显示空态提示,不发起渲染', async () => {
    wrapper = mountNodeView('block', '')
    await Promise.resolve()

    expect(wrapper.element.getAttribute('data-render-status')).toBe('idle')
    // 未注入 context 时展示 key 本身
    expect(wrapper.text()).toContain('math.render.empty')
    expect(wrapper.find('.tvp-math-render').exists()).toBe(false)
  })

  it('非法源码显示错误态并回显源码', async () => {
    wrapper = mountNodeView('inline', '\\fra')
    await vi.waitFor(() => {
      expect(wrapper!.element.getAttribute('data-render-status')).toBe('error')
    }, { timeout: 3000 })

    expect(wrapper.text()).toContain('math.render.error')
    expect(wrapper.find('code.tvp-math-source').text()).toBe('\\fra')
  })

  it('注入 context 的 editable 控制可编辑类,locale 走 context 的 t;未注入时回退编辑器状态', async () => {
    wrapper = mountNodeView('inline', 'x', {
      dark: { value: false },
      editable: { value: false },
      t,
    })
    expect(wrapper.element.classList.contains('is-editable')).toBe(false)
    expect(wrapper.element.getAttribute('aria-label')).toBe(t('math.node.label'))

    const editableWrapper = mountNodeView('inline', 'x')
    expect(editableWrapper.element.classList.contains('is-editable')).toBe(true)
    editableWrapper.unmount()
  })
})
