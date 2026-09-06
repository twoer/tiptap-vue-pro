import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import MathBubbleMenu from './MathBubbleMenu.vue'
import { getSelectedMathNode, resolveLocale, type ProEditorContext } from 'tiptap-vue-pro-core'

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proMathBubbleMenu' })),
}))

vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    getSelectedMathNode: vi.fn(),
  }
})

function createEditor(selectedNode = document.createElement('span')) {
  const chainApi = {
    focus: vi.fn(),
    deleteMath: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.deleteMath.mockReturnValue(chainApi)
  chainApi.run.mockReturnValue(true)
  return {
    state: { selection: { from: 4, to: 5 } },
    isEditable: true,
    view: {
      nodeDOM: vi.fn(() => selectedNode),
    },
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    chain: vi.fn(() => chainApi),
    chainApi,
  }
}

function createCtx() {
  return {
    commands: {},
    notify: vi.fn(),
    t: resolveLocale().t,
  } as unknown as ProEditorContext
}

function mockSelectedMath(kind: 'inline' | 'block' = 'inline') {
  vi.mocked(getSelectedMathNode).mockReturnValue({
    from: 4,
    to: 5,
    kind,
    latex: 'x^2',
  })
}

describe('MathBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('渲染编辑与删除两个动作', () => {
    mockSelectedMath()
    const editor = createEditor()
    wrapper = mount(MathBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    expect(wrapper.find('button[aria-label="编辑公式"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="删除公式"]').exists()).toBe(true)
    expect(BubbleMenuPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ pluginKey: 'proMathBubbleMenu' }),
    )
  })

  it('点击编辑向外发出公式节点信息(由 ProEditor 打开弹层)', async () => {
    mockSelectedMath('block')
    const editor = createEditor()
    wrapper = mount(MathBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="编辑公式"]').trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('edit')![0]).toEqual([
      { from: 4, to: 5, kind: 'block', latex: 'x^2' },
    ])
  })

  it('点击删除按保存的节点位置调用 deleteMath', async () => {
    mockSelectedMath('inline')
    const editor = createEditor()
    wrapper = mount(MathBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="删除公式"]').trigger('click')

    expect(editor.chainApi.deleteMath).toHaveBeenCalledWith({ from: 4 })
  })

  it('未选中公式时点击删除不产生任何命令', async () => {
    vi.mocked(getSelectedMathNode).mockReturnValue(null)
    const editor = createEditor()
    wrapper = mount(MathBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="删除公式"]').trigger('click')

    expect(editor.chainApi.deleteMath).not.toHaveBeenCalled()
  })
})
