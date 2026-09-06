import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findFixedContainingBlock,
  resolveFixedOrigin,
  styleCreatesFixedContainingBlock,
} from './tableGripOverlay'

describe('styleCreatesFixedContainingBlock', () => {
  const NONE = {
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    perspective: 'none',
    filter: 'none',
    backdropFilter: 'none',
    willChange: 'auto',
    contain: 'none',
  }

  it('全 none 时不构成 fixed 包含块', () => {
    expect(styleCreatesFixedContainingBlock(NONE)).toBe(false)
  })

  it.each([
    ['transform', 'matrix(1, 0, 0, 1, 0, 0)'],
    ['translate', '10px'],
    ['rotate', '45deg'],
    ['scale', '1.2'],
    ['perspective', '800px'],
    ['filter', 'blur(2px)'],
    ['backdropFilter', 'blur(2px)'],
  ])('%s 非 none 构成包含块', (key, value) => {
    expect(styleCreatesFixedContainingBlock({ ...NONE, [key]: value })).toBe(true)
  })

  it('will-change 声明相应属性构成包含块', () => {
    expect(styleCreatesFixedContainingBlock({ ...NONE, willChange: 'transform' })).toBe(true)
    expect(styleCreatesFixedContainingBlock({ ...NONE, willChange: 'transform, opacity' })).toBe(true)
    // opacity 等非布局属性不构成
    expect(styleCreatesFixedContainingBlock({ ...NONE, willChange: 'opacity' })).toBe(false)
  })

  it('contain 含 layout/paint/strict/content 构成包含块,size/style 不构成', () => {
    expect(styleCreatesFixedContainingBlock({ ...NONE, contain: 'layout paint' })).toBe(true)
    expect(styleCreatesFixedContainingBlock({ ...NONE, contain: 'strict' })).toBe(true)
    expect(styleCreatesFixedContainingBlock({ ...NONE, contain: 'content' })).toBe(true)
    expect(styleCreatesFixedContainingBlock({ ...NONE, contain: 'size' })).toBe(false)
    expect(styleCreatesFixedContainingBlock({ ...NONE, contain: 'style' })).toBe(false)
  })
})

describe('findFixedContainingBlock / resolveFixedOrigin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const DEFAULT_STYLE = {
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    perspective: 'none',
    filter: 'none',
    backdropFilter: 'none',
    willChange: 'auto',
    contain: 'none',
  }

  /**
   * 搭 DOM 树并用 dataset 驱动的 style 表 mock getComputedStyle:
   * body > stage(转换祖先) > inner > host(抓手挂载点)
   */
  function mountTree(stageStyle: Record<string, string> | null) {
    const styles = new Map<Element, Record<string, string>>()
    const stage = document.createElement('div')
    stage.dataset.role = 'stage'
    const inner = document.createElement('div')
    const host = document.createElement('div')
    stage.appendChild(inner)
    inner.appendChild(host)
    document.body.appendChild(stage)
    if (stageStyle) styles.set(stage, { ...DEFAULT_STYLE, ...stageStyle })

    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      return (styles.get(el) ?? DEFAULT_STYLE) as unknown as CSSStyleDeclaration
    })
    return { stage, host }
  }

  it('无转换祖先时返回 null,坐标原点是视口 (0,0)', () => {
    const { host } = mountTree(null)
    expect(findFixedContainingBlock(host)).toBeNull()
    expect(resolveFixedOrigin(host)).toEqual({ left: 0, top: 0 })
  })

  it('contain: layout paint 的祖先是包含块,原点取其视口坐标', () => {
    const { stage, host } = mountTree({ contain: 'layout paint' })
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(242, 236, 800, 600),
    )
    expect(findFixedContainingBlock(host)).toBe(stage)
    expect(resolveFixedOrigin(host)).toEqual({ left: 242, top: 236 })
  })

  it('transform 祖先同样被识别,取最近的一个', () => {
    const { stage, host } = mountTree({ transform: 'matrix(1, 0, 0, 1, 0, 0)' })
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 20, 800, 600),
    )
    expect(findFixedContainingBlock(host)).toBe(stage)
    expect(resolveFixedOrigin(host)).toEqual({ left: 10, top: 20 })
  })

  it('start 为 null 时安全返回空', () => {
    expect(findFixedContainingBlock(null)).toBeNull()
    expect(resolveFixedOrigin(null)).toEqual({ left: 0, top: 0 })
  })
})
