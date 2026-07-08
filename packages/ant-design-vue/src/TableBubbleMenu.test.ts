import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import TableBubbleMenu from './TableBubbleMenu.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

function createEditor() {
  return {}
}

function createCtx(state: { canMerge?: boolean; canSplit?: boolean } = {}) {
  return {
    tableState: ref({
      canMerge: !!state.canMerge,
      canSplit: !!state.canSplit,
    }),
    commands: {
      mergeCells: vi.fn(),
      splitCell: vi.fn(),
      toggleHeaderRow: vi.fn(),
      toggleHeaderColumn: vi.fn(),
      deleteTable: vi.fn(),
    },
  } as unknown as ProEditorContext
}

describe('Ant Design Vue TableBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('合并/拆分按钮按 tableState 出现并调用对应命令', async () => {
    const ctx = createCtx({ canMerge: true, canSplit: true })
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.findAll('button.tvp-icon-btn')[0].trigger('click')
    await wrapper.findAll('button.tvp-icon-btn')[1].trigger('click')

    expect(ctx.commands.mergeCells).toHaveBeenCalledTimes(1)
    expect(ctx.commands.splitCell).toHaveBeenCalledTimes(1)
  })

  it('抓手菜单打开时 suppress 合并/拆分气泡入口', () => {
    const ctx = createCtx({ canMerge: true, canSplit: true })
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx, suppress: true },
    })
    const vm = wrapper.vm as unknown as { bubbleVisible: boolean }

    expect(vm.bubbleVisible).toBe(false)
    expect(wrapper.find('.tvp-table-bubble__sep').exists()).toBe(false)
  })

  it('更多菜单命令切换表头,删除整表延迟到浮层关闭后执行', async () => {
    vi.useFakeTimers()
    const ctx = createCtx()
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })
    const vm = wrapper.vm as unknown as { run: (op: string) => void }

    vm.run('toggleHeaderRow')
    vm.run('toggleHeaderColumn')
    vm.run('deleteTable')
    await nextTick()

    expect(ctx.commands.toggleHeaderRow).toHaveBeenCalledTimes(1)
    expect(ctx.commands.toggleHeaderColumn).toHaveBeenCalledTimes(1)
    expect(ctx.commands.deleteTable).not.toHaveBeenCalled()

    vi.advanceTimersByTime(240)

    expect(ctx.commands.deleteTable).toHaveBeenCalledTimes(1)
  })

  it('更多菜单文案保持简化,且菜单项图标文字间距统一', () => {
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx: createCtx() },
    })
    const vm = wrapper.vm as unknown as { moreOps: Array<{ text: string }> }
    const source = readFileSync(`${process.cwd()}/src/TableBubbleMenu.vue`, 'utf8')

    expect(vm.moreOps.map((item) => item.text)).toEqual([
      '首行为表头',
      '首列为表头',
      '删除表格',
    ])
    expect(source).toContain('overlayClassName="tvp-table-bubble-dropdown"')
    expect(source).toContain('min-height: 50px')
    expect(source).toContain('gap: 9px')
  })
})
