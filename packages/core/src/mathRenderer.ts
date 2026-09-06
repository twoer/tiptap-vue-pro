import type { KatexOptions } from 'katex'

/**
 * 安全裁剪后的 KaTeX 配置。
 *
 * `trust` / `output` / `throwOnError` 由 core 固定,不开放透传:
 * - trust 固定 false,禁用 `\href` 等危险输出;
 * - output 固定 htmlAndMathml(屏幕阅读器可读,也是打印 MathML 方案的基础);
 * - throwOnError 固定 true,由 renderer 捕获 ParseError 进 error 状态——
 *   throwOnError: false 时部分非法命令不抛异常、只渲染红色源码,进不了自有错误 UI。
 */
export type SafeKatexOptions = Omit<KatexOptions, 'trust' | 'output' | 'throwOnError'>

export type MathRenderOutput = 'htmlAndMathml' | 'mathml'

export interface MathRenderOptions {
  /** 块级公式用 displayMode: true(同一 latex 两种模式输出不同,进缓存 key) */
  displayMode: boolean
  /** 屏显用默认 htmlAndMathml;打印副本用 mathml(自包含,零 CSS/字体依赖) */
  output?: MathRenderOutput
  katexOptions?: SafeKatexOptions
}

/**
 * 「LaTeX → HTML」渲染契约。动态 import 决定首次渲染必然异步,
 * 不提供看似同步的返回值;未来可注入 MathJax 或服务端预渲染实现。
 */
export type MathRenderer = (latex: string, options: MathRenderOptions) => Promise<string>

export interface MathRenderState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  html: string
  error: string
}

export interface MathRenderController {
  render: (latex: string, options: MathRenderOptions) => Promise<void>
  cancel: () => void
  reset: () => void
  getState: () => MathRenderState
}

export interface MathRenderControllerOptions {
  /** 注入自定义渲染函数(测试或替换引擎用);默认 renderMathToString */
  render?: MathRenderer
  onState?: (state: MathRenderState) => void
}

type KatexApi = {
  renderToString: (tex: string, options?: KatexOptions) => string
}

let katexPromise: Promise<KatexApi> | null = null

function loadKatex(): Promise<KatexApi> {
  katexPromise ??= import('katex').then(
    module => (module.default ?? module) as KatexApi,
  )
  return katexPromise
}

const MEMO_LIMIT = 300
const mathMemo = new Map<string, string>()

/** 宏展开默认上限(KaTeX 默认 1000),显式保留以防宿主误调大 */
const DEFAULT_MAX_EXPAND = 1000

function stableOptionsKey(options?: SafeKatexOptions): string | null {
  if (!options) return ''
  const sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortValue)
    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>
      return Object.keys(source)
        .filter(key => typeof source[key] !== 'undefined')
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          if (typeof source[key] === 'function') throw new Error('unstable option')
          acc[key] = sortValue(source[key])
          return acc
        }, {})
    }
    if (typeof value === 'function') throw new Error('unstable option')
    return value
  }
  try {
    return JSON.stringify(sortValue(options))
  } catch {
    // 含函数(如动态回调)的 options 无稳定序列化,绕过共享 memo
    return null
  }
}

function resolveKatexOptions(options: MathRenderOptions): KatexOptions {
  // JS 调用方可能绕过 SafeKatexOptions 类型传入 trust/output/throwOnError,这里运行时剥离
  const source = options.katexOptions as KatexOptions | undefined
  const { trust: _trust, output: _output, throwOnError: _throwOnError, ...safe } = source ?? {}
  return {
    displayMode: options.displayMode,
    output: options.output ?? 'htmlAndMathml',
    throwOnError: true,
    trust: false,
    maxExpand: DEFAULT_MAX_EXPAND,
    ...safe,
  }
}

/**
 * 把 LaTeX 渲染为 KaTeX HTML 字符串(异步:首次调用需等待 katex 动态加载)。
 * ParseError 会抛出,由调用方(controller)捕获进 error 状态,不冒泡到编辑器。
 */
export async function renderMathToString(
  latex: string,
  options: MathRenderOptions,
): Promise<string> {
  const optionsKey = stableOptionsKey(options.katexOptions)
  const cacheKey = optionsKey === null
    ? null
    : `${options.output ?? 'htmlAndMathml'}|${options.displayMode ? 'block' : 'inline'}|${optionsKey}|${latex}`

  if (cacheKey) {
    const cached = mathMemo.get(cacheKey)
    if (cached !== undefined) return cached
  }

  const katex = await loadKatex()
  const html = katex.renderToString(latex, resolveKatexOptions(options))

  if (cacheKey) {
    if (mathMemo.size >= MEMO_LIMIT) {
      const oldest = mathMemo.keys().next().value
      if (oldest !== undefined) mathMemo.delete(oldest)
    }
    mathMemo.set(cacheKey, html)
  }
  return html
}

/** 测试用:清空共享 memo */
export function clearMathMemo(): void {
  mathMemo.clear()
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  const text = String(error ?? '').trim()
  return text || 'Unable to render math formula'
}

export const EMPTY_MATH_RENDER_STATE: MathRenderState = {
  status: 'idle',
  html: '',
  error: '',
}

export function createMathRenderController(
  options: MathRenderControllerOptions = {},
): MathRenderController {
  const render = options.render ?? renderMathToString
  let version = 0
  let state: MathRenderState = { ...EMPTY_MATH_RENDER_STATE }

  const publish = (next: MathRenderState) => {
    state = next
    options.onState?.({ ...state })
  }

  return {
    async render(latex, renderOptions) {
      const requestVersion = ++version
      publish({ ...state, status: 'loading', error: '' })
      try {
        const html = await render(latex, renderOptions)
        if (requestVersion !== version) return
        publish({ status: 'ready', html, error: '' })
      } catch (error) {
        if (requestVersion !== version) return
        publish({ status: 'error', html: '', error: errorMessage(error) })
      }
    },
    cancel() {
      version += 1
    },
    reset() {
      version += 1
      publish({ ...EMPTY_MATH_RENDER_STATE })
    },
    getState() {
      return { ...state }
    },
  }
}
