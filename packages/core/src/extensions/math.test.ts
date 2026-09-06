import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { NodeSelection } from '@tiptap/pm/state'
import {
  MathBlock,
  MathInline,
  DEFAULT_MATH_BLOCK_LATEX,
  DEFAULT_MATH_INLINE_LATEX,
} from './math'
import { createDefaultExtensions } from '../extensions'
import { getSelectedMathNode } from '../mathSelection'

function createMathEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      MathInline,
      MathBlock,
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
}

const editors: Editor[] = []

function newEditor() {
  const editor = createMathEditor()
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

function hasNode(editor: Editor, name: string): boolean {
  let found = false
  editor.state.doc.descendants((node) => {
    if (node.type.name === name) found = true
  })
  return found
}

function findMathPos(editor: Editor, name: string): number {
  let pos = -1
  editor.state.doc.descendants((node, p) => {
    if (pos < 0 && node.type.name === name) pos = p
  })
  if (pos < 0) throw new Error(`node ${name} not found`)
  return pos
}

/**
 * 模拟真实键入:逐字符走编辑器视图的 handleTextInput 路径(inputrules 插件
 * 只挂这个 prop,insertContent 不触发;tiptap 的 range 公式假定「末字符补全
 * 模式」,必须逐字符喂入)。规则未命中时回退为普通文本插入,与真实键入一致。
 */
function typeText(editor: Editor, text: string) {
  for (const char of Array.from(text)) {
    const { view } = editor
    const from = editor.state.selection.from
    const to = editor.state.selection.to
    let handled = false
    view.someProp('handleTextInput', (prop) => {
      const result = prop(view, from, to, char, () => view.state.tr)
      if (result) handled = true
      return result
    })
    if (!handled) {
      view.dispatch(editor.state.tr.insertText(char, from, to))
    }
  }
}

describe('math 节点注册', () => {
  it('默认扩展包包含 mathInline / mathBlock', () => {
    const names = createDefaultExtensions().map(ext => ext.name)
    expect(names).toContain('mathInline')
    expect(names).toContain('mathBlock')
  })

  it('math: false 可关闭默认公式扩展', () => {
    const names = createDefaultExtensions(undefined, { math: false }).map(ext => ext.name)
    expect(names).not.toContain('mathInline')
    expect(names).not.toContain('mathBlock')
  })

  it('math options 透传到两个节点(render / katexOptions)', () => {
    const render = async () => '<span>x</span>'
    const exts = createDefaultExtensions(undefined, {}, {
      math: { render, katexOptions: { macros: { '\\RR': '\\mathbb{R}' } } },
    })
    const inline = exts.find(ext => ext.name === 'mathInline')
    const block = exts.find(ext => ext.name === 'mathBlock')
    expect((inline as unknown as { options: { render?: unknown } }).options.render).toBe(render)
    expect((block as unknown as { options: { katexOptions?: unknown } }).options.katexOptions)
      .toEqual({ macros: { '\\RR': '\\mathbb{R}' } })
  })
})

describe('math schema HTML/JSON 往返', () => {
  it('renderHTML 输出 data-type + data-latex,parseHTML 还原', () => {
    const editor = newEditor()
    editor.commands.setContent(
      '<p>前置 <span data-type="math-inline" data-latex="x^2 + &quot;q&quot;"></span> 后置</p>',
    )
    const html = editor.getHTML()
    expect(html).toContain('data-type="math-inline"')
    expect(html).toContain('data-latex="x^2 + &quot;q&quot;"')

    editor.commands.setContent(editor.getHTML())
    expect(hasNode(editor, 'mathInline')).toBe(true)
  })

  it('官方 @tiptap/extension-mathematics 的 inline-math / block-math 标签可粘贴还原', () => {
    const editor = newEditor()
    editor.commands.setContent(
      '<p><span data-type="inline-math" data-latex="a+b"></span></p>'
      + '<div data-type="block-math" data-latex="c^2"></div>',
    )
    expect(hasNode(editor, 'mathInline')).toBe(true)
    expect(hasNode(editor, 'mathBlock')).toBe(true)
    // 统一序列化回本项目的 data-type
    expect(editor.getHTML()).toContain('data-type="math-inline"')
    expect(editor.getHTML()).toContain('data-type="math-block"')
  })

  it.each([
    ['空字符串', ''],
    ['引号', 'a"b\'c'],
    ['反斜杠与命令', '\\frac{1}{2}'],
    ['Unicode', '\\sum 中国字 αβγ'],
  ])('latex attr 往返稳定:%s', (_label, latex) => {
    const editor = newEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'mathInline', attrs: { latex } }],
      }],
    })
    const json = editor.getJSON()
    const inline = json.content?.[0]?.content?.[0] as { attrs?: { latex?: string } }
    expect(inline.attrs?.latex).toBe(latex)

    editor.commands.setContent(editor.getHTML())
    const roundtrip = editor.getJSON().content?.[0]?.content?.[0] as { attrs?: { latex?: string } }
    expect(roundtrip.attrs?.latex).toBe(latex)
  })
})

