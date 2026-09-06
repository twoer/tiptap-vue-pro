import { afterEach, describe, expect, it } from 'vitest'
import { getNodeViewT, setNodeViewLocale } from './nodeViewLocale'
import { resolveLocale } from './locale'

describe('nodeViewLocale', () => {
  afterEach(() => {
    // 复位为默认 locale,避免影响其它用例
    setNodeViewLocale(resolveLocale().t)
  })

  it('默认提供 zh-CN 翻译', () => {
    expect(getNodeViewT()('image.captionPlaceholder')).toBe('添加题注')
  })

  it('注入后 NodeView 层文案跟随注入的 locale', () => {
    setNodeViewLocale(resolveLocale({ locale: 'en-US' }).t)
    expect(getNodeViewT()('image.captionPlaceholder')).toBe('Add caption')
  })
})
