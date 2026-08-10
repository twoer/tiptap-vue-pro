import { describe, expect, it } from 'vitest'
import { resolveLocale } from './locale'

describe('locale', () => {
  it('defaults to zh-CN messages', () => {
    const locale = resolveLocale()

    expect(locale.locale).toBe('zh-CN')
    expect(locale.t('command.bold')).toBe('加粗')
  })

  it('resolves built-in en-US messages', () => {
    const locale = resolveLocale('en-US')

    expect(locale.locale).toBe('en-US')
    expect(locale.t('command.bold')).toBe('Bold')
    expect(locale.t('file.type.archive')).toBe('Archive')
    expect(locale.t('toolbar.heading.level', { level: 2 })).toBe('Heading 2')
  })

  it('exposes autosave status messages in both built-in locales', () => {
    const zh = resolveLocale('zh-CN')
    const en = resolveLocale('en-US')

    expect([
      zh.t('autosave.dirty'),
      zh.t('autosave.saving'),
      zh.t('autosave.saved'),
      zh.t('autosave.error'),
      zh.t('autosave.retry'),
    ]).toEqual(['未保存', '保存中...', '已保存', '保存失败', '重试'])
    expect([
      en.t('autosave.dirty'),
      en.t('autosave.saving'),
      en.t('autosave.saved'),
      en.t('autosave.error'),
      en.t('autosave.retry'),
    ]).toEqual(['Unsaved', 'Saving...', 'Saved', 'Save failed', 'Retry'])
  })

  it('allows message overrides without replacing the whole locale', () => {
    const locale = resolveLocale({
      locale: 'en-US',
      messages: {
        'command.bold': 'Strong',
      },
    })

    expect(locale.t('command.bold')).toBe('Strong')
    expect(locale.t('command.italic')).toBe('Italic')
  })
})
