import { describe, expect, it } from 'vitest'
import { CODE_BLOCK_LANGUAGES, codeBlockLanguageLabel, codeBlockLowlight } from './codeBlock'

describe('code block languages', () => {
  it('only exposes languages registered by lowlight', () => {
    for (const language of CODE_BLOCK_LANGUAGES) {
      expect(codeBlockLowlight.registered(language.value), language.value).toBe(true)
    }
  })

  it('provides unique values and labels for every built-in language', () => {
    expect(new Set(CODE_BLOCK_LANGUAGES.map(({ value }) => value)).size).toBe(CODE_BLOCK_LANGUAGES.length)
    for (const language of CODE_BLOCK_LANGUAGES) {
      expect(codeBlockLanguageLabel(language.value)).toBe(language.label)
    }
  })
})
