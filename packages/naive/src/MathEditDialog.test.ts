import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MathEditDialog from './MathEditDialog.vue'
import { createMathRenderController, resolveLocale } from 'tiptap-vue-pro-core'

// 预览渲染走 core 的 controller:注入 fake render,不加载真实 KaTeX
vi.mock('tiptap-vue-pro-core', async (importActual) => {
  const actual = await importActual<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    createMathRenderController: vi.fn(() => {
      let onState: ((state: { status: string; html: string; error: string }) => void) | undefined
      const controller = {
        render: vi.fn(async () => onState?.({ status: 'ready', html: '<span>preview</span>', error: '' })),
        cancel: vi.fn(),
        reset: vi.fn(),
        getState: () => ({ status: 'ready', html: '', error: '' }),
      }
      return Object.assign(controller, {
        __setOnState: (fn: typeof onState) => { onState = fn },
      })
    }),
  }
})

const t = resolveLocale().t

function mountDialog(math: { from: number; to: number; kind: 'inline' | 'block'; latex: string } | null) {
  return mount(MathEditDialog, {
    props: {
      // math=null 是插入模式,弹层照常打开
      show: true,
      math,
      t,
    },
    attachTo: document.body,
  })
}

describe('MathEditDialog', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    vi.mocked(createMathRenderController).mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('打开时以公式源码初始化输入框', async () => {
    wrapper = mountDialog({ from: 4, to: 5, kind: 'block', latex: 'E = mc^2' })
    await new Promise(resolve => setTimeout(resolve, 0))

    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea?.value).toBe('E = mc^2')
  })

  it('确认时空源码不触发,有源码时发出 confirm 并关闭', async () => {
    wrapper = mountDialog({ from: 4, to: 5, kind: 'inline', latex: 'a+b' })
    await new Promise(resolve => setTimeout(resolve, 0))

    const buttons = Array.from(document.body.querySelectorAll('button'))
    const confirmButton = buttons.find(button => button.textContent?.includes('确'))
    expect(confirmButton).toBeTruthy()
    confirmButton!.click()
    await Promise.all([new Promise(resolve => setTimeout(resolve, 0)), wrapper.vm.$nextTick()])

    expect(wrapper.emitted('confirm')).toEqual([['a+b', 'inline']])
    const events = wrapper.emitted('update:show') ?? []
    expect(events[events.length - 1]).toEqual([false])
  })

  it('取消直接关闭,不发出 confirm', async () => {
    wrapper = mountDialog({ from: 4, to: 5, kind: 'inline', latex: 'a+b' })
    await new Promise(resolve => setTimeout(resolve, 0))

    const buttons = Array.from(document.body.querySelectorAll('button'))
    buttons.find(button => button.textContent?.includes('取'))!.click()
    await Promise.all([new Promise(resolve => setTimeout(resolve, 0)), wrapper.vm.$nextTick()])

    expect(wrapper.emitted('confirm')).toBeUndefined()
    const events = wrapper.emitted('update:show') ?? []
    expect(events[events.length - 1]).toEqual([false])
  })


  it('常用语法面板:展开后点击片段插入光标处', async () => {
    wrapper = mountDialog(null)
    await new Promise(resolve => setTimeout(resolve, 0))

    // 面板默认收起
    expect(document.body.querySelector('.tvp-math-dialog-help-panel')).toBeNull()

    const toggle = document.body.querySelector('.tvp-math-dialog-help-toggle') as HTMLButtonElement
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    toggle.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    const panel = document.body.querySelector('.tvp-math-dialog-help-panel')
    expect(panel).toBeTruthy()
    expect(document.body.querySelectorAll('.tvp-math-help-chip').length).toBeGreaterThan(10)

    // 点击分数片段:textarea 值更新且光标落在第一个 {} 内
    const fracChip = Array.from(document.body.querySelectorAll('.tvp-math-help-chip'))
      .find(chip => chip.textContent?.includes('\\frac')) as HTMLButtonElement
    fracChip.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    // 光标在预填的默认公式末尾,片段插入其后
    expect(textarea.value).toBe('E = mc^2\\frac{}{}')
    expect(textarea.selectionStart).toBe('E = mc^2\\frac{'.length)
  })

  it('插入模式勾选「行内」后确认,confirm 带出 inline 类型', async () => {
    wrapper = mountDialog(null)
    await new Promise(resolve => setTimeout(resolve, 0))

    const checkbox = document.body.querySelector('.tvp-math-dialog-inline input') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    checkbox.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(checkbox.checked).toBe(true)

    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'x + 1'
    textarea.dispatchEvent(new Event('input'))
    await new Promise(resolve => setTimeout(resolve, 0))

    const confirmButtons = Array.from(document.body.querySelectorAll('button'))
    confirmButtons.find(button => button.textContent?.includes('确'))!.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.emitted('confirm')).toEqual([['x + 1', 'inline']])
  })

  it('编辑模式勾选按节点类型初始化,变更后 confirm 带出目标类型', async () => {
    // 块级公式:勾选框未选中;勾选后 confirm 带出 inline(转换意图)
    wrapper = mountDialog({ from: 4, to: 5, kind: 'block', latex: 'E = mc^2' })
    await new Promise(resolve => setTimeout(resolve, 0))

    const checkbox = document.body.querySelector('.tvp-math-dialog-inline input') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    checkbox.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    const buttons = Array.from(document.body.querySelectorAll('button'))
    buttons.find(button => button.textContent?.includes('确'))!.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.emitted('confirm')).toEqual([['E = mc^2', 'inline']])
  })

  it('插入模式预填默认公式,确认后发出 confirm 供落文档', async () => {
    wrapper = mountDialog(null)
    await new Promise(resolve => setTimeout(resolve, 0))

    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea?.value).toBe('E = mc^2')

    textarea.value = 'x + 1'
    textarea.dispatchEvent(new Event('input'))
    await new Promise(resolve => setTimeout(resolve, 0))

    const buttons = Array.from(document.body.querySelectorAll('button'))
    buttons.find(button => button.textContent?.includes('确'))!.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.emitted('confirm')).toEqual([['x + 1', 'block']])
  })
})
