import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import MediaBubbleMenu from './MediaBubbleMenu.vue'
import { getSelectedMediaNode, resolveLocale, type ProEditorContext } from 'tiptap-vue-pro-core'

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proMediaBubbleMenu' })),
}))

vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    getSelectedMediaNode: vi.fn(),
  }
})

function createEditor(selectedNode = document.createElement('video')) {
  const editorRoot = document.createElement('div')
  editorRoot.className = 'tvp-editor'
  const editorDom = document.createElement('div')
  editorDom.className = 'ProseMirror'
  editorRoot.appendChild(editorDom)
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
      dom: editorDom,
      nodeDOM: vi.fn(() => selectedNode),
    },
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    chain: vi.fn(() => chainApi),
    chainApi,
    editorRoot,
  }
}

function createCtx() {
  return {
    commands: {
      setMediaSize: vi.fn(),
    },
    notify: vi.fn(),
    t: resolveLocale().t,
  } as unknown as ProEditorContext
}

function mockSelectedMedia() {
  vi.mocked(getSelectedMediaNode).mockReturnValue({
    from: 4,
    to: 5,
    type: 'video',
    src: 'https://example.com/movie.mp4',
    name: 'movie.mp4',
    attrs: {
      src: 'https://example.com/movie.mp4',
      name: 'movie.mp4',
      mimeType: 'video/mp4',
      duration: 120,
      poster: 'https://example.com/movie.jpg',
      controls: true,
      muted: false,
      loop: false,
      autoplay: false,
      playsInline: true,
      preload: 'metadata',
      allowFullscreen: true,
      allowDownload: true,
      allowPictureInPicture: true,
      width: 640,
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

describe('Naive MediaBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    restoreClipboard()
    vi.restoreAllMocks()
  })

  it('注册独立的 media BubbleMenu 插件并锚定选中媒体节点', () => {
    mockSelectedMedia()
    const selectedNode = document.createElement('video')
    const rect = new DOMRect(10, 20, 320, 180)
    vi.spyOn(selectedNode, 'getBoundingClientRect').mockReturnValue(rect)
    const editor = createEditor(selectedNode)
    wrapper = mount(MediaBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    const calls = vi.mocked(BubbleMenuPlugin).mock.calls
    const options = calls[calls.length - 1]?.[0]
    const virtualElement = options?.getReferencedVirtualElement?.()

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)
    expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(options?.pluginKey).toBe('proMediaBubbleMenu')
    expect(typeof options?.appendTo).toBe('function')
    expect((options?.appendTo as () => HTMLElement)()).toBe(editor.editorRoot)
    expect(options?.options).toEqual(expect.objectContaining({
      strategy: 'fixed',
      placement: 'top',
      flip: { padding: 8 },
      shift: { padding: 8 },
    }))
    expect(options?.shouldShow?.({ editor: editor as never, element: document.createElement('div'), state: editor.state as never, view: {} as never, oldState: undefined as never, from: 4, to: 5 })).toBe(true)
    expect(virtualElement?.getBoundingClientRect()).toBe(rect)
  })

  it('编辑弹窗会更新媒体显示属性', async () => {
    mockSelectedMedia()
    const editor = createEditor()
    wrapper = mount(MediaBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="编辑媒体"]').trigger('click')
    await nextTick()
    const nameInput = Array.from(document.body.querySelectorAll('input')).find((input) => input.value === 'movie.mp4') as HTMLInputElement
    const posterInput = Array.from(document.body.querySelectorAll('input')).find((input) => input.value === 'https://example.com/movie.jpg') as HTMLInputElement
    await setInput(nameInput, 'final.mp4')
    await setInput(posterInput, 'https://example.com/final.jpg')
    const confirm = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('确定'))
    confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(editor.chainApi.updateAttributes).toHaveBeenCalledWith('video', expect.objectContaining({
      name: 'final.mp4',
      poster: 'https://example.com/final.jpg',
      controls: true,
      allowDownload: true,
      allowFullscreen: true,
      allowPictureInPicture: true,
    }))
    expect(editor.chainApi.run).toHaveBeenCalledTimes(1)
  })

  it('打开、下载、复制和删除动作使用当前媒体属性', async () => {
    mockSelectedMedia()
    const ctx = createCtx()
    const editor = createEditor()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    wrapper = mount(MediaBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx },
    })

    await wrapper.find('button[aria-label="打开媒体"]').trigger('click')
    await wrapper.find('button[aria-label="下载媒体"]').trigger('click')
    await wrapper.find('button[aria-label="复制媒体链接"]').trigger('click')
    await wrapper.find('button[aria-label="删除媒体"]').trigger('click')
    await nextTick()

    expect(openSpy).toHaveBeenCalledWith('https://example.com/movie.mp4', '_blank', 'noopener,noreferrer')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('https://example.com/movie.mp4')
    expect(ctx.notify).toHaveBeenCalledWith('已复制媒体链接', 'success')
    expect(editor.chainApi.deleteSelection).toHaveBeenCalledTimes(1)
    expect(ctx.notify).toHaveBeenCalledWith('已删除媒体', 'success')
  })

  it('可关闭元素 toolbar 的成功提示', async () => {
    mockSelectedMedia()
    const ctx = createCtx()
    const editor = createEditor()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    wrapper = mount(MediaBubbleMenu, {
      attachTo: document.body,
      props: {
        editor: editor as never,
        ctx,
        editorBehaviorOptions: { feedback: { elementToolbarSuccess: false } },
      },
    })

    await wrapper.find('button[aria-label="复制媒体链接"]').trigger('click')
    await wrapper.find('button[aria-label="删除媒体"]').trigger('click')
    await nextTick()

    expect(writeText).toHaveBeenCalledWith('https://example.com/movie.mp4')
    expect(editor.chainApi.deleteSelection).toHaveBeenCalledTimes(1)
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('媒体播放器可以切换成文件卡片节点', async () => {
    mockSelectedMedia()
    const editor = createEditor()
    wrapper = mount(MediaBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="显示为文件"]').trigger('click')

    expect(editor.chainApi.insertContentAt).toHaveBeenCalledWith(
      { from: 4, to: 5 },
      {
        type: 'fileAttachment',
        attrs: expect.objectContaining({
          href: 'https://example.com/movie.mp4',
          name: 'movie.mp4',
          mimeType: 'video/mp4',
          mediaKind: 'video',
          duration: 120,
          poster: 'https://example.com/movie.jpg',
          controls: true,
          allowDownload: true,
        }),
      },
    )
  })

  it('尺寸按钮会调用媒体尺寸命令', async () => {
    mockSelectedMedia()
    const ctx = createCtx()
    const editor = createEditor()
    wrapper = mount(MediaBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx },
    })

    const mediumButton = wrapper.findAll('button').find((button) => button.text() === '中')
    await mediumButton!.trigger('click')

    expect(ctx.commands.setMediaSize).toHaveBeenCalledWith('medium')
  })
})
