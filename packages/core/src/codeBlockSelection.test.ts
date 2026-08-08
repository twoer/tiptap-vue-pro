import { describe, expect, it } from 'vitest'
import { getActiveCodeBlock } from './codeBlockSelection'

describe('getActiveCodeBlock', () => {
  it('reads a selected codeBlock node', () => {
    const editor = {
      state: {
        selection: {
          from: 2,
          to: 18,
          node: {
            type: { name: 'codeBlock' },
            attrs: { language: 'typescript' },
            textContent: 'const answer = 42',
          },
        },
      },
    }

    expect(getActiveCodeBlock(editor as never)).toEqual({
      from: 2,
      to: 18,
      attrs: { language: 'typescript' },
      language: 'typescript',
      text: 'const answer = 42',
    })
  })

  it('reads the parent codeBlock when the cursor is inside it', () => {
    const codeNode = {
      type: { name: 'codeBlock' },
      attrs: { language: 'javascript' },
      textContent: 'console.log(1)',
    }
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: {},
      textContent: 'outside',
    }
    const editor = {
      state: {
        selection: {
          from: 6,
          to: 6,
          $from: {
            depth: 2,
            node: (depth: number) => depth === 1 ? codeNode : paragraphNode,
            before: (depth: number) => depth === 1 ? 4 : 5,
            after: (depth: number) => depth === 1 ? 24 : 18,
          },
        },
      },
    }

    expect(getActiveCodeBlock(editor as never)).toEqual({
      from: 4,
      to: 24,
      attrs: { language: 'javascript' },
      language: 'javascript',
      text: 'console.log(1)',
    })
  })

  it('returns null outside code blocks', () => {
    const editor = {
      state: {
        selection: {
          from: 1,
          to: 1,
          $from: {
            depth: 1,
            node: () => ({ type: { name: 'paragraph' }, attrs: {}, textContent: 'text' }),
          },
        },
      },
    }

    expect(getActiveCodeBlock(editor as never)).toBeNull()
  })
})
