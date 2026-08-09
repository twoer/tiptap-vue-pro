import type { MermaidTheme } from './mermaid'

export interface MermaidRenderState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  svg: string
  error: string
  errorLine: number | null
}

export interface MermaidRenderController {
  render: (source: string, theme: MermaidTheme) => Promise<void>
  cancel: () => void
  reset: () => void
  getState: () => MermaidRenderState
}

export interface MermaidRenderControllerOptions {
  delay?: number
  render?: (source: string, theme: MermaidTheme) => Promise<string>
  onState?: (state: MermaidRenderState) => void
}

type MermaidApi = typeof import('mermaid')['default']

let mermaidPromise: Promise<MermaidApi> | null = null
let renderQueue: Promise<void> = Promise.resolve()
let renderId = 0

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then(module => module.default)
  return mermaidPromise
}

export function renderMermaidSvg(source: string, theme: MermaidTheme): Promise<string> {
  const run = async () => {
    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
    })
    // Mermaid's render() leaves an error SVG attached to document.body when
    // parsing fails. Validate first so syntax errors stay inside our NodeView.
    await mermaid.parse(source)
    const result = await mermaid.render(`tvp-mermaid-${++renderId}`, source)
    return result.svg
  }

  const job = renderQueue.then(run, run)
  renderQueue = job.then(() => undefined, () => undefined)
  return job
}

export function extractMermaidErrorLine(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const hash = (error as { hash?: { loc?: { first_line?: unknown } } }).hash
    const line = hash?.loc?.first_line
    if (typeof line === 'number' && Number.isFinite(line) && line > 0) return line
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  const match = message.match(/\bline\s+(\d+)\b/i)
  return match ? Number(match[1]) : null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  const text = String(error ?? '').trim()
  return text || 'Unable to render Mermaid diagram'
}

export function createMermaidRenderController(
  options: MermaidRenderControllerOptions = {},
): MermaidRenderController {
  const delay = Math.max(0, options.delay ?? 300)
  const render = options.render ?? renderMermaidSvg
  let version = 0
  let state: MermaidRenderState = {
    status: 'idle',
    svg: '',
    error: '',
    errorLine: null,
  }

  const publish = (next: MermaidRenderState) => {
    state = next
    options.onState?.({ ...state })
  }

  return {
    async render(source, theme) {
      const requestVersion = ++version
      publish({ ...state, status: 'loading', error: '', errorLine: null })

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
        if (requestVersion !== version) return
      }

      try {
        const svg = await render(source, theme)
        if (requestVersion !== version) return
        publish({ status: 'ready', svg, error: '', errorLine: null })
      } catch (error) {
        if (requestVersion !== version) return
        publish({
          status: 'error',
          svg: state.svg,
          error: errorMessage(error),
          errorLine: extractMermaidErrorLine(error),
        })
      }
    },
    cancel() {
      version += 1
    },
    reset() {
      version += 1
      publish({
        status: 'idle',
        svg: '',
        error: '',
        errorLine: null,
      })
    },
    getState() {
      return { ...state }
    },
  }
}
