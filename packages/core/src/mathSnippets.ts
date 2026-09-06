/**
 * 公式编辑弹层的常用语法速查数据(core 共享,adapter 渲染各自的 UI)。
 *
 * latex 中的 `$` 是光标落点占位符(只取第一个):插入时被移除,
 * 光标停在原位置,方便用户直接填内容。chip 展示用 latex 原文,
 * 语言无关、顺带教会语法;分组标题沿用项目 zh-first 惯例(同 slash 命令)。
 */
export interface MathSnippet {
  /** chip 上展示的紧凑写法 */
  display: string
  /** 插入到输入框的 LaTeX($ 为光标占位符) */
  latex: string
}

export interface MathSnippetGroup {
  title: string
  items: MathSnippet[]
}

export const MATH_SNIPPET_GROUPS: MathSnippetGroup[] = [
  {
    title: '基础',
    items: [
      { display: 'x^2', latex: 'x^{$}' },
      { display: 'a_1', latex: 'a_{$}' },
      { display: '\\frac{a}{b}', latex: '\\frac{$}{$}' },
      { display: '\\sqrt{x}', latex: '\\sqrt{$}' },
      { display: '\\overline{x}', latex: '\\overline{$}' },
    ],
  },
  {
    title: '运算',
    items: [
      { display: '\\sum_{i=1}^{n}', latex: '\\sum_{i=1}^{n}' },
      { display: '\\int_a^b', latex: '\\int_{a}^{b}' },
      { display: '\\lim', latex: '\\lim_{x \\to 0}' },
      { display: '\\prod', latex: '\\prod_{i=1}^{n}' },
    ],
  },
  {
    title: '符号',
    items: [
      { display: '\\alpha', latex: '\\alpha' },
      { display: '\\beta', latex: '\\beta' },
      { display: '\\theta', latex: '\\theta' },
      { display: '\\pi', latex: '\\pi' },
      { display: '\\lambda', latex: '\\lambda' },
      { display: '\\Sigma', latex: '\\Sigma' },
      { display: '\\Omega', latex: '\\Omega' },
      { display: '\\pm', latex: '\\pm' },
      { display: '\\times', latex: '\\times' },
      { display: '\\cdot', latex: '\\cdot' },
      { display: '\\infty', latex: '\\infty' },
      { display: '\\partial', latex: '\\partial' },
      { display: '\\nabla', latex: '\\nabla' },
      { display: '\\leq', latex: '\\leq' },
      { display: '\\geq', latex: '\\geq' },
      { display: '\\neq', latex: '\\neq' },
      { display: '\\approx', latex: '\\approx' },
      { display: '\\rightarrow', latex: '\\rightarrow' },
      { display: '\\Rightarrow', latex: '\\Rightarrow' },
    ],
  },
  {
    title: '结构',
    items: [
      {
        display: 'pmatrix 矩阵',
        latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
      },
      {
        display: 'cases 分段',
        latex: '\\begin{cases} x^2, & x \\geq 0 \\\\ -x, & x < 0 \\end{cases}',
      },
      {
        display: 'aligned 对齐',
        latex: '\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}',
      },
      { display: '\\text{备注}', latex: '\\text{备注}' },
      { display: '\\quad 空格', latex: '\\quad' },
    ],
  },
]

/**
 * 把片段插入 textarea 光标处(替换选区),并把光标落在 `$` 占位符位置。
 * 直接改 value 后补发 input 事件,让 Vue 的 v-model 感知更新。
 */
export function insertMathSnippet(textarea: HTMLTextAreaElement, latex: string): void {
  const caretMarker = latex.indexOf('$')
  // 剥离全部占位符(如 \frac{$}{$}),光标落在第一个位置
  const text = caretMarker >= 0 ? latex.replace(/\$/g, '') : latex
  const start = textarea.selectionStart ?? text.length
  const end = textarea.selectionEnd ?? start
  const before = textarea.value.slice(0, start)
  const after = textarea.value.slice(end)

  textarea.value = before + text + after
  const caret = caretMarker >= 0 ? start + caretMarker : start + text.length
  textarea.setSelectionRange(caret, caret)
  textarea.focus()
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}
