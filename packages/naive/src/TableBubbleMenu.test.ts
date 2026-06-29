import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import TableBubbleMenu from './TableBubbleMenu.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

vi.mock('@tiptap/extension-bubble-menu', () => ({
  BubbleMenuPlugin: vi.fn(() => ({ key: 'proTableBubble' })),
}))

function createEditor() {
  return {
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
  }
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

describe('Naive UI TableBubbleMenu', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('注册并在卸载时清理表格 BubbleMenu 插件', () => {
    const editor = createEditor()
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx() },
    })

    expect(editor.registerPlugin).toHaveBeenCalledTimes(1)

    wrapper.unmount()

    expect(editor.unregisterPlugin).toHaveBeenCalledWith('proTableBubble')
  })

  it('editor 切换时从旧实例卸载表格 BubbleMenu 插件并注册新实例', async () => {
    const first = createEditor()
    const second = createEditor()
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: first as never, ctx: createCtx() },
    })

    await wrapper.setProps({ editor: second as never })

    expect(first.unregisterPlugin).toHaveBeenCalledWith('proTableBubble')
    expect(second.registerPlugin).toHaveBeenCalledTimes(1)
  })

  it('合并/拆分按钮按 tableState 出现并调用对应命令', async () => {
    const ctx = createCtx({ canMerge: true, canSplit: true })
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })

    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.findAll('button')[1].trigger('click')

    expect(ctx.commands.mergeCells).toHaveBeenCalledTimes(1)
    expect(ctx.commands.splitCell).toHaveBeenCalledTimes(1)
  })

  it('更多菜单命令切换表头,删除整表延迟到浮层关闭后执行', async () => {
    vi.useFakeTimers()
    const ctx = createCtx()
    wrapper = mount(TableBubbleMenu, {
      attachTo: document.body,
      props: { editor: createEditor() as never, ctx },
    })
    const vm = wrapper.vm as unknown as { onMoreSelect: (key: string) => void }

    vm.onMoreSelect('toggleHeaderRow')
    vm.onMoreSelect('toggleHeaderColumn')
    vm.onMoreSelect('deleteTable')
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
    const vm = wrapper.vm as unknown as {
      moreOptions: Array<{ label?: string }>
      renderMoreLabel: (option: { key: string; label: string }) => unknown
    }

    expect(vm.moreOptions.map((option) => option.label)).toEqual([
      '首行为表头',
      '首列为表头',
      '删除表格',
    ])
    expect(String(vm.renderMoreLabel({ key: 'deleteTable', label: '删除表格' }))).toContain('[object Object]')
  })
})
