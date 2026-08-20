import { describe, expect, it } from 'vitest'
import { resolveToolbarCompactActions } from './toolbarCompactActions'

describe('resolveToolbarCompactActions', () => {
  it('expands adapter-dependent actions while preserving order', () => {
    expect(resolveToolbarCompactActions(
      ['image', 'attachment', 'mermaid', 'hr', 'markdown'],
      {
        hasImageUpload: true,
        allowImageUrl: true,
        hasAssetUpload: true,
        horizontalRules: [
          { label: '实线', value: 'solid' },
          { label: '虚线', value: 'dashed' },
        ],
        markdown: [
          { label: '导入', value: 'import' },
          { label: '导出', value: 'export' },
        ],
      },
    )).toEqual([
      { key: 'image:upload', item: 'image', payload: 'upload' },
      { key: 'image:url', item: 'image', payload: 'url' },
      { key: 'attachment:video', item: 'attachment', payload: 'video' },
      { key: 'attachment:file', item: 'attachment', payload: 'file' },
      { key: 'mermaid', item: 'mermaid' },
      { key: 'hr:solid', item: 'hr', payload: 'solid' },
      { key: 'hr:dashed', item: 'hr', payload: 'dashed' },
      { key: 'markdown:import', item: 'markdown', payload: 'import' },
      { key: 'markdown:export', item: 'markdown', payload: 'export' },
    ])
  })

  it('omits unavailable resource actions', () => {
    expect(resolveToolbarCompactActions(['image', 'attachment'], {
      hasImageUpload: false,
      allowImageUrl: true,
      hasAssetUpload: false,
      horizontalRules: [],
      markdown: [],
    })).toEqual([
      { key: 'image:url', item: 'image', payload: 'url' },
    ])
  })
})
