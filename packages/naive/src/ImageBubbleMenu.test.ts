import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ImageBubbleMenu from './ImageBubbleMenu.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proImageBubbleMenu' })),
}))

function createEditor(selectedNode: HTMLElement) {
  const chainApi = {
    focus: vi.fn(),
    updateAttributes: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.updateAttributes.mockReturnValue(chainApi)
  chainApi.run.mockReturnValue(true)
  const root = document.createElement('div')
  root.innerHTML = '<div class="tvp-img-node"><input class="tvp-img-caption" value="first" /></div>'
  root.appendChild(selectedNode)
  document.body.appendChild(root)

  return {
    state: {
      selection: {
        from: 8,
        node: {
          type: { name: 'image' },
          attrs: { align: 'center' },
        },
      },
    },
    view: {
      dom: root,
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
    commands: {
      setImageAlign: vi.fn(),
      setImageSize: vi.fn(),
      removeImage: vi.fn(),
    },
    notify: vi.fn(),
  } as unknown as ProEditorContext
}

function buttonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text().includes(text))
  expect(button).toBeTruthy()
  return button!
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Naive ImageBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('编辑题注会聚焦当前选中图片的题注,而不是第一张图', async () => {
    const selectedNode = document.createElement('div')
    selectedNode.className = 'tvp-img-node'
    selectedNode.innerHTML = '<input class="tvp-img-caption" value="second" />'
    const editor = createEditor(selectedNode)
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    await wrapper.find('button[aria-label="编辑题注"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const selectedInput = selectedNode.querySelector('.tvp-img-caption')
    expect(document.activeElement).toBe(selectedInput)
    expect(editor.view.nodeDOM).toHaveBeenCalledWith(8)
  })

  it('卸载时清理 BubbleMenu 插件和 selectionUpdate 监听', () => {
    const selectedNode = document.createElement('div')
    selectedNode.innerHTML = '<input class="tvp-img-caption" />'
    const editor = createEditor(selectedNode)
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)
    expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))

    wrapper.unmount()

    expect(editor.unregisterPlugin).toHaveBeenCalledWith('proImageBubbleMenu')
    expect(editor.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
  })

  it('editor 切换时迁移 BubbleMenu 插件和 selectionUpdate 监听', async () => {
    const selectedNode = document.createElement('div')
    selectedNode.innerHTML = '<input class="tvp-img-caption" />'
    const first = createEditor(selectedNode)
    const second = createEditor(selectedNode)
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: { editor: first as never, ctx: createCtx() },
    })

    await wrapper.setProps({ editor: second as never })

    expect(first.unregisterPlugin).toHaveBeenCalledWith('proImageBubbleMenu')
    expect(first.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(second.registerPlugin).toHaveBeenCalledTimes(1)
    expect(second.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
  })

  it('尺寸、对齐、删除按钮会调用对应图片命令', async () => {
    const selectedNode = document.createElement('div')
    selectedNode.innerHTML = '<input class="tvp-img-caption" />'
    const ctx = createCtx()
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor(selectedNode) as never, ctx },
    })

    await buttonByText(wrapper, '小').trigger('click')
    await wrapper.find('button[aria-label="右对齐"]').trigger('click')
    await wrapper.find('button[aria-label="删除图片"]').trigger('click')
    await wait(260)

    expect(ctx.commands.setImageSize).toHaveBeenCalledWith('small')
    expect(ctx.commands.setImageAlign).toHaveBeenCalledWith('right')
    expect(ctx.commands.removeImage).toHaveBeenCalledTimes(1)
  })

  it('替换图片成功时更新当前图片 src', async () => {
    const selectedNode = document.createElement('div')
    selectedNode.innerHTML = '<input class="tvp-img-caption" />'
    const editor = createEditor(selectedNode)
    const uploadImage = vi.fn(async () => 'https://example.com/new.png')
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx(), uploadImage },
    })
    const file = new File(['img'], 'new.png', { type: 'image/png' })
    const input = wrapper.find('input[accept="image/*"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'new.png',
    })

    await wrapper.find('button[aria-label="替换图片"]').trigger('click')
    await wrapper.find('input[accept="image/*"]').trigger('change')

    expect(uploadImage).toHaveBeenCalledWith(file)
    expect(editor.chainApi.updateAttributes).toHaveBeenCalledWith('image', { src: 'https://example.com/new.png' })
    expect(editor.chainApi.run).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('')
  })

  it('editorBehaviorOptions 可配置替换图片 accept', () => {
    const selectedNode = document.createElement('div')
    selectedNode.innerHTML = '<input class="tvp-img-caption" />'
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: {
        editor: createEditor(selectedNode) as never,
        ctx: createCtx(),
        uploadImage: vi.fn(),
        editorBehaviorOptions: {
          image: { accept: 'image/png,image/jpeg' },
        },
      },
    })

    expect(wrapper.find('input[accept="image/png,image/jpeg"]').exists()).toBe(true)
  })

  it('替换图片失败时提示上传失败', async () => {
    const selectedNode = document.createElement('div')
    selectedNode.innerHTML = '<input class="tvp-img-caption" />'
    const ctx = createCtx()
    const uploadImage = vi.fn(async () => null)
    wrapper = mount(ImageBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor(selectedNode) as never, ctx, uploadImage },
    })
    const file = new File(['img'], 'bad.png', { type: 'image/png' })
    const input = wrapper.find('input[accept="image/*"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.find('input[accept="image/*"]').trigger('change')

    expect(uploadImage).toHaveBeenCalledWith(file)
    expect(ctx.notify).toHaveBeenCalledWith('图片上传失败', 'error')
  })
})
