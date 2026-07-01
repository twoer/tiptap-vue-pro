import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import LinkBubbleMenu from './LinkBubbleMenu.vue'
import { getActiveLinkRange, resolveLocale, type ProEditorContext } from 'tiptap-vue-pro-core'

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proLinkBubbleMenu' })),
}))

vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    getActiveLinkRange: vi.fn(),
  }
})

function createEditor(inTable = false) {
  return {
    state: {
      selection: {
        $from: {
          depth: inTable ? 1 : 0,
          node: vi.fn(() => ({ type: { name: inTable ? 'tableCell' : 'paragraph' } })),
        },
      },
    },
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
}

function createCtx() {
  return {
    commands: {
      setLink: vi.fn(),
      insertLinkText: vi.fn(),
    },
    notify: vi.fn(),
    t: resolveLocale().t,
  } as unknown as ProEditorContext
}

function mockActiveLink() {
  vi.mocked(getActiveLinkRange).mockReturnValue({
    from: 3,
    to: 9,
    text: '旧链接',
    href: 'https://old.example.com',
    target: '_blank',
  })
}

function restoreClipboard() {
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor)
  } else {
    delete (navigator as unknown as { clipboard?: Clipboard }).clipboard
  }
}

async function setInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('Naive LinkBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    restoreClipboard()
    vi.restoreAllMocks()
  })

  it('注册独立的 link BubbleMenu 插件,并在表格内隐藏', () => {
    mockActiveLink()
    const editor = createEditor()
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)
    expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))

    const calls = vi.mocked(BubbleMenuPlugin).mock.calls
    const options = calls[calls.length - 1]?.[0]
    expect(options?.pluginKey).toBe('proLinkBubbleMenu')
    expect(options?.shouldShow?.({ editor: editor as never, element: document.createElement('div'), state: editor.state as never, view: {} as never, oldState: undefined as never, from: 3, to: 9 })).toBe(true)

    const tableEditor = createEditor(true)
    expect(options?.shouldShow?.({ editor: tableEditor as never, element: document.createElement('div'), state: tableEditor.state as never, view: {} as never, oldState: undefined as never, from: 3, to: 9 })).toBe(false)
  })

  it('打开编辑弹窗会预填当前链接,确认后按保存的 range 更新文字和 href', async () => {
    mockActiveLink()
    const ctx = createCtx()
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="编辑链接"]').trigger('click')
    await nextTick()

    const inputs = Array.from(document.body.querySelectorAll('input')) as HTMLInputElement[]
    const textInput = inputs.find((input) => input.value === '旧链接')
    const hrefInput = inputs.find((input) => input.value === 'https://old.example.com')
    expect(textInput).toBeTruthy()
    expect(hrefInput).toBeTruthy()

    await setInput(textInput!, '新链接')
    await setInput(hrefInput!, 'https://new.example.com')
    const confirm = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('确定'))
    expect(confirm).toBeTruthy()
    confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(ctx.commands.insertLinkText).toHaveBeenCalledWith('https://new.example.com', '新链接', {
      target: '_blank',
      range: { from: 3, to: 9 },
    })
  })

  it('编辑弹窗清空 href 时移除链接并保留文字', async () => {
    mockActiveLink()
    const ctx = createCtx()
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="编辑链接"]').trigger('click')
    await nextTick()
    const hrefInput = Array.from(document.body.querySelectorAll('input')).find((input) => input.value === 'https://old.example.com') as HTMLInputElement
    await setInput(hrefInput, '')
    const confirm = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('确定'))
    confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(ctx.commands.setLink).toHaveBeenCalledWith('', {
      target: '_blank',
      range: { from: 3, to: 9 },
    })
    expect(ctx.notify).toHaveBeenCalledWith('已移除链接', 'success')
  })

  it('复制按钮会写入当前链接 URL 并提示成功', async () => {
    mockActiveLink()
    const ctx = createCtx()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="复制链接"]').trigger('click')
    await nextTick()

    expect(writeText).toHaveBeenCalledWith('https://old.example.com')
    expect(ctx.notify).toHaveBeenCalledWith('已复制链接', 'success')
  })

  it('可关闭元素 toolbar 的成功提示', async () => {
    mockActiveLink()
    const ctx = createCtx()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: {
        editor: createEditor() as never,
        ctx,
        editorBehaviorOptions: { feedback: { elementToolbarSuccess: false } },
      },
    })

    await wrapper.find('button[aria-label="复制链接"]').trigger('click')
    await nextTick()

    expect(writeText).toHaveBeenCalledWith('https://old.example.com')
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('复制按钮在剪贴板不可用时给出提示且不抛错', async () => {
    mockActiveLink()
    const ctx = createCtx()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="复制链接"]').trigger('click')

    expect(ctx.notify).toHaveBeenCalledWith('当前环境不支持剪贴板复制', 'warning')
  })

  it('打开和移除按钮使用当前完整链接 range', async () => {
    mockActiveLink()
    const ctx = createCtx()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrapper = mount(LinkBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="打开链接"]').trigger('click')
    await wrapper.find('button[aria-label="移除链接"]').trigger('click')

    expect(openSpy).toHaveBeenCalledWith('https://old.example.com', '_blank', 'noopener,noreferrer')
    expect(ctx.commands.setLink).toHaveBeenCalledWith('', { range: { from: 3, to: 9 } })
    expect(ctx.notify).toHaveBeenCalledWith('已移除链接', 'success')
  })
})
