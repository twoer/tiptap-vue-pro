import { describe, expect, it } from 'vitest'
import { CODE_BLOCK_LANGUAGES } from './codeBlock'
import { codeBlockLanguageIcon } from './codeBlockLanguageIcon'

describe('codeBlockLanguageIcon', () => {
  it('provides a colored path icon for every built-in language', () => {
    for (const language of CODE_BLOCK_LANGUAGES) {
      const icon = codeBlockLanguageIcon(language.value)
      expect(icon?.viewBox).toMatch(/^0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?$/)
      expect(icon?.parts.length).toBeGreaterThan(0)
      for (const part of icon?.parts ?? []) {
        expect(part.d.length).toBeGreaterThan(20)
        expect(part.fill ?? part.stroke).toBeTruthy()
      }
    }
  })

  it('resolves common language aliases', () => {
    expect(codeBlockLanguageIcon('TS')).toBe(codeBlockLanguageIcon('typescript'))
    expect(codeBlockLanguageIcon('shell')).toBe(codeBlockLanguageIcon('bash'))
    expect(codeBlockLanguageIcon('py')).toBe(codeBlockLanguageIcon('python'))
    expect(codeBlockLanguageIcon('c++')).toBe(codeBlockLanguageIcon('cpp'))
    expect(codeBlockLanguageIcon('yml')).toBe(codeBlockLanguageIcon('yaml'))
    expect(codeBlockLanguageIcon('txt')).toBe(codeBlockLanguageIcon('plaintext'))
    expect(codeBlockLanguageIcon('vue')?.title).toBe('Vue')
    expect(codeBlockLanguageIcon('vue')?.parts).toHaveLength(3)
    expect(codeBlockLanguageIcon('vue')).not.toBe(codeBlockLanguageIcon('xml'))
  })

  it('returns null for empty and custom languages', () => {
    expect(codeBlockLanguageIcon()).toBeNull()
    expect(codeBlockLanguageIcon('mermaid')).toBeNull()
  })
})
