import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface FindReplaceOptions {
  caseSensitive?: boolean
}

export interface FindReplaceMatch {
  from: number
  to: number
  text: string
}

export interface FindReplaceState {
  open: boolean
  query: string
  replacement: string
  caseSensitive: boolean
  activeIndex: number
  matches: FindReplaceMatch[]
}

export const EMPTY_FIND_REPLACE_STATE: FindReplaceState = {
  open: false,
  query: '',
  replacement: '',
  caseSensitive: false,
  activeIndex: 0,
  matches: [],
}

export function normalizeFindReplaceQuery(query: string): string {
  return query
}

function searchValue(value: string, caseSensitive?: boolean): string {
  return caseSensitive ? value : value.toLocaleLowerCase()
}

export function findMatchesInText(
  text: string,
  query: string,
  options: FindReplaceOptions = {},
): FindReplaceMatch[] {
  const normalizedQuery = normalizeFindReplaceQuery(query)
  if (!normalizedQuery) return []

  const haystack = searchValue(text, options.caseSensitive)
  const needle = searchValue(normalizedQuery, options.caseSensitive)
  const matches: FindReplaceMatch[] = []
  let from = 0

  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) break
    matches.push({
      from: index,
      to: index + normalizedQuery.length,
      text: text.slice(index, index + normalizedQuery.length),
    })
    from = index + Math.max(needle.length, 1)
  }

  return matches
}

export function findTextMatches(
  doc: ProseMirrorNode,
  query: string,
  options: FindReplaceOptions = {},
): FindReplaceMatch[] {
  const matches: FindReplaceMatch[] = []
  if (!query) return matches

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const localMatches = findMatchesInText(node.text, query, options)
    for (const match of localMatches) {
      matches.push({
        from: pos + match.from,
        to: pos + match.to,
        text: match.text,
      })
    }
  })

  return matches
}

export function clampFindReplaceIndex(index: number, matchCount: number): number {
  if (matchCount <= 0) return 0
  if (!Number.isFinite(index)) return 0
  return Math.min(Math.max(Math.round(index), 0), matchCount - 1)
}

export function nextFindReplaceIndex(
  currentIndex: number,
  matchCount: number,
  direction: 1 | -1 = 1,
): number {
  if (matchCount <= 0) return 0
  const normalized = clampFindReplaceIndex(currentIndex, matchCount)
  return (normalized + direction + matchCount) % matchCount
}

export function createFindReplaceState(
  partial: Partial<FindReplaceState> = {},
): FindReplaceState {
  const matches = partial.matches ?? []
  return {
    ...EMPTY_FIND_REPLACE_STATE,
    ...partial,
    matches,
    activeIndex: clampFindReplaceIndex(partial.activeIndex ?? 0, matches.length),
  }
}

export function sortedMatchesForReplacement(
  matches: readonly FindReplaceMatch[],
): FindReplaceMatch[] {
  return [...matches].sort((a, b) => b.from - a.from)
}
