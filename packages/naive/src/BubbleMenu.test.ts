import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import BubbleMenu from './BubbleMenu.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proBubbleMenu' })),
}))

function createEditor(inLink = false) {
  return {
    getAttributes: vi.fn((name: string) => (name === 'link' && inLink ? { href: 'https://old.example.com' } : {})),
    isActive: vi.fn((name: string) => name === 'link' && inLink),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
  }
}

function createCtx() {
  return {
    isActive: vi.fn(() => false),
    commands: {
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn(),
      strike: vi.fn(),
      clearFormat: vi.fn(),
      setLink: vi.fn(),
    },
    notify: vi.fn(),
  } as unknown as ProEditorContext
}

async function setQuickLink(value: string) {
  const input = document.body.querySelector('input[placeholder="https://"]') as HTMLInputElement | null
  expect(input).toBeTruthy()
  input!.value = value
  input!.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function clickConfirm() {
  const button = document.body.querySelector('button[aria-label="确定链接"]')
  expect(button).toBeTruthy()
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

describe('Naive BubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('快捷链接:空地址提示且不写入', async () => {
    const ctx = createCtx()
    wrapper = mount(BubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setQuickLink('   ')
    await clickConfirm()

    expect(ctx.commands.setLink).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('请填写链接地址', 'warning')
  })

  it('快捷链接:非法 URL 给出提示且不写入', async () => {
    const ctx = createCtx()
    wrapper = mount(BubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setQuickLink('javascript:alert(1)')
    await clickConfirm()

    expect(ctx.commands.setLink).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('链接格式不正确,请输入完整网址(如 https://example.com)', 'warning')
  })

  it('快捷链接:已有链接清空地址时移除链接', async () => {
    const ctx = createCtx()
    wrapper = mount(BubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor(true) as never, ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setQuickLink('')
    await clickConfirm()

    expect(ctx.commands.setLink).toHaveBeenCalledWith('')
    expect(ctx.notify).toHaveBeenCalledWith('已移除链接', 'success')
  })

  it('editor 切换时从旧实例卸载 BubbleMenu 插件并注册新实例', async () => {
    const ctx = createCtx()
    const first = createEditor()
    const second = createEditor()
    wrapper = mount(BubbleMenu, {
      attachTo: document.body,
      props: { editor: first as never, ctx },
    })

    await wrapper.setProps({ editor: second as never })

    expect(first.unregisterPlugin).toHaveBeenCalledWith('proBubbleMenu')
    expect(second.registerPlugin).toHaveBeenCalledTimes(1)
  })
})
