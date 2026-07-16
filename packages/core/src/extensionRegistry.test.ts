import { describe, expect, it } from 'vitest'
import {
  createEditorExtensions,
  DEFAULT_EXTENSION_CONFIG,
} from './extensionRegistry'

describe('extension registry', () => {
  it('creates the default extension set', () => {
    const extensions = createEditorExtensions()
    const names = extensions.map((extension) => extension.name)

    expect(names).toContain('starterKit')
    expect(names).toContain('horizontalRule')
    expect(names).toContain('placeholder')
    expect(names).toContain('characterCount')
    expect(names).toContain('findReplace')
    expect(names).toContain('markdown')
  })

  it('allows disabling optional groups', () => {
    const extensions = createEditorExtensions({
      ...DEFAULT_EXTENSION_CONFIG,
      markdown: false,
      table: false,
      image: false,
    })
    const names = extensions.map((extension) => extension.name)

    expect(names).not.toContain('markdown')
    expect(names).not.toContain('tableKit')
    expect(names).not.toContain('image')
  })

  it('keeps slashCommand disabled until a bridge is provided through createDefaultExtensions', () => {
    const extensions = createEditorExtensions()
    const names = extensions.map((extension) => extension.name)

    expect(DEFAULT_EXTENSION_CONFIG.slashCommand).toBe(true)
    expect(names).not.toContain('slashCommand')
  })

  it('passes placeholder text through the registry', () => {
    const extensions = createEditorExtensions({ placeholderText: 'Write here' })
    const placeholder: any = extensions.find(
      (extension) => extension.name === 'placeholder',
    )

    expect(placeholder.options.placeholder).toBe('Write here')
  })

  it('allows disabling placeholder separately from placeholder text', () => {
    const extensions = createEditorExtensions({
      placeholder: false,
      placeholderText: 'Write here',
    })
    const names = extensions.map((extension) => extension.name)

    expect(names).not.toContain('placeholder')
  })

  it.each([
    ['starterKit', ['starterKit', 'horizontalRule']],
    ['characterCount', ['characterCount']],
    ['typography', ['textStyle', 'fontFamily', 'fontSize', 'lineHeight', 'color']],
    ['highlight', ['highlight']],
    ['textAlign', ['textAlign']],
    ['blockIndent', ['blockIndent']],
    ['codeBlock', ['codeBlock']],
    ['script', ['superscript', 'subscript']],
    ['taskList', ['taskList', 'taskItem']],
    ['media', ['video', 'audio', 'fileAttachment']],
    ['slashCommand', ['slashCommand']],
    ['findReplace', ['findReplace']],
    ['markdown', ['markdown']],
  ] as const)('allows disabling the %s extension group', (key, disabledNames) => {
    const extensions = createEditorExtensions({
      [key]: false,
    })
    const names = extensions.map((extension) => extension.name)

    for (const disabledName of disabledNames) {
      expect(names).not.toContain(disabledName)
    }
  })

  it('keeps createDefaultExtensions-compatible defaults through createEditorExtensions', () => {
    const names = createEditorExtensions().map((extension) => extension.name)

    for (const enabledName of [
      'starterKit',
      'horizontalRule',
      'placeholder',
      'characterCount',
      'image',
      'tableKit',
      'textStyle',
      'fontFamily',
      'fontSize',
      'lineHeight',
      'color',
      'highlight',
      'textAlign',
      'blockIndent',
      'codeBlock',
      'superscript',
      'subscript',
      'taskList',
      'taskItem',
      'video',
      'audio',
      'fileAttachment',
      'findReplace',
      'markdown',
    ]) {
      expect(names).toContain(enabledName)
    }
  })
})
