import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import FileBubbleMenu from './FileBubbleMenu.vue'
import { getSelectedFileAttachment, resolveLocale, type ProEditorContext } from 'tiptap-vue-pro-core'

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proFileBubbleMenu' })),
}))

vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    getSelectedFileAttachment: vi.fn(),
  }
})

function createEditor(selectedNode = document.createElement('a')) {
  const chainApi = {
    focus: vi.fn(),
    insertContentAt: vi.fn(),
    updateAttributes: vi.fn(),
    deleteSelection: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.insertContentAt.mockReturnValue(chainApi)
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

function mockSelectedFile() {
  vi.mocked(getSelectedFileAttachment).mockReturnValue({
    from: 4,
    to: 5,
    href: 'https://example.com/report.pdf',
    name: 'report.pdf',
    attrs: {
      href: 'https://example.com/report.pdf',
      name: 'report.pdf',
      fileTypeText: 'PDF',
      showIcon: true,
      showName: true,
      showSize: true,
      showMimeType: false,
      showUploadedAt: false,
      showDuration: true,
      openInNewTab: true,
      download: true,
    },
  })
}

function mockSelectedVideoFile() {
  vi.mocked(getSelectedFileAttachment).mockReturnValue({
    from: 4,
    to: 5,
    href: 'https://example.com/movie.mp4',
    name: 'movie.mp4',
    attrs: {
      href: 'https://example.com/movie.mp4',
      name: 'movie.mp4',
      mimeType: 'video/mp4',
      mediaKind: 'video',
      duration: 120,
      poster: 'https://example.com/movie.jpg',
      controls: false,
      muted: true,
      loop: true,
      autoplay: true,
      playsInline: false,
      preload: 'auto',
      allowFullscreen: false,
      allowDownload: false,
      allowPictureInPicture: false,
      width: 640,
      showIcon: true,
      showName: true,
      showSize: true,
      showMimeType: false,
      showUploadedAt: false,
      showDuration: true,
      openInNewTab: true,
      download: true,
    },
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

describe('Element Plus FileBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    restoreClipboard()
    vi.restoreAllMocks()
  })

  it('注册独立的 file BubbleMenu 插件并锚定选中文件卡片', () => {
    mockSelectedFile()
    const selectedNode = document.createElement('a')
    selectedNode.className = 'tvp-file-attachment'
    const rect = new DOMRect(10, 20, 240, 42)
    vi.spyOn(selectedNode, 'getBoundingClientRect').mockReturnValue(rect)
    const editor = createEditor(selectedNode)
    wrapper = mount(FileBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    const calls = vi.mocked(BubbleMenuPlugin).mock.calls
    const options = calls[calls.length - 1]?.[0]
    const virtualElement = options?.getReferencedVirtualElement?.()

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)
    expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(options?.pluginKey).toBe('proFileBubbleMenu')
    expect(options?.shouldShow?.({ editor: editor as never, element: document.createElement('div'), state: editor.state as never, view: {} as never, oldState: undefined as never, from: 4, to: 5 })).toBe(true)
    expect(virtualElement?.getBoundingClientRect()).toBe(rect)
  })

  it('编辑弹窗会更新文件显示属性', async () => {
    mockSelectedFile()
    const editor = createEditor()
    wrapper = mount(FileBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="编辑文件"]').trigger('click')
    await nextTick()
    const nameInput = Array.from(document.body.querySelectorAll('input')).find((input) => input.value === 'report.pdf') as HTMLInputElement
    await setInput(nameInput, 'final.pdf')
    const confirm = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('确定'))
    confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(editor.chainApi.updateAttributes).toHaveBeenCalledWith('fileAttachment', expect.objectContaining({
      name: 'final.pdf',
      fileTypeText: 'PDF',
      showIcon: true,
      showName: true,
      showSize: true,
      openInNewTab: true,
      download: true,
    }))
    expect(editor.chainApi.run).toHaveBeenCalledTimes(1)
  })

  it('打开、下载、复制和删除动作使用当前文件属性', async () => {
    mockSelectedFile()
    const ctx = createCtx()
    const editor = createEditor()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    wrapper = mount(FileBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx },
    })

    await wrapper.find('button[aria-label="打开文件"]').trigger('click')
    await wrapper.find('button[aria-label="下载文件"]').trigger('click')
    await wrapper.find('button[aria-label="复制文件链接"]').trigger('click')
    await wrapper.find('button[aria-label="删除文件"]').trigger('click')
    await nextTick()

    expect(openSpy).toHaveBeenCalledWith('https://example.com/report.pdf', '_blank', 'noopener,noreferrer')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('https://example.com/report.pdf')
    expect(ctx.notify).toHaveBeenCalledWith('已复制文件链接', 'success')
    expect(editor.chainApi.deleteSelection).toHaveBeenCalledTimes(1)
    expect(ctx.notify).toHaveBeenCalledWith('已删除文件', 'success')
  })

  it('可关闭元素 toolbar 的成功提示', async () => {
    mockSelectedFile()
    const ctx = createCtx()
    const editor = createEditor()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    wrapper = mount(FileBubbleMenu, {
      attachTo: document.body,
      props: {
        editor: editor as never,
        ctx,
        editorBehaviorOptions: { feedback: { elementToolbarSuccess: false } },
      },
    })

    await wrapper.find('button[aria-label="复制文件链接"]').trigger('click')
    await wrapper.find('button[aria-label="删除文件"]').trigger('click')
    await nextTick()

    expect(writeText).toHaveBeenCalledWith('https://example.com/report.pdf')
    expect(editor.chainApi.deleteSelection).toHaveBeenCalledTimes(1)
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('媒体文件卡片可以切换回播放器节点', async () => {
    mockSelectedVideoFile()
    const editor = createEditor()
    wrapper = mount(FileBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="显示为播放器"]').trigger('click')

    expect(editor.chainApi.insertContentAt).toHaveBeenCalledWith(
      { from: 4, to: 5 },
      {
        type: 'video',
        attrs: expect.objectContaining({
          src: 'https://example.com/movie.mp4',
          name: 'movie.mp4',
          mimeType: 'video/mp4',
          poster: 'https://example.com/movie.jpg',
          controls: false,
          muted: true,
          loop: true,
          autoplay: true,
          playsInline: false,
          preload: 'auto',
          allowFullscreen: false,
          allowDownload: false,
          allowPictureInPicture: false,
          width: 640,
        }),
      },
    )
    expect(editor.chainApi.run).toHaveBeenCalledTimes(1)
  })
})
