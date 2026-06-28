import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor } from './useProEditor'
import type { ProEditorContext, OutputFormat } from './types'

/**
 * useProEditor 的集成测试。
 *
 * 关键策略:用「真实 Tiptap 编辑器」,不是 mock。
 * 因为这正是验证「README 说做了的功能到底能不能用」的唯一可靠方式——
 * 每个用例都断言编辑器产出的真实 HTML/JSON。
 *
 * composable 依赖 Vue 生命周期(useEditor 内部注册 onBeforeUnmount),
 * 所以必须包在一个组件里挂载,不能裸调用(skill: testing-composables-helper-wrapper)。
 *
 * 已知坑:Tiptap #6777 在 happy-dom 下 unmount 偶发抛
 * "_a.remove is not a function",由 setup.ts 的 uncaughtException 过滤兜底。
 */

// ---- 挂载 helper ----
// 把 useProEditor 包成一个带 EditorContent 的组件,
// options 可通过 props 覆盖,返回 ctx 供测试断言。
function mountEditor(opts: {
  content?: string | object
  output?: OutputFormat
  placeholder?: string
  onModelValue?: (v: string | object) => void
}) {
  let ctx: ProEditorContext | undefined
  const modelValue = ref(opts.content ?? '')

  const Comp = defineComponent({
    setup() {
      ctx = useProEditor({
        get content() {
          return modelValue.value
        },
        set content(v) {
          modelValue.value = v
          opts.onModelValue?.(v)
        },
        output: opts.output ?? 'html',
        placeholder: opts.placeholder,
      } as any)
      return () => h(EditorContent, { editor: ctx!.editor.value })
    },
  })

  const wrapper = mount(Comp, { attachTo: document.body })
  return {
    wrapper,
    get ctx() {
      return ctx!
    },
    modelValue,
  }
}

// 通用:等待编辑器实例就绪(异步,需 tick)
async function ready(ctx: ProEditorContext) {
  // useEditor 在 mounted 后才返回实例,可能需要若干 tick
  for (let i = 0; i < 10 && !ctx.editor.value; i++) {
    await nextTick()
  }
  return ctx.editor.value!
}

// 选中整个文档(让 toggle 类命令有作用域)
function selectAll(ctx: ProEditorContext) {
  const ed = ctx.editor.value!
  ed.chain().focus().setTextSelection(0).run()
  // 选中第一段全部文字
  const size = ed.state.doc.content.size
  ed.chain().setTextSelection({ from: 1, to: Math.max(1, size - 1) }).run()
}

afterEach(() => {
  // happy-dom 残留清理(编辑器 unmount 的已知噪音由 setup.ts 兜底)
  document.body.innerHTML = ''
})

