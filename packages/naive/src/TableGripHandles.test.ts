import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import TableGripHandles from './TableGripHandles.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

type GripVm = {
  onRowMenuShow: (visible: boolean, index?: number) => void
  onColMenuShow: (visible: boolean, index?: number) => void
  runRowCmd: (op: string) => void
  runColCmd: (op: string) => void
  rowOptions: Array<{ label?: string }>
  colOptions: Array<{ label?: string }>
}

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function setRect(el: Element, value: DOMRect) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => value,
  })
}

function createCtx() {
  return {
    tableState: ref({ tablePos: 1 }),
    commands: {
      selectRow: vi.fn(),
      selectColumn: vi.fn(),
      addRowBefore: vi.fn(),
      addRowAfter: vi.fn(),
      moveRowUp: vi.fn(),
      moveRowDown: vi.fn(),
      deleteRow: vi.fn(),
      addColumnBefore: vi.fn(),
      addColumnAfter: vi.fn(),
      moveColumnLeft: vi.fn(),
      moveColumnRight: vi.fn(),
      deleteColumn: vi.fn(),
    },
  } as unknown as ProEditorContext
}

function createEnv() {
  const scroll = document.createElement('div')
  const root = document.createElement('div')
  root.className = 'tvp-editor'
  root.innerHTML = `
    <table>
      <tbody>
        <tr><td>A1</td><td>A2</td></tr>
        <tr><td>B1</td><td>B2</td></tr>
      </tbody>
    </table>
  `
  scroll.appendChild(root)
  document.body.appendChild(scroll)

  const table = root.querySelector('table')!
  const rows = Array.from(table.querySelectorAll('tr'))
  const cells = Array.from(table.querySelectorAll('td'))
  setRect(scroll, rect(0, 0, 400, 300))
  setRect(table, rect(100, 80, 200, 80))
  setRect(rows[0], rect(100, 80, 200, 40))
  setRect(rows[1], rect(100, 120, 200, 40))
  setRect(cells[0], rect(100, 80, 100, 40))
  setRect(cells[1], rect(200, 80, 100, 40))
  setRect(cells[2], rect(100, 120, 100, 40))
  setRect(cells[3], rect(200, 120, 100, 40))

  const chainApi = {
    focus: vi.fn(),
    setTextSelection: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.setTextSelection.mockReturnValue(chainApi)
  chainApi.run.mockReturnValue(true)

  const editor = {
    state: {
      doc: {
        content: { size: 100 },
        resolve: vi.fn(() => ({ parent: { inlineContent: true } })),
      },
    },
    view: {
      dom: root,
      nodeDOM: vi.fn(() => table),
      posAtCoords: vi.fn(() => ({ pos: 8 })),
      posAtDOM: vi.fn(() => 8),
    },
    chain: vi.fn(() => chainApi),
    on: vi.fn(),
    off: vi.fn(),
  }

  return { scroll, cells, editor, chainApi }
}

async function hoverCell(cell: Element) {
  cell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
  await nextTick()
}

describe('Naive UI TableGripHandles', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hover 单元格后渲染行/列抓手,打开菜单前先选中对应行列', async () => {
    const ctx = createCtx()
    const { scroll, cells, editor, chainApi } = createEnv()
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx, scrollContainer: scroll },
    })

    await hoverCell(cells[0])

    expect(wrapper.find('.tvp-table-grip--row').exists()).toBe(true)
    expect(wrapper.find('.tvp-table-grip--col').exists()).toBe(true)

    const vm = wrapper.vm as unknown as GripVm
    vm.onRowMenuShow(true)
    vm.onColMenuShow(true)

    expect(editor.view.posAtCoords).toHaveBeenCalled()
    expect(chainApi.setTextSelection).toHaveBeenCalledWith(8)
    expect(ctx.commands.selectRow).toHaveBeenCalledTimes(1)
    expect(ctx.commands.selectColumn).toHaveBeenCalledTimes(1)
  })

  it('行列抓手菜单显隐时通知父组件压住表格气泡', () => {
    const ctx = createCtx()
    const { scroll, editor } = createEnv()
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx, scrollContainer: scroll },
    })
    const vm = wrapper.vm as unknown as GripVm

    vm.onRowMenuShow(true, 0)
    vm.onRowMenuShow(false, 0)

    expect(wrapper.emitted('menu-open-change')).toEqual([[true], [false]])
  })

  it('抓手命令执行后继续压住表格气泡,直到用户重新点击编辑区', async () => {
    const ctx = createCtx()
    const { scroll, cells, editor } = createEnv()
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx, scrollContainer: scroll },
    })
    const vm = wrapper.vm as unknown as GripVm
    const editorRoot = editor.view.dom.closest('.tvp-editor') as HTMLElement

    await hoverCell(cells[1])
    vm.onColMenuShow(true, 1)
    expect(editorRoot.getAttribute('data-table-grip-suppress-bubble')).toBe('true')

    vm.runColCmd('moveRight')
    expect(editorRoot.getAttribute('data-table-grip-suppress-bubble')).toBe('true')

    scroll.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await nextTick()
    expect(editorRoot.hasAttribute('data-table-grip-suppress-bubble')).toBe(false)
  })

  it('行列菜单命令映射到 core 表格命令,删除命令延迟执行', () => {
    vi.useFakeTimers()
    const ctx = createCtx()
    const { scroll, editor } = createEnv()
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx, scrollContainer: scroll },
    })
    const vm = wrapper.vm as unknown as GripVm

    vm.runRowCmd('addUp')
    vm.runRowCmd('addDown')
    vm.runRowCmd('moveUp')
    vm.runRowCmd('moveDown')
    vm.runRowCmd('delete')
    expect(ctx.commands.deleteRow).not.toHaveBeenCalled()
    vi.advanceTimersByTime(240)

    vm.runColCmd('addLeft')
    vm.runColCmd('addRight')
    vm.runColCmd('moveLeft')
    vm.runColCmd('moveRight')
    vm.runColCmd('delete')

    expect(ctx.commands.addRowBefore).toHaveBeenCalledTimes(1)
    expect(ctx.commands.addRowAfter).toHaveBeenCalledTimes(1)
    expect(ctx.commands.moveRowUp).toHaveBeenCalledTimes(1)
    expect(ctx.commands.moveRowDown).toHaveBeenCalledTimes(1)
    expect(ctx.commands.addColumnBefore).toHaveBeenCalledTimes(1)
    expect(ctx.commands.addColumnAfter).toHaveBeenCalledTimes(1)
    expect(ctx.commands.moveColumnLeft).toHaveBeenCalledTimes(1)
    expect(ctx.commands.moveColumnRight).toHaveBeenCalledTimes(1)
    expect(ctx.commands.deleteRow).toHaveBeenCalledTimes(1)
    expect(ctx.commands.deleteColumn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(240)

    expect(ctx.commands.deleteRow).toHaveBeenCalledTimes(1)
    expect(ctx.commands.deleteColumn).toHaveBeenCalledTimes(1)
  })

  it('删除命令使用抓手锁定的行列索引', async () => {
    vi.useFakeTimers()
    const ctx = createCtx()
    const { scroll, cells, editor } = createEnv()
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx, scrollContainer: scroll },
    })
    const vm = wrapper.vm as unknown as GripVm

    await hoverCell(cells[3])
    vm.onRowMenuShow(true, 1)
    vm.runRowCmd('delete')
    vi.advanceTimersByTime(240)
    expect(ctx.commands.selectRow).toHaveBeenLastCalledWith(1)
    expect(ctx.commands.deleteRow).toHaveBeenLastCalledWith(1)

    await hoverCell(cells[3])
    vm.onColMenuShow(true, 1)
    vm.runColCmd('delete')
    vi.advanceTimersByTime(240)
    expect(ctx.commands.selectColumn).toHaveBeenLastCalledWith(1)
    expect(ctx.commands.deleteColumn).toHaveBeenLastCalledWith(1)
  })

  it('editor 切换时从旧实例解绑 transaction 监听并绑定新实例', async () => {
    const ctx = createCtx()
    const { scroll, editor } = createEnv()
    const nextEditor = {
      ...editor,
      on: vi.fn(),
      off: vi.fn(),
    }
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx, scrollContainer: scroll },
    })

    await wrapper.setProps({ editor: nextEditor as never })

    expect(editor.off).toHaveBeenCalledWith('transaction', expect.any(Function))
    expect(nextEditor.on).toHaveBeenCalledWith('transaction', expect.any(Function))
  })

  it('行列菜单文案保持简化,图标和文字使用统一 6px 间距', () => {
    const { scroll, editor } = createEnv()
    wrapper = mount(TableGripHandles, {
      attachTo: document.body,
      props: { editor: editor as never, ctx: createCtx(), scrollContainer: scroll },
    })
    const vm = wrapper.vm as unknown as GripVm
    const source = readFileSync(`${process.cwd()}/src/TableGripHandles.vue`, 'utf8')

    expect(vm.rowOptions.filter((option) => option.label).map((option) => option.label)).toEqual([
      '在上方插入',
      '在下方插入',
      '上移',
      '下移',
      '删除',
    ])
    expect(vm.colOptions.filter((option) => option.label).map((option) => option.label)).toEqual([
      '在左侧插入',
      '在右侧插入',
      '左移',
      '右移',
      '删除',
    ])
    expect(source).toContain('gap:6px')
    expect(source).toContain('tvp-table-grip__dot')
    expect(source).toContain('.tvp-table-grip--col:hover')
    expect(source).toContain('background: transparent')
  })
})
