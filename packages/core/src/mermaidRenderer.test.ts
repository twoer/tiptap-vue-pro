import { describe, expect, it, vi } from 'vitest'
import {
  createMermaidRenderController,
  extractMermaidErrorLine,
  type MermaidRenderState,
} from './mermaidRenderer'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Mermaid render controller', () => {
  it('discards stale async results', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const render = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const states: MermaidRenderState[] = []
    const controller = createMermaidRenderController({
      delay: 0,
      render,
      onState: state => states.push(state),
    })

    const firstRun = controller.render('flowchart TD\nA --> B', 'light')
    const secondRun = controller.render('flowchart TD\nA --> C', 'dark')
    second.resolve('<svg id="new" />')
    await secondRun
    first.resolve('<svg id="old" />')
    await firstRun

    expect(states[states.length - 1]).toMatchObject({ status: 'ready', svg: '<svg id="new" />' })
  })

  it('keeps the last valid SVG when the next source is invalid', async () => {
    const states: MermaidRenderState[] = []
    const render = vi.fn()
      .mockResolvedValueOnce('<svg id="valid" />')
      .mockRejectedValueOnce(Object.assign(new Error('Parse error on line 4'), {
        hash: { loc: { first_line: 4 } },
      }))
    const controller = createMermaidRenderController({
      delay: 0,
      render,
      onState: state => states.push(state),
    })

    await controller.render('flowchart TD\nA --> B', 'light')
    await controller.render('broken', 'light')

    expect(states[states.length - 1]).toMatchObject({
      status: 'error',
      svg: '<svg id="valid" />',
      errorLine: 4,
    })
  })

  it('clears the cached SVG and error state when reset', async () => {
    const render = vi.fn()
      .mockResolvedValueOnce('<svg id="valid" />')
      .mockRejectedValueOnce(new Error('Parse error on line 2'))
    const controller = createMermaidRenderController({ delay: 0, render })

    await controller.render('flowchart TD\nA --> B', 'light')
    controller.reset()
    expect(controller.getState()).toEqual({
      status: 'idle',
      svg: '',
      error: '',
      errorLine: null,
    })

    await controller.render('broken', 'light')
    expect(controller.getState()).toMatchObject({ status: 'error', svg: '' })
  })

  it('extracts useful line numbers without trusting error shape', () => {
    expect(extractMermaidErrorLine({ hash: { loc: { first_line: 7 } } })).toBe(7)
    expect(extractMermaidErrorLine(new Error('Parse error on line 12'))).toBe(12)
    expect(extractMermaidErrorLine('bad input')).toBeNull()
  })
})