describe('行内 $...$ 输入规则', () => {
  it('合法公式转换', () => {
    const editor = newEditor()
    typeText(editor, '$x^2$')
    expect(hasNode(editor, 'mathInline')).toBe(true)

    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    typeText(editor, '$a + b$')
    expect(hasNode(editor, 'mathInline')).toBe(true)
  })

  it('中文语境中的行内公式转换(CJK 不在 lookbehind 排除列表)', () => {
    const editor = newEditor()
    typeText(editor, '价格$x^2$元')
    expect(hasNode(editor, 'mathInline')).toBe(true)
  })

  it('货币误判防护:5$ and 3$ / \\$5 / 前贴字母数字 均不转换', () => {
    const editor = newEditor()
    typeText(editor, '5$ and 3$')
    expect(hasNode(editor, 'mathInline')).toBe(false)

    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    typeText(editor, '价格为 \\$5 和 \\$6')
    expect(hasNode(editor, 'mathInline')).toBe(false)

    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    typeText(editor, 'abc$x^2$')
    expect(hasNode(editor, 'mathInline')).toBe(false)

    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    typeText(editor, 'abc$x^2$')
    expect(hasNode(editor, 'mathInline')).toBe(false)
  })

  it('从左到右键入 $x^2$ 后继续输入字母:公式在闭合 $ 处生成,后续字母落在节点后(与 Obsidian 一致)', () => {
    const editor = newEditor()
    typeText(editor, '$x^2$abc')
    expect(hasNode(editor, 'mathInline')).toBe(true)
    expect(editor.getText()).toContain('abc')
  })

  it('IME 整段输入 $x^2$abc 不转换(结束 $ 后紧跟字母数字)', () => {
    const editor = newEditor()
    // 一次 handleTextInput 收到整段文本时,textBefore 含后续字母,尾向 lookahead 生效
    const { view } = editor
    const from = editor.state.selection.from
    view.someProp('handleTextInput', prop => prop(view, from, from, '$x^2$abc', () => view.state.tr))
    expect(hasNode(editor, 'mathInline')).toBe(false)
  })

  it('首尾带空白的「公式」不转换($a $ b$)', () => {
    const editor = newEditor()
    typeText(editor, '$a $ b$')
    expect(hasNode(editor, 'mathInline')).toBe(false)
  })

  it('已知取舍:$5 and 3$ 与合法 $2x$ 在纯语法层不可区分,会按公式转换(需货币语义用 \\$ 转义)', () => {
    const editor = newEditor()
    typeText(editor, '$5 and 3$')
    // 与 Pandoc/Obsidian 行为一致;设计文档第九节/评审记录中的显式取舍
    expect(hasNode(editor, 'mathInline')).toBe(true)
  })
})

describe('块级 $$...$$ 输入规则', () => {
  it('整段恰为 $$x$$ 时整段替换为 mathBlock,不残留源码文本', () => {
    const editor = newEditor()
    typeText(editor, '$$\\frac{1}{2}$$')
    expect(hasNode(editor, 'mathBlock')).toBe(true)
    expect(editor.state.doc.firstChild?.type.name).toBe('mathBlock')
    expect(editor.getText()).not.toContain('$$')
  })

  it('段落中混合内容(前后有文字)不触发块级规则', () => {
    const editor = newEditor()
    typeText(editor, '前文 $$x$$ 后文')
    expect(hasNode(editor, 'mathBlock')).toBe(false)
  })
})

