import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import CodeBlockBubbleMenu from './CodeBlockBubbleMenu.vue'
import { getActiveCodeBlock, resolveLocale, type ProEditorContext } from 'tiptap-vue-pro-core'

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proCodeBlockBubbleMenu' })),
}))

vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    getActiveCodeBlock: vi.fn(),
  }
})

function createEditor(selectedNode = document.createElement('pre')) {
  const chainApi = {
    focus: vi.fn(),
    updateAttributes: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.updateAttributes.mockReturnValue(chainApi)
  chainApi.run.mockReturnValue(true)
  return {
    state: { selection: { from: 4, to: 20 } },
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

function mockActiveCodeBlock() {
  vi.mocked(getActiveCodeBlock).mockReturnValue({
    from: 4,
    to: 20,
    attrs: { language: 'javascript' },
    language: 'javascript',
    text: 'const answer = 42',
  })
}

function restoreClipboard() {
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor)
  } else {
    delete (navigator as unknown as { clipboard?: Clipboard }).clipboard
  }
}

async function clickBodyText(text: string) {
  await nextTick()
  const node = Array.from(document.body.querySelectorAll('*')).find((item) =>
    item.textContent?.trim() === text,
  ) as HTMLElement | undefined
  expect(node).toBeTruthy()
  const target = (node!.closest('.el-dropdown-menu__item') as HTMLElement | null) ?? node!
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

describe('Element Plus CodeBlockBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    restoreClipboard()
    vi.restoreAllMocks()
  })

  it('注册独立的代码块 BubbleMenu 插件并锚定代码块', () => {
    mockActiveCodeBlock()
    const selectedNode = document.createElement('pre')
    const rect = new DOMRect(10, 20, 320, 80)
    vi.spyOn(selectedNode, 'getBoundingClientRect').mockReturnValue(rect)
    const editor = createEditor(selectedNode)
    wrapper = mount(CodeBlockBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    const calls = vi.mocked(BubbleMenuPlugin).mock.calls
    const options = calls[calls.length - 1]?.[0]
    const virtualElement = options?.getReferencedVirtualElement?.()

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)
    expect(options?.pluginKey).toBe('proCodeBlockBubbleMenu')
    expect(options?.shouldShow?.({ editor: editor as never, element: document.createElement('div'), state: editor.state as never, view: {} as never, oldState: undefined as never, from: 4, to: 20 })).toBe(true)
    expect(virtualElement?.getBoundingClientRect()).toBe(rect)
  })

  it('可以切换语言并复制代码', async () => {
    mockActiveCodeBlock()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const editor = createEditor()
    const ctx = createCtx()
    wrapper = mount(CodeBlockBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx },
    })

    const javascriptIcon = wrapper.find('[data-language-icon="javascript"]')
    expect(javascriptIcon.attributes('viewBox')).toBe('0 0 32 32')
    expect(javascriptIcon.find('path').attributes('fill')).toBe('#f5de19')
    await wrapper.find('button[aria-label="代码语言"]').trigger('click')
    expect(document.body.querySelector('.tvp-el-action-dropdown')).toBeTruthy()
    expect(document.body.querySelector('.tvp-el-code-language-dropdown')).toBeTruthy()
    expect(document.body.querySelector('[data-language-icon="typescript"]')).toBeTruthy()
    await clickBodyText('TypeScript')
    await wrapper.find('button[aria-label="复制代码"]').trigger('click')

    expect(editor.chainApi.updateAttributes).toHaveBeenCalledWith('codeBlock', { language: 'typescript' })
    expect(writeText).toHaveBeenCalledWith('const answer = 42')
    expect(ctx.notify).toHaveBeenCalledWith('已复制代码', 'success')
  })
})
