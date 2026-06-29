import { describe, expect, it } from 'vitest'
import {
  TOOLBAR_ALIGN_OPTIONS,
  TOOLBAR_CODE_BLOCK_LANGUAGES,
  TOOLBAR_FONT_FAMILIES,
  TOOLBAR_FONT_SIZES,
  TOOLBAR_HEADING_OPTIONS,
  TOOLBAR_HEADING_PREVIEW_STYLES,
  TOOLBAR_LINE_HEIGHTS,
  TOOLBAR_MARKDOWN_IMPORT_ACCEPT,
  TOOLBAR_MARKDOWN_OPTIONS,
  TOOLBAR_PRESET_COLORS,
  TOOLBAR_PRESET_HIGHLIGHTS,
  TOOLBAR_TABLE_GRID,
  resolveToolbarOptions,
} from './toolbarConfigData'

describe('toolbar config data', () => {
  it('defines heading options from paragraph through H6', () => {
    expect(TOOLBAR_HEADING_OPTIONS.map((option) => option.level)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(TOOLBAR_HEADING_OPTIONS.map((option) => option.label)).toEqual([
      '正文',
      '标题 1',
      '标题 2',
      '标题 3',
      '标题 4',
      '标题 5',
      '标题 6',
    ])
    expect(TOOLBAR_HEADING_PREVIEW_STYLES[1]).toEqual({ fontSize: '15px', fontWeight: 700 })
    expect(TOOLBAR_HEADING_PREVIEW_STYLES[6]).toEqual({ fontSize: '12px', fontWeight: 500 })
  })

  it('keeps typography presets stable', () => {
    expect(TOOLBAR_FONT_FAMILIES.map((font) => font.label)).toEqual([
      '默认字体',
      'Arial',
      'Inter',
      'Helvetica',
      'Times New Roman',
      'Georgia',
      'Monospace',
    ])
    expect(TOOLBAR_FONT_SIZES).toContain('96px')
    expect(TOOLBAR_LINE_HEIGHTS).toEqual(['', '1', '1.2', '1.4', '1.6', '1.8', '2'])
  })

  it('keeps color palettes and menu labels shared across adapters', () => {
    expect(TOOLBAR_PRESET_COLORS).toHaveLength(40)
    expect(TOOLBAR_PRESET_HIGHLIGHTS).toHaveLength(32)
    expect(TOOLBAR_ALIGN_OPTIONS.map((option) => option.label)).toEqual(['左对齐', '居中', '右对齐', '两端对齐'])
    expect(TOOLBAR_MARKDOWN_OPTIONS.map((option) => option.label)).toEqual(['导入', '导出'])
  })

  it('resolves defaults when toolbar options are omitted', () => {
    expect(resolveToolbarOptions()).toEqual({
      fontFamilies: TOOLBAR_FONT_FAMILIES,
      fontSizes: TOOLBAR_FONT_SIZES,
      lineHeights: TOOLBAR_LINE_HEIGHTS,
      colors: TOOLBAR_PRESET_COLORS,
      highlights: TOOLBAR_PRESET_HIGHLIGHTS,
      codeBlockLanguages: TOOLBAR_CODE_BLOCK_LANGUAGES,
      tableGrid: TOOLBAR_TABLE_GRID,
      markdown: {
        importAccept: TOOLBAR_MARKDOWN_IMPORT_ACCEPT,
        exportFilename: undefined,
      },
      print: {},
    })
  })

  it('allows partial user overrides without replacing unrelated defaults', () => {
    const options = resolveToolbarOptions({
      fontFamilies: [{ label: 'PingFang SC', value: 'PingFang SC' }],
      fontSizes: ['', '13px', '15px'],
    })

    expect(options.fontFamilies).toEqual([{ label: 'PingFang SC', value: 'PingFang SC' }])
    expect(options.fontSizes).toEqual(['', '13px', '15px'])
    expect(options.lineHeights).toEqual(TOOLBAR_LINE_HEIGHTS)
    expect(options.colors).toEqual(TOOLBAR_PRESET_COLORS)
    expect(options.highlights).toEqual(TOOLBAR_PRESET_HIGHLIGHTS)
    expect(options.codeBlockLanguages).toEqual(TOOLBAR_CODE_BLOCK_LANGUAGES)
    expect(options.tableGrid).toEqual(TOOLBAR_TABLE_GRID)
  })

  it('treats empty arrays as intentional user overrides', () => {
    const options = resolveToolbarOptions({
      colors: [],
      highlights: [],
      codeBlockLanguages: [],
    })

    expect(options.colors).toEqual([])
    expect(options.highlights).toEqual([])
    expect(options.codeBlockLanguages).toEqual([])
  })

  it('resolves advanced toolbar option overrides', () => {
    const exportFilename = () => 'doc.md'
    const options = resolveToolbarOptions({
      codeBlockLanguages: [{ label: 'Mermaid', value: 'mermaid' }],
      tableGrid: { maxRows: 12, maxCols: 6.8 },
      markdown: {
        importAccept: '.md',
        exportFilename,
      },
      print: {
        title: '文档打印',
        cleanupDelay: 10,
      },
    })

    expect(options.codeBlockLanguages).toEqual([{ label: 'Mermaid', value: 'mermaid' }])
    expect(options.tableGrid).toEqual({ maxRows: 12, maxCols: 6 })
    expect(options.markdown).toEqual({ importAccept: '.md', exportFilename })
    expect(options.print).toEqual({ title: '文档打印', cleanupDelay: 10 })
  })

  it('falls back invalid table grid sizes to defaults', () => {
    const options = resolveToolbarOptions({
      tableGrid: { maxRows: 0, maxCols: Number.POSITIVE_INFINITY },
    })

    expect(options.tableGrid).toEqual(TOOLBAR_TABLE_GRID)
  })
})