describe('math 命令', () => {
  it('insertMathInline / insertMathBlock 使用默认示例公式', () => {
    const editor = newEditor()
    editor.commands.insertMathInline()
    expect(hasNode(editor, 'mathInline')).toBe(true)
    expect(findLatex(editor, 'mathInline')).toBe(DEFAULT_MATH_INLINE_LATEX)

    editor.commands.insertMathBlock()
    expect(hasNode(editor, 'mathBlock')).toBe(true)
    expect(findLatex(editor, 'mathBlock')).toBe(DEFAULT_MATH_BLOCK_LATEX)
  })

  it('insertMathBlock 支持自定义 latex', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: '\\int_0^1 x dx' })
    expect(findLatex(editor, 'mathBlock')).toBe('\\int_0^1 x dx')
  })

  it('插入后选区落到新节点上(NodeSelection),气泡菜单/编辑弹层可立即定位', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: 'E = mc^2' })
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'block', latex: 'E = mc^2' })

    editor.commands.insertMathInline({ latex: 'a+b' })
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'inline', latex: 'a+b' })
  })

  it('updateMath 按保存的 from 位置回写(弹层失焦场景)', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: 'old' })
    const pos = findMathPos(editor, 'mathBlock')
    // 模拟弹层打开后的状态:selection 已不在公式上
    editor.commands.setTextSelection(0)
    expect(editor.commands.updateMath({ latex: 'new', from: pos })).toBe(true)
    expect(findLatex(editor, 'mathBlock')).toBe('new')
  })

  it('updateMath 不传 from 时作用于 NodeSelection 中的公式', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: 'old' })
    const pos = findMathPos(editor, 'mathBlock')
    editor.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(editor.state.doc, pos))
      return true
    })
    expect(editor.commands.updateMath({ latex: 'via-selection' })).toBe(true)
    expect(findLatex(editor, 'mathBlock')).toBe('via-selection')
  })

  it('updateMath 位置不是公式节点时返回 false', () => {
    const editor = newEditor()
    editor.commands.insertContent('普通文字')
    expect(editor.commands.updateMath({ latex: 'x', from: 0 })).toBe(false)
  })

  it('deleteMath 按保存位置删除公式节点', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: 'x' })
    const pos = findMathPos(editor, 'mathBlock')
    editor.commands.setTextSelection(0)
    expect(editor.commands.deleteMath({ from: pos })).toBe(true)
    expect(hasNode(editor, 'mathBlock')).toBe(false)
  })

  it('convertMath 行内 → 块级:整段独占时整段替换并选中新节点', () => {
    const editor = newEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'mathInline', attrs: { latex: 'a+b' } }] }],
    })
    const pos = findMathPos(editor, 'mathInline')
    expect(editor.commands.convertMath({ kind: 'block', latex: 'a+b+c', from: pos })).toBe(true)
    // StarterKit 的 TrailingNode 会在末尾补空段落,只断言首个块是转换结果
    expect(editor.state.doc.firstChild?.type.name).toBe('mathBlock')
    expect(findLatex(editor, 'mathBlock')).toBe('a+b+c')
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'block' })
  })

  it('convertMath 行内 → 块级:与文字混排时文字无损,块级插到段落后', () => {
    const editor = newEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: '前置' },
          { type: 'mathInline', attrs: { latex: 'a+b' } },
          { type: 'text', text: '后置' },
        ],
      }],
    })
    const pos = findMathPos(editor, 'mathInline')
    expect(editor.commands.convertMath({ kind: 'block', latex: 'a+b', from: pos })).toBe(true)
    const first = editor.state.doc.child(0)
    const second = editor.state.doc.child(1)
    expect(first.type.name).toBe('paragraph')
    expect(first.textContent).toBe('前置后置')
    expect(second.type.name).toBe('mathBlock')
    expect(hasNode(editor, 'mathInline')).toBe(false)
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'block' })
  })

  it('convertMath 块级 → 行内:替换为包含行内公式的段落', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: '\\frac{1}{2}' })
    const pos = findMathPos(editor, 'mathBlock')
    expect(editor.commands.convertMath({ kind: 'inline', latex: '\\frac{1}{2}', from: pos })).toBe(true)
    expect(hasNode(editor, 'mathBlock')).toBe(false)
    expect(hasNode(editor, 'mathInline')).toBe(true)
    expect(findLatex(editor, 'mathInline')).toBe('\\frac{1}{2}')
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'inline' })
  })

  it('convertMath 类型未变时退化为仅更新源码', () => {
    const editor = newEditor()
    editor.commands.insertMathBlock({ latex: 'old' })
    const pos = findMathPos(editor, 'mathBlock')
    expect(editor.commands.convertMath({ kind: 'block', latex: 'new', from: pos })).toBe(true)
    expect(findLatex(editor, 'mathBlock')).toBe('new')
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'block' })
  })

  it('convertMath 位置不是公式节点时返回 false', () => {
    const editor = newEditor()
    editor.commands.insertContent('普通文字')
    expect(editor.commands.convertMath({ kind: 'block', latex: 'x', from: 0 })).toBe(false)
  })
})

