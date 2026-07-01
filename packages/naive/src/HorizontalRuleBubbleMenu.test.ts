import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import HorizontalRuleBubbleMenu from './HorizontalRuleBubbleMenu.vue'
import { getSelectedHorizontalRule, resolveLocale, type ProEditorContext } from 'tiptap-vue-pro-core'

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proHorizontalRuleBubbleMenu' })),
}))

vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    getSelectedHorizontalRule: vi.fn(),
  }
})

function createEditor(selectedNode = document.createElement('hr')) {
  const chainApi = {
    focus: vi.fn(),
    updateAttributes: vi.fn(),
    deleteSelection: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.updateAttributes.mockReturnValue(chainApi)
  chainApi.deleteSelection.mockReturnValue(chainApi)
  chainApi.run.mockReturnValue(true)
  return {
    state: { selection: { from: 4, to: 5 } },
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

function mockSelectedRule() {
  vi.mocked(getSelectedHorizontalRule).mockReturnValue({
    from: 4,
    to: 5,
    variant: 'solid',
    attrs: { variant: 'solid' },
  })
}

describe('Naive HorizontalRuleBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('注册独立的 HR BubbleMenu 插件并锚定选中分割线', () => {
    mockSelectedRule()
    const selectedNode = document.createElement('hr')
    const rect = new DOMRect(10, 20, 320, 8)
    vi.spyOn(selectedNode, 'getBoundingClientRect').mockReturnValue(rect)
    const editor = createEditor(selectedNode)
    wrapper = mount(HorizontalRuleBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    const calls = vi.mocked(BubbleMenuPlugin).mock.calls
    const options = calls[calls.length - 1]?.[0]
    const virtualElement = options?.getReferencedVirtualElement?.()

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)
    expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(options?.pluginKey).toBe('proHorizontalRuleBubbleMenu')
    expect(options?.shouldShow?.({ editor: editor as never, element: document.createElement('div'), state: editor.state as never, view: {} as never, oldState: undefined as never, from: 4, to: 5 })).toBe(true)
    expect(virtualElement?.getBoundingClientRect()).toBe(rect)
  })

  it('可以切换分割线样式并删除', async () => {
    mockSelectedRule()
    const editor = createEditor()
    wrapper = mount(HorizontalRuleBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="虚线"]').trigger('click')
    await wrapper.find('button[aria-label="删除分割线"]').trigger('click')

    expect(editor.chainApi.updateAttributes).toHaveBeenCalledWith('horizontalRule', { variant: 'dashed' })
    expect(editor.chainApi.deleteSelection).toHaveBeenCalledTimes(1)
  })
})