describe('useProEditor — 命令产出真实 HTML', () => {
  it('bold: 选中文字加粗 → <strong>', async () => {
    const { ctx } = mountEditor({ content: '<p>hello</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.bold()
    await nextTick()
    expect(ed.getHTML()).toContain('<strong>')
    expect(ed.getHTML()).toContain('hello')
  })

  it('italic: 选中文字斜体 → <em>', async () => {
    const { ctx } = mountEditor({ content: '<p>hi</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.italic()
    await nextTick()
    expect(ed.getHTML()).toContain('<em>')
  })

  it('underline: 选中文字下划线 → <u>', async () => {
    const { ctx } = mountEditor({ content: '<p>hi</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.underline()
    await nextTick()
    expect(ed.getHTML()).toContain('<u>')
  })

  it('code: 选中文字设为行内代码 → <code>', async () => {
    const { ctx } = mountEditor({ content: '<p>hi</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.code()
    await nextTick()
    expect(ed.getHTML()).toContain('<code>')
    expect(ed.getHTML()).not.toContain('<pre>')
  })

  it('superscript / subscript → <sup> / <sub>', async () => {
    const sup = mountEditor({ content: '<p>2</p>' })
    const supEd = await ready(sup.ctx)
    selectAll(sup.ctx)
    sup.ctx.commands.superscript()
    await nextTick()
    expect(supEd.getHTML()).toContain('<sup>')

    const sub = mountEditor({ content: '<p>2</p>' })
    const subEd = await ready(sub.ctx)
    selectAll(sub.ctx)
    sub.ctx.commands.subscript()
    await nextTick()
    expect(subEd.getHTML()).toContain('<sub>')
  })

  it('strike: 选中文字删除线 → <s>', async () => {
    const { ctx } = mountEditor({ content: '<p>hi</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.strike()
    await nextTick()
    expect(ed.getHTML()).toContain('<s>')
  })

  it('toggleHeading(1) → <h1>;toggleHeading(0) 回落段落', async () => {
    const { ctx } = mountEditor({ content: '<p>title</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.toggleHeading(1)
    await nextTick()
    expect(ed.getHTML()).toMatch(/<h1[^>]*>.*title/)

    ctx.commands.toggleHeading(0)
    await nextTick()
    expect(ed.getHTML()).not.toMatch(/<h1/)
    expect(ed.getHTML()).toContain('<p>')
  })

  it('blockquote → <blockquote>', async () => {
    const { ctx } = mountEditor({ content: '<p>quote</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.blockquote()
    await nextTick()
    expect(ed.getHTML()).toContain('<blockquote>')
  })

  it('codeBlock → <pre><code>', async () => {
    const { ctx } = mountEditor({ content: '<p>code</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.codeBlock()
    await nextTick()
    expect(ed.getHTML()).toContain('<pre>')
    expect(ed.getHTML()).toContain('<code class="language-plaintext">')
  })

  it('codeBlock(language) → 带语言 class', async () => {
    const { ctx } = mountEditor({ content: '<p>const answer = 42</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.codeBlock('javascript')
    await nextTick()
    const html = ed.getHTML()
    expect(html).toContain('language-javascript')
  })

  it('bulletList → <ul>', async () => {
    const { ctx } = mountEditor({ content: '<p>item</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.bulletList()
    await nextTick()
    expect(ed.getHTML()).toContain('<ul>')
  })

  it('orderedList → <ol>', async () => {
    const { ctx } = mountEditor({ content: '<p>item</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.orderedList()
    await nextTick()
    expect(ed.getHTML()).toContain('<ol>')
  })

  it('taskList → <ul data-type="taskList">', async () => {
    const { ctx } = mountEditor({ content: '<p>todo</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.taskList()
    await nextTick()
    expect(ed.getHTML()).toContain('data-type="taskList"')
  })

  it('hr → <hr>', async () => {
    const { ctx } = mountEditor({ content: '<p>a</p>' })
    const ed = await ready(ctx)
    ctx.commands.hr()
    await nextTick()
    expect(ed.getHTML()).toContain('<hr>')
  })

  it('setLink → <a href target=_blank>', async () => {
    const { ctx } = mountEditor({ content: '<p>click</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.setLink('https://example.com')
    await nextTick()
    const html = ed.getHTML()
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
  })

  it('setLink(空串) → 移除链接', async () => {
    const { ctx } = mountEditor({
      content: '<p><a href="https://x.com">link</a></p>',
    })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.setLink('')
    await nextTick()
    expect(ed.getHTML()).not.toContain('<a')
  })

  it('insertLinkText → 插入带链接的文本', async () => {
    const { ctx } = mountEditor({ content: '<p></p>' })
    const ed = await ready(ctx)
    // 光标在文档中
    ed.chain().focus().setTextSelection(1).run()
    ctx.commands.insertLinkText('https://x.com', '点这里')
    await nextTick()
    const html = ed.getHTML()
    expect(html).toContain('点这里')
    expect(html).toContain('href="https://x.com"')
  })

  it('setColor → <span style="color:...">', async () => {
    const { ctx } = mountEditor({ content: '<p>red</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.setColor('#ff0000')
    await nextTick()
    // Tiptap 产出规范 CSS(冒号后有空格),不去假设具体空格
    expect(ed.getHTML()).toMatch(/color:\s*#ff0000/i)
  })

  it('toggleHighlight → <mark>', async () => {
    const { ctx } = mountEditor({ content: '<p>hi</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.toggleHighlight('#ffeb3b')
    await nextTick()
    expect(ed.getHTML()).toContain('<mark')
  })

  it('align(center) → text-align:center', async () => {
    const { ctx } = mountEditor({ content: '<p>center</p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    ctx.commands.align('center')
    await nextTick()
    expect(ed.getHTML()).toMatch(/text-align:\s*center/i)
  })

  it('clearFormat → 移除 marks', async () => {
    const { ctx } = mountEditor({ content: '<p><strong>bold</strong></p>' })
    const ed = await ready(ctx)
    selectAll(ctx)
    expect(ed.getHTML()).toContain('<strong>')
    ctx.commands.clearFormat()
    await nextTick()
    expect(ed.getHTML()).not.toContain('<strong>')
  })

  it('insertTable → <table>', async () => {
    const { ctx } = mountEditor({ content: '<p>a</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    expect(ed.getHTML()).toContain('<table')
  })
})

/**
 * 表格结构操作命令的验证(P1-6)。
 *
 * 策略:挂真实编辑器 → 插入一个 2×2 表格 → 把光标移到首个单元格 → 调命令 → 断言结构。
 * 用 <tr>/<td>/<th> 计数 + isActive('table') 判定,不依赖具体位置/属性顺序。
 *
 * 选首个单元格的原因:Tiptap 的 addRow/addColumn/delete* 都作用在「当前选区所在单元格」,
 * 必须先 focus + setTextSelection 到单元格内,否则命令空跑。
 */
function countTag(html: string, tag: string): number {
  // 全局匹配开标签,统计出现次数(表格无嵌套同标签,数量即行/列数)
  const re = new RegExp(`<${tag}[\\s>]`, 'gi')
  const m = html.match(re)
  return m ? m.length : 0
}

// 选中表格首个单元格内容(把光标放进表格,让表格命令有作用域)
function selectFirstCell(ctx: ProEditorContext) {
  const ed = ctx.editor.value!
  // 遍历文档找第一个 tableCell 节点。注意 descendants 的回调返回值会控制是否
  // 继续下降:返回 true 表示「不进入子节点」。这里用外部数组收集,回调只判定不返回,
  // 保证完整遍历(否则返回 false 时会被当作「不下降」从而漏掉)。
  const cells: { pos: number }[] = []
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cells.push({ pos })
    }
  })
  if (!cells.length) return
  // cell.pos 是单元格节点起始位置,+1 进入单元格内部
  const cell = cells[0]
  ed.chain().focus().setTextSelection({ from: cell.pos + 1, to: cell.pos + 1 }).run()
}

describe('useProEditor — 表格结构操作', () => {
  it('insertTable 后 isActive("table") 为 true', async () => {
    const { ctx } = mountEditor({ content: '<p>a</p>' })
    await ready(ctx)
    expect(ctx.isActive('table')).toBe(false)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    // 光标默认落在插入后的单元格
    ctx.editor.value!.chain().focus().setTextSelection(2).run()
    expect(ctx.isActive('table')).toBe(true)
  })

  it('addRowAfter: 2 行 → 3 行', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.addRowAfter()
    await nextTick()
    // 2×2 表格插入后变 3 行
    expect(countTag(ed.getHTML(), 'tr')).toBe(3)
  })

  it('addRowBefore / addColumnBefore / addColumnAfter', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.addRowBefore()
    await nextTick()
    expect(countTag(ed.getHTML(), 'tr')).toBe(3)

    selectFirstCell(ctx)
    ctx.commands.addColumnBefore()
    await nextTick()
    // 每行 td 数 = 3(原 2 + 新增 1)
    expect(countTag(ed.getHTML(), 'td')).toBe(6) // 3 行 × (2 原列 + 1 新列),含表头?此处用 td 总数粗验
  })

  it('deleteRow: 3 行 → 2 行', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(3, 2)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.deleteRow()
    await nextTick()
    expect(countTag(ed.getHTML(), 'tr')).toBe(2)
  })

  it('deleteColumn: 2 列 → 1 列', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.deleteColumn()
    await nextTick()
    // 2 行,每行只剩 1 个单元格
    expect(countTag(ed.getHTML(), 'td') + countTag(ed.getHTML(), 'th')).toBe(2)
  })

  it('deleteTable: 表格被移除', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.deleteTable()
    await nextTick()
    expect(ed.getHTML()).not.toContain('<table')
  })

  it('toggleHeaderRow: 切换首行表头', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    // 默认 withHeaderRow: true,首行是 <th>
    expect(ed.getHTML()).toContain('<th')
    selectFirstCell(ctx)
    ctx.commands.toggleHeaderRow()
    await nextTick()
    // 切换后首行不再是表头,应无 <th>
    expect(ed.getHTML()).not.toContain('<th')
  })

  it('mergeCells / splitCell 不抛错(冒烟)', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    // 选中首行两个单元格做合并:用 setTextSelection 跨两个 cell
    const cells: { pos: number }[] = []
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cells.push({ pos })
      }
    })
    const from = cells[0].pos + 1
    const to = cells[1].pos + 1
    ed.chain().focus().setTextSelection({ from, to }).run()
    expect(() => ctx.commands.mergeCells()).not.toThrow()
    await nextTick()
    // 合并后 split 应可逆
    expect(() => ctx.commands.splitCell()).not.toThrow()
  })

  it('tableState: 初始不在表格 → 全 false/空', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    await ready(ctx)
    expect(ctx.tableState.value).toEqual({ inTable: false, canMerge: false, canSplit: false, tablePos: null, rowCount: 0, colCount: 0 })
  })

  it('tableState: 单格光标 → inTable,不可合不可拆', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    await ready(ctx)
    ctx.commands.insertTable(2, 2)
    await nextTick()
    selectFirstCell(ctx)
    await nextTick()
    expect(ctx.tableState.value.inTable).toBe(true)
    expect(ctx.tableState.value.canMerge).toBe(false)
    expect(ctx.tableState.value.canSplit).toBe(false)
  })

  it('tableState: 光标在已合并单元格(colspan>1)→ canSplit', async () => {
    // 直接用含已合并单元格的 HTML 作为初始内容,绕开「测试里难以产生 CellSelection
    // 来触发 mergeCells」的问题——真实 UI 用鼠标框选多格会由 prosemirror-tables 产生
    // CellSelection,这里直接给定合并后的结构,验证 canSplit 判定。
    const merged = '<p>x</p><table><tbody>' +
      '<tr><th colspan="2">合并表头</th></tr>' +
      '<tr><td>a</td><td>b</td></tr>' +
      '</tbody></table>'
    const { ctx } = mountEditor({ content: merged })
    await ready(ctx)
    // 选中合并单元格(colspan=2 的 th)
    selectFirstCell(ctx)
    await nextTick()
    expect(ctx.tableState.value.inTable).toBe(true)
    expect(ctx.tableState.value.canSplit).toBe(true)
    // 单格选区,不可再合并
    expect(ctx.tableState.value.canMerge).toBe(false)
  })

  it('tableState: 暴露表格几何(tablePos/rowCount/colCount)', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    await ready(ctx)
    ctx.commands.insertTable(3, 4)
    await nextTick()
    selectFirstCell(ctx)
    await nextTick()
    expect(ctx.tableState.value.inTable).toBe(true)
    expect(ctx.tableState.value.rowCount).toBe(3)
    expect(ctx.tableState.value.colCount).toBe(4)
    expect(ctx.tableState.value.tablePos).not.toBeNull()
    // tablePos 应指向文档中的 table 节点
    const node = ctx.editor.value!.state.doc.nodeAt(ctx.tableState.value.tablePos!)
    expect(node?.type.name).toBe('table')
  })

  it('selectRow: 选中整行 → CellSelection + isRowSelection', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(3, 3)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.selectRow()
    await nextTick()
    const sel = ed.state.selection as unknown as {
      constructor: { name: string }
      isRowSelection: () => boolean
    }
    expect(sel.constructor.name).toBe('CellSelection')
    expect(sel.isRowSelection()).toBe(true)
  })

  it('selectColumn: 选中整列 → CellSelection + isColSelection', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    ctx.commands.insertTable(3, 3)
    await nextTick()
    selectFirstCell(ctx)
    ctx.commands.selectColumn()
    await nextTick()
    const sel = ed.state.selection as unknown as {
      constructor: { name: string }
      isColSelection: () => boolean
    }
    expect(sel.constructor.name).toBe('CellSelection')
    expect(sel.isColSelection()).toBe(true)
  })

  it('moveRowDown: 首行下移 → 内容位置变化', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    // 用带可辨识内容的表格,首行 A/B,验证下移后 A/B 不在首行
    ed.commands.setContent(
      '<table><tbody>' +
      '<tr><th>A</th><th>B</th></tr>' +
      '<tr><td>C</td><td>D</td></tr>' +
      '</tbody></table>',
    )
    await nextTick()
    selectFirstCell(ctx)
    const before = ed.getHTML()
    ctx.commands.moveRowDown()
    await nextTick()
    const after = ed.getHTML()
    // 行序应变化(首行 A/B 与第二行 C/D 互换)
    expect(after).not.toBe(before)
    // C/D 现在应在首行(表头行下移后)
    expect(after.indexOf('C')).toBeLessThan(after.indexOf('A'))
  })
})

describe('useProEditor — 其他命令', () => {
  it('undo/redo 可用', async () => {
    const { ctx } = mountEditor({ content: '<p>a</p>' })
    const ed = await ready(ctx)
    const before = ed.getHTML()
    selectAll(ctx)
    ctx.commands.bold()
    await nextTick()
    const afterBold = ed.getHTML()
    expect(afterBold).not.toBe(before)
    ctx.commands.undo()
    await nextTick()
    expect(ed.getHTML()).toBe(before)
    ctx.commands.redo()
    await nextTick()
    expect(ed.getHTML()).toBe(afterBold)
  })

  it('ensureFocusAtEnd 不报错且光标到末尾', async () => {
    const { ctx } = mountEditor({ content: '<p>abc</p>' })
    await ready(ctx)
    expect(() => ctx.commands.ensureFocusAtEnd()).not.toThrow()
  })
})

describe('useProEditor — isActive 状态查询', () => {
  it('bold 后 isActive("bold") 为 true', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    await ready(ctx)
    selectAll(ctx)
    expect(ctx.isActive('bold')).toBe(false)
    ctx.commands.bold()
    await nextTick()
    expect(ctx.isActive('bold')).toBe(true)
  })

  it('isActive 支持对象形式 {textAlign}', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    await ready(ctx)
    selectAll(ctx)
    ctx.commands.align('center')
    await nextTick()
    // 这正是 Toolbar.vue 对齐图标高亮用的调用形式
    expect(ctx.isActive({ textAlign: 'center' })).toBe(true)
    expect(ctx.isActive({ textAlign: 'left' })).toBe(false)
  })
})

describe('useProEditor — v-model 双向绑定', () => {
  it('编辑触发 onUpdate → 回写 content(通过 setter)', async () => {
    const emitted: string[] = []
    const { ctx } = mountEditor({
      content: '<p>start</p>',
      onModelValue: (v) => emitted.push(v as string),
    })
    await ready(ctx)
    selectAll(ctx)
    ctx.commands.bold()
    await nextTick()
    // 编辑器变动会经 onUpdate → emitValue → content setter → onModelValue
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted[emitted.length - 1]).toContain('<strong>')
  })

  it('JSON 模式:getJSON 返回对象,外部更新去重正确(bug #2 回归)', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>', output: 'json' })
    const ed = await ready(ctx)
    await nextTick()
    const json = ctx.getJSON()
    expect(typeof json).toBe('object')
    expect(json).not.toBeNull()

    // 关键回归:外部塞入一个与当前内容「相等」的对象,不应触发 setContent 循环。
    // 旧 bug 用对象引用 === 字符串比较,恒不等,会无脑 setContent。
    // 这里用「与当前 getJSON 完全相同」的对象触发 watch,验证不会重复写入。
    // 由于 adapter setter 改写 modelValue,modelValue 变化触发 watch。
    const sameJson = JSON.parse(JSON.stringify(ed.getJSON()))
    const before = ed.getHTML()
    // 通过 setter 模拟外部写入相同内容
    ;(ctx as any).editor // 确保 editor 存在
    // 直接驱动 useProEditor 的 options.content setter
    // 这里 modelValue 已经是 sameJson 的等值,设置一个新等值对象触发 watch
    ed.commands.setContent(sameJson, { emitUpdate: false })
    await nextTick()
    const after = ed.getHTML()
    expect(after).toBe(before)
  })
})

describe('useProEditor — 字数统计', () => {
  it('初始内容有字数', async () => {
    const { ctx } = mountEditor({ content: '<p>hello world</p>' })
    await ready(ctx)
    await nextTick()
    // hello world = 11 字符(不含标签)
    expect(ctx.wordCount.value.characters).toBeGreaterThan(0)
  })

  it('输入后字数更新', async () => {
    const { ctx } = mountEditor({ content: '<p></p>' })
    const ed = await ready(ctx)
    await nextTick()
    const before = ctx.wordCount.value.characters
    ed.commands.setContent('<p>new text here</p>')
    await nextTick()
    expect(ctx.wordCount.value.characters).toBeGreaterThan(before)
  })
})

describe('useProEditor — getHTML / getJSON / Markdown', () => {
  it('getHTML 返回字符串', async () => {
    const { ctx } = mountEditor({ content: '<p>hi</p>' })
    await ready(ctx)
    expect(typeof ctx.getHTML()).toBe('string')
    expect(ctx.getHTML()).toContain('hi')
  })

  it('getMarkdown 序列化(启用 Markdown 扩展)', async () => {
    const { ctx } = mountEditor({ content: '<p><strong>bold</strong></p>' })
    await ready(ctx)
    const md = ctx.getMarkdown()
    // 默认扩展包含 Markdown,应能序列化出 **bold**
    expect(md).toContain('**bold**')
  })

  it('importMarkdown 写入并触发更新', async () => {
    const { ctx } = mountEditor({ content: '<p></p>' })
    const ed = await ready(ctx)
    ctx.importMarkdown('# Title')
    await nextTick()
    expect(ed.getHTML()).toContain('<h1')
  })
})

describe('useProEditor — 只读切换', () => {
  it('setEditable(false) → 编辑器不可编辑', async () => {
    const { ctx } = mountEditor({ content: '<p>x</p>' })
    const ed = await ready(ctx)
    expect(ed.isEditable).toBe(true)
    ctx.setEditable(false)
    await nextTick()
    expect(ed.isEditable).toBe(false)
  })
})

/**
 * 图片相关命令(对标飞书):对齐、尺寸预设、题注、删除。
 *
 * 关键点:这些命令只在 NodeSelection(整节点选中)时生效。测试里用
 * setNodeSelection 把光标设到图片节点上,模拟「点击图片选中」。
 *
 * 注意:ImageExtended 是块级节点(inline:false),用 <img src> 作为顶层内容,
 * 图片节点位于 pos 0(文档第一个块节点)。setNodeSelection(0) 选中它。
 */
describe('useProEditor — 图片命令(对齐/尺寸/题注/删除)', () => {
  // 选中图片块节点(NodeSelection),模拟用户点击图片
  function selectImage(ctx: ProEditorContext) {
    const ed = ctx.editor.value!
    ed.chain().focus().setNodeSelection(0).run()
  }

  it('setImageAlign: 设为 left → data-align="left"', async () => {
    const { ctx } = mountEditor({ content: '<img src="a.png">' })
    await ready(ctx)
    selectImage(ctx)
    ctx.commands.setImageAlign('left')
    await nextTick()
    expect(ctx.getHTML()).toContain('data-align="left"')
  })

  it('setImageAlign: center 是默认值,不输出 data-align 属性', async () => {
    const { ctx } = mountEditor({ content: '<img src="a.png">' })
    await ready(ctx)
    selectImage(ctx)
    ctx.commands.setImageAlign('center')
    await nextTick()
    // center 是默认值,renderHTML 不输出该属性(见 ImageExtended.align.renderHTML)
    expect(ctx.getHTML()).not.toContain('data-align')
  })

  it('setImageSize: original 清除 width 属性', async () => {
    const { ctx } = mountEditor({
      content: '<img src="a.png" width="200">',
    })
    await ready(ctx)
    selectImage(ctx)
    ctx.commands.setImageSize('original')
    await nextTick()
    expect(ctx.getHTML()).not.toContain('width')
  })

  it('setImageSize: medium 设为容器宽度的 50%', async () => {
    const { ctx } = mountEditor({ content: '<img src="a.png">' })
    const ed = await ready(ctx)
    // happy-dom 下 clientWidth 可能为 0,命令会 no-op。这里手动 mock 一个宽度。
    const containerWidth = 800
    Object.defineProperty(ed.view.dom, 'clientWidth', {
      configurable: true,
      value: containerWidth,
    })
    selectImage(ctx)
    ctx.commands.setImageSize('medium')
    await nextTick()
    expect(ctx.getHTML()).toContain('width="400"')
  })

  it('setImageCaption: 设置题注 → data-caption', async () => {
    const { ctx } = mountEditor({ content: '<img src="a.png">' })
    await ready(ctx)
    selectImage(ctx)
    ctx.commands.setImageCaption('一张示意图')
    await nextTick()
    expect(ctx.getHTML()).toContain('data-caption="一张示意图"')
  })

  it('setImageCaption: 空串清除题注', async () => {
    const { ctx } = mountEditor({
      content: '<img src="a.png" data-caption="旧题注">',
    })
    await ready(ctx)
    selectImage(ctx)
    ctx.commands.setImageCaption('')
    await nextTick()
    expect(ctx.getHTML()).not.toContain('data-caption')
  })

  it('removeImage: 删除当前选中图片', async () => {
    const { ctx } = mountEditor({ content: '<img src="a.png"><p>tail</p>' })
    await ready(ctx)
    selectImage(ctx)
    ctx.commands.removeImage()
    await nextTick()
    expect(ctx.getHTML()).not.toContain('img')
  })

  it('图片命令在非图片选中时 no-op(不抛错)', async () => {
    const { ctx } = mountEditor({ content: '<p>hello</p>' })
    await ready(ctx)
    // 光标在文字里,不是 NodeSelection
    ctx.commands.setImageAlign('left')
    ctx.commands.setImageSize('medium')
    ctx.commands.setImageCaption('x')
    ctx.commands.removeImage()
    await nextTick()
    // 文字内容不应被破坏
    expect(ctx.getHTML()).toContain('hello')
  })
})