describe('getSelectedMathNode', () => {
  it('NodeSelection 选中公式时返回节点信息,否则为 null', () => {
    const editor = newEditor()
    editor.commands.insertMathInline({ latex: 'x+1' })
    const pos = findMathPos(editor, 'mathInline')

    // insertMathInline 已自动选中新节点,先把选区移开再验证空态
    expect(getSelectedMathNode(editor)).toMatchObject({ kind: 'inline', latex: 'x+1' })
    editor.commands.setTextSelection(0)
    expect(getSelectedMathNode(editor)).toBeNull()
    editor.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(editor.state.doc, pos))
      return true
    })
    expect(getSelectedMathNode(editor)).toEqual({
      from: pos,
      to: pos + 1,
      kind: 'inline',
      latex: 'x+1',
    })
  })
})

describe('Markdown $$ 块级往返', () => {
  function createMarkdownEditor() {
    const editor = new Editor({
      extensions: createDefaultExtensions(),
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    editors.push(editor)
    return editor
  }

  function parseMarkdown(editor: Editor, markdown: string) {
    const manager = (editor.storage as unknown as {
      markdown?: { manager?: { parse: (md: string) => object } }
    }).markdown?.manager
    if (!manager) throw new Error('markdown manager missing')
    return manager.parse(markdown) as {
      content?: Array<{ type?: string; attrs?: { latex?: string }; content?: Array<{ type?: string }> }>
    }
  }

  function serializeMarkdown(editor: Editor) {
    const manager = (editor.storage as unknown as {
      markdown?: { manager?: { serialize: (json: object) => string } }
    }).markdown?.manager
    if (!manager) throw new Error('markdown manager missing')
    return manager.serialize(editor.getJSON())
  }

  it('导入独占行 $$...$$ 为 mathBlock(多行 latex)', () => {
    const editor = createMarkdownEditor()
    const json = parseMarkdown(editor, '前文\n\n$$\n\\frac{1}{2}\n$$\n\n后文')
    const block = json.content?.find(node => node.type === 'mathBlock')
    expect(block?.attrs?.latex).toBe('\\frac{1}{2}')
  })

  it('导入单行 $$x$$ 也识别为 mathBlock', () => {
    const editor = createMarkdownEditor()
    const json = parseMarkdown(editor, '$$E = mc^2$$')
    expect(json.content?.some(node => node.type === 'mathBlock')).toBe(true)
  })

  it('导出 mathBlock 为 $$ 块,再导入 JSON 等价', () => {
    const editor = createMarkdownEditor()
    editor.commands.insertMathBlock({ latex: '\\int_0^1 x dx' })
    const md = serializeMarkdown(editor)
    expect(md).toContain('$$')
    expect(md).toContain('\\int_0^1 x dx')

    const json = parseMarkdown(editor, md)
    const block = json.content?.find(node => node.type === 'mathBlock')
    expect(block?.attrs?.latex).toBe('\\int_0^1 x dx')
  })

  it('导出 mathInline 为 $latex$ 源码兜底(v1 不做行内导入)', () => {
    const editor = createMarkdownEditor()
    editor.commands.insertMathInline({ latex: 'a+b' })
    const md = serializeMarkdown(editor)
    expect(md).toContain('$a+b$')

    // 行内 $ 未注册导入 tokenizer:$5 and 3$ 保持纯文本,不误判为公式
    const json = parseMarkdown(editor, '$5 and $3')
    const blocks = json.content ?? []
    const inlines = blocks.flatMap(node => node.content ?? [])
    expect(inlines.some(node => node.type === 'mathInline')).toBe(false)
  })
})

function findLatex(editor: Editor, name: string): string {
  let latex = ''
  editor.state.doc.descendants((node) => {
    if (node.type.name === name && !latex) latex = String(node.attrs.latex ?? '')
  })
  return latex
}
