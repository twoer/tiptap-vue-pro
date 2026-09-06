import { describe, expect, it } from 'vitest'
import { clampFloatingMenuLeft, getViewportWidth } from './floatingMenuPosition'

describe('floatingMenuPosition', () => {
  it('视口宽度可用(happy-dom)', () => {
    expect(getViewportWidth(300)).toBeGreaterThan(0)
  })

  it('视口内的位置原样保留', () => {
    expect(clampFloatingMenuLeft(200, 300)).toBe(200)
  })

  it('靠右溢出时夹回视口右边缘', () => {
    const clamped = clampFloatingMenuLeft(5000, 300)
    expect(clamped).toBe(getViewportWidth(300) - 300 - 8)
  })

  it('负坐标/超左时夹到左边距', () => {
    expect(clampFloatingMenuLeft(-100, 300)).toBe(8)
  })

  it('margin 可自定义', () => {
    expect(clampFloatingMenuLeft(-100, 300, 16)).toBe(16)
  })
})
