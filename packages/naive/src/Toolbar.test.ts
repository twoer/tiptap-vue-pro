import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import Toolbar from './Toolbar.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

function createEditor(options: { empty?: boolean; inLink?: boolean } = {}) {
  return {
    state: {
      selection: {
        from: 3,
        to: options.empty === false ? 10 : 3,
        empty: options.empty ?? true,
      },
      doc: {
        textBetween: vi.fn(() => '选中文本'),
      },
    },
    isActive: vi.fn((name: string) => name === 'link' && !!options.inLink),
    getAttributes: vi.fn((name: string) => (name === 'link' && options.inLink ? { href: 'https://old.example.com' } : {})),
  }
}

function createCtx(editor?: ReturnType<typeof createEditor>) {
  return {
    editor: ref(editor),
    isActive: vi.fn(() => false),
    commands: {
      setImage: vi.fn(),
      uploadAndInsertImage: vi.fn(),
      insertLinkText: vi.fn(),
      setLink: vi.fn(),
    },
    getHTML: vi.fn(() => '<p>hello</p>'),
    getMarkdown: vi.fn(() => '# hello'),
    importMarkdown: vi.fn(),
    notify: vi.fn(),
    prepareInsert: vi.fn(),
  } as unknown as ProEditorContext & { prepareInsert: ReturnType<typeof vi.fn> }
}

async function clickBodyButton(text: string) {
  await nextTick()
  const button = Array.from(document.body.querySelectorAll('button')).find((node) =>
    node.textContent?.includes(text),
  )
  expect(button).toBeTruthy()
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

function inputByPlaceholder(placeholder: string) {
  const input = document.body.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement | null
  expect(input).toBeTruthy()
  return input!
}

async function setNativeInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('Naive Toolbar', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('网络图片:输入合法地址后插入图片并调用 prepareInsert', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="网络图片"]').trigger('click')
    await nextTick()
    const input = inputByPlaceholder('请输入图片地址 https://...')

    await setNativeInput(input, ' https://example.com/a.png ')
    await clickBodyButton('确定')

    expect(ctx.prepareInsert).toHaveBeenCalledTimes(1)
    expect(ctx.commands.setImage).toHaveBeenCalledWith('https://example.com/a.png')
    expect(ctx.notify).not.toHaveBeenCalledWith('请输入有效的图片地址', 'warning')
  })

  it('网络图片:非法地址给出提示且不插入', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="网络图片"]').trigger('click')
    await nextTick()
    const input = inputByPlaceholder('请输入图片地址 https://...')
    await setNativeInput(input, 'javascript:alert(1)')
    await clickBodyButton('确定')

    expect(ctx.commands.setImage).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('请输入有效的图片地址', 'warning')
  })

  it('视图按钮会抛出预览和全屏事件', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="预览"]').trigger('click')
    await wrapper.find('button[aria-label="全屏"]').trigger('click')

    expect(wrapper.emitted('toggle-preview')).toHaveLength(1)
    expect(wrapper.emitted('toggle-fullscreen')).toHaveLength(1)
  })

  it('链接弹窗:输入文字和 URL 后按保存位置插入链接', async () => {
    const ctx = createCtx(createEditor())
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('显示的文字(留空则用链接地址)'), 'Example')
    await setNativeInput(inputByPlaceholder('https://example.com'), 'https://example.com')
    await clickBodyButton('确定')

    expect(ctx.prepareInsert).toHaveBeenCalledTimes(1)
    expect(ctx.commands.insertLinkText).toHaveBeenCalledWith(
      'https://example.com',
      'Example',
      { target: '_blank', range: { from: 3, to: 3 } },
    )
  })

  it('链接弹窗:非法 URL 给出提示且不写入', async () => {
    const ctx = createCtx(createEditor())
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('https://example.com'), 'not-a-url')
    await clickBodyButton('确定')

    expect(ctx.commands.insertLinkText).not.toHaveBeenCalled()
    expect(ctx.commands.setLink).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('链接格式不正确,请输入完整网址(如 https://example.com)', 'warning')
  })

  it('链接弹窗:当前在链接上且清空地址时移除链接', async () => {
    const ctx = createCtx(createEditor({ inLink: true, empty: false }))
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('https://example.com'), '')
    await clickBodyButton('确定')

    expect(ctx.commands.setLink).toHaveBeenCalledWith('', {
      target: '_blank',
      range: { from: 3, to: 10 },
    })
    expect(ctx.notify).toHaveBeenCalledWith('已移除链接', 'success')
  })

  it('上传图片:选择文件后调用 uploadAndInsertImage 并清空 input', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx, uploadImage: vi.fn() },
    })
    const input = wrapper.find('input[accept="image/*"]').element as HTMLInputElement
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'a.png',
    })

    await wrapper.find('input[accept="image/*"]').trigger('change')

    expect(ctx.commands.uploadAndInsertImage).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
  })
})
