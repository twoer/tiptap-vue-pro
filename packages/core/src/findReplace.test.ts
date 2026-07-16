import { describe, expect, it } from 'vitest'
import {
  clampFindReplaceIndex,
  createFindReplaceState,
  findMatchesInText,
  nextFindReplaceIndex,
  normalizeFindReplaceQuery,
  sortedMatchesForReplacement,
} from './findReplace'

describe('find/replace helpers', () => {
  it('keeps query whitespace intact', () => {
    expect(normalizeFindReplaceQuery(' hello ')).toBe(' hello ')
  })

  it('finds case-insensitive text matches by default', () => {
    expect(findMatchesInText('Hello hello HELLO', 'hello')).toEqual([
      { from: 0, to: 5, text: 'Hello' },
      { from: 6, to: 11, text: 'hello' },
      { from: 12, to: 17, text: 'HELLO' },
    ])
  })

  it('supports case-sensitive matching', () => {
    expect(findMatchesInText('Hello hello HELLO', 'hello', { caseSensitive: true })).toEqual([
      { from: 6, to: 11, text: 'hello' },
    ])
  })

  it('does not produce overlapping matches', () => {
    expect(findMatchesInText('aaaa', 'aa')).toEqual([
      { from: 0, to: 2, text: 'aa' },
      { from: 2, to: 4, text: 'aa' },
    ])
  })

  it('clamps active index to available matches', () => {
    expect(clampFindReplaceIndex(5, 2)).toBe(1)
    expect(clampFindReplaceIndex(-1, 2)).toBe(0)
    expect(clampFindReplaceIndex(3, 0)).toBe(0)
  })

  it('cycles next and previous indexes', () => {
    expect(nextFindReplaceIndex(0, 3, 1)).toBe(1)
    expect(nextFindReplaceIndex(2, 3, 1)).toBe(0)
    expect(nextFindReplaceIndex(0, 3, -1)).toBe(2)
  })

  it('creates a normalized public state', () => {
    expect(createFindReplaceState({
      open: true,
      activeIndex: 9,
      matches: [{ from: 1, to: 2, text: 'a' }],
    })).toMatchObject({
      open: true,
      activeIndex: 0,
      matches: [{ from: 1, to: 2, text: 'a' }],
    })
  })

  it('sorts replacement ranges from the end of the document', () => {
    expect(sortedMatchesForReplacement([
      { from: 1, to: 2, text: 'a' },
      { from: 8, to: 9, text: 'b' },
      { from: 3, to: 4, text: 'c' },
    ])).toEqual([
      { from: 8, to: 9, text: 'b' },
      { from: 3, to: 4, text: 'c' },
      { from: 1, to: 2, text: 'a' },
    ])
  })
})
