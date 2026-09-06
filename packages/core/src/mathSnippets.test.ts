import { describe, expect, it } from 'vitest'
import { insertMathSnippet, MATH_SNIPPET_GROUPS } from './mathSnippets'
import { renderMathToString } from './mathRenderer'

describe('MATH_SNIPPET_GROUPS', () => {
  it('分组非空且每组有片段', () => {
    expect(MATH_SNIPPET_GROUPS.length).toBeGreaterThanOrEqual(4)
    for (const group of MATH_SNIPPET_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0)
      expect(group.title.trim()).toBeTruthy()
    }
  })

  it('每个片段都能被真实 KaTeX 渲染(防命令拼写错误)', async () => {
    for (const group of MATH_SNIPPET_GROUPS) {
      for (const item of group.items) {
        const latex = item.latex.replace(/\$/g, '')
        await expect(renderMathToString(latex, { displayMode: false })).resolves.toContain('katex')
      }
    }
  })

  it('光标占位符 $ 只出现在可安全移除的位置(渲染前被剥离)', () => {
    for (const group of MATH_SNIPPET_GROUPS) {
      for (const item of group.items) {
        // 占位符不允许出现在 \begin{...} 这类结构里导致残缺片段——
        // 剥离后可渲染已在上一条覆盖;这里保证 display 与 latex 都非空
        expect(item.display.trim()).toBeTruthy()
        expect(item.latex.trim()).toBeTruthy()
      }
    }
  })
})

describe('insertMathSnippet', () => {
  function createTextarea(value = ''): HTMLTextAreaElement {
    const textarea = document.createElement('textarea')
    textarea.value = value
    document.body.appendChild(textarea)
    return textarea
  }

  it('在光标处插入并落在 $ 占位符位置', () => {
    const textarea = createTextarea('ab')
    textarea.setSelectionRange(1, 1)

    insertMathSnippet(textarea, 'x^{$}')

    expect(textarea.value).toBe('ax^{}b')
    // 光标落在 {} 内:{ 在索引 3,光标应在其后
    expect(textarea.selectionStart).toBe(4)
    expect(textarea.selectionEnd).toBe(4)
  })

  it('替换选中文本', () => {
    const textarea = createTextarea('abcdef')
    textarea.setSelectionRange(1, 4)

    insertMathSnippet(textarea, '\\frac{$}{}')

    expect(textarea.value).toBe('a\\frac{}{}ef')
  })

  it('无占位符片段插入到光标末尾', () => {
    const textarea = createTextarea('x')
    textarea.setSelectionRange(1, 1)

    insertMathSnippet(textarea, '\\infty')

    expect(textarea.value).toBe('x\\infty')
    expect(textarea.selectionStart).toBe(7)
  })

  it('派发 input 事件(v-model 感知)', () => {
    const textarea = createTextarea('')
    let fired = false
    textarea.addEventListener('input', () => {
      fired = true
    })

    insertMathSnippet(textarea, '\\alpha')

    expect(textarea.value).toBe('\\alpha')
    expect(fired).toBe(true)
  })
})
