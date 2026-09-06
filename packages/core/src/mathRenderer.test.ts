import { describe, expect, it, vi } from 'vitest'
import {
  clearMathMemo,
  createMathRenderController,
  renderMathToString,
  type MathRenderState,
} from './mathRenderer'

function deferredRender() {
  let resolve!: (html: string) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  const render = vi.fn(() => promise)
  return { render, resolve, reject }
}

describe('createMathRenderController', () => {
  it('空闲/加载/就绪状态流转', async () => {
    const { render, resolve } = deferredRender()
    const states: MathRenderState[] = []
    const controller = createMathRenderController({
      render,
      onState: state => states.push(state),
    })

    expect(controller.getState().status).toBe('idle')

    const pending = controller.render('x^2', { displayMode: false })
    expect(controller.getState().status).toBe('loading')

    resolve('<span class="katex">x^2</span>')
    await pending
    expect(controller.getState()).toMatchObject({ status: 'ready', html: '<span class="katex">x^2</span>', error: '' })
    expect(states.map(state => state.status)).toEqual(['loading', 'ready'])
  })

  it('渲染错误进入 error 状态,不向调用方抛出', async () => {
    const { render, reject } = deferredRender()
    const controller = createMathRenderController({ render })

    const pending = controller.render('\\fra', { displayMode: false })
    reject(new Error('KaTeX parse error: Undefined control sequence'))
    await pending

    expect(controller.getState()).toMatchObject({
      status: 'error',
      html: '',
      error: 'KaTeX parse error: Undefined control sequence',
    })
  })

  it('源码快速变化时用版本号丢弃过期结果', async () => {
    const { render, resolve } = deferredRender()
    const states: string[] = []
    const controller = createMathRenderController({
      render,
      onState: state => states.push(state.status),
    })

    const first = controller.render('a', { displayMode: false })
    const second = controller.render('b', { displayMode: false })
    resolve('<span>b</span>')
    await Promise.all([first, second])

    // 第一次请求的结果(version 1)在第二次发起时已被丢弃,只剩 b 的 ready
    expect(states).toEqual(['loading', 'loading', 'ready'])
    expect(controller.getState().html).toBe('<span>b</span>')
  })

  it('cancel 后迟到的结果被丢弃', async () => {
    const { render, resolve } = deferredRender()
    const controller = createMathRenderController({ render })

    const pending = controller.render('a', { displayMode: false })
    controller.cancel()
    resolve('<span>a</span>')
    await pending

    expect(controller.getState().status).toBe('loading')
  })

  it('reset 回到 idle 空状态', async () => {
    const { render, resolve } = deferredRender()
    const controller = createMathRenderController({ render })
    const pending = controller.render('a', { displayMode: false })
    resolve('<span>a</span>')
    await pending

    controller.reset()
    expect(controller.getState()).toEqual({ status: 'idle', html: '', error: '' })
  })
})

describe('renderMathToString(真实 KaTeX)', () => {
  it('输出 htmlAndMathml(默认),包含可见 HTML 与隐藏 MathML', async () => {
    const html = await renderMathToString('x^2', { displayMode: false })
    expect(html).toContain('katex-html')
    expect(html).toContain('<math')
  })

  it('displayMode 分别对应行内/块级输出,互不串缓存', async () => {
    const inline = await renderMathToString('x', { displayMode: false })
    const block = await renderMathToString('x', { displayMode: true })
    expect(inline).not.toContain('katex-display')
    expect(block).toContain('katex-display')

    // 同一 latex 两种模式都要能渲染(缓存 key 含 displayMode)
    clearMathMemo()
    expect(await renderMathToString('x', { displayMode: false })).not.toContain('katex-display')
    expect(await renderMathToString('x', { displayMode: true })).toContain('katex-display')
  })

  it('output: mathml 输出自包含 MathML,无 HTML 层(打印路径)', async () => {
    const html = await renderMathToString('\\frac{1}{2}', { displayMode: true, output: 'mathml' })
    expect(html).toContain('<math')
    expect(html).not.toContain('katex-html')
    expect(html).not.toMatch(/url\(|@font-face/) // 无字体/CSS 依赖
  })

  it('非法 LaTeX 抛出 ParseError,由调用方捕获进 error 状态', async () => {
    await expect(renderMathToString('\\fra', { displayMode: false })).rejects.toThrow(/parse error/i)
  })

  it('trust/output/throwOnError 即使被 JS 调用方塞进 katexOptions 也会被剥离', async () => {
    const html = await renderMathToString('\\href{javascript:alert(1)}{x}', {
      displayMode: false,
      katexOptions: {
        trust: true,
        throwOnError: false,
      } as never,
    })
    // trust 被强制 false:不产生 <a> 链接元素(源码会回显在 MathML annotation 里,那不是可执行输出)
    expect(html).not.toContain('<a ')
  })

  it('含函数的 katexOptions 绕过共享 memo 仍可渲染', async () => {
    const html = await renderMathToString('x', {
      displayMode: false,
      katexOptions: { macros: { '\\RR': '\\mathbb{R}' } },
    })
    expect(html).toContain('katex')
  })
})
