import { Extension, type Editor, type Range } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  EMPTY_FIND_REPLACE_STATE,
  clampFindReplaceIndex,
  createFindReplaceState,
  findTextMatches,
  nextFindReplaceIndex,
  sortedMatchesForReplacement,
  type FindReplaceMatch,
  type FindReplaceState,
} from '../findReplace'

export interface FindReplaceExtensionOptions {
  onUpdate?: (state: FindReplaceState) => void
}

export const findReplacePluginKey = new PluginKey<FindReplaceState>('findReplace')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      openFindReplace: () => ReturnType
      closeFindReplace: () => ReturnType
      setFindReplaceQuery: (query: string) => ReturnType
      setFindReplaceReplacement: (replacement: string) => ReturnType
      setFindReplaceCaseSensitive: (caseSensitive: boolean) => ReturnType
      findReplaceNext: () => ReturnType
      findReplacePrevious: () => ReturnType
      replaceFindReplaceCurrent: (replacement?: string) => ReturnType
      replaceFindReplaceAll: (replacement?: string) => ReturnType
    }
  }
}

interface FindReplaceMeta {
  open?: boolean
  query?: string
  replacement?: string
  caseSensitive?: boolean
  activeIndex?: number
}

function recomputeState(
  prev: FindReplaceState,
  doc: EditorState['doc'],
  meta: FindReplaceMeta = {},
): FindReplaceState {
  const open = meta.open ?? prev.open
  const query = meta.query ?? prev.query
  const replacement = meta.replacement ?? prev.replacement
  const caseSensitive = meta.caseSensitive ?? prev.caseSensitive
  const matches = open && query
    ? findTextMatches(doc, query, { caseSensitive })
    : []
  const requestedIndex = meta.activeIndex ?? prev.activeIndex

  return createFindReplaceState({
    open,
    query,
    replacement,
    caseSensitive,
    matches,
    activeIndex: clampFindReplaceIndex(requestedIndex, matches.length),
  })
}

function getFindReplaceState(state: EditorState): FindReplaceState {
  return findReplacePluginKey.getState(state) ?? EMPTY_FIND_REPLACE_STATE
}

function findSelectionIndex(matches: readonly FindReplaceMatch[], range: Range): number {
  return matches.findIndex((match) => match.from === range.from && match.to === range.to)
}

function dispatchMeta(tr: Transaction, meta: FindReplaceMeta): Transaction {
  return tr.setMeta(findReplacePluginKey, meta)
}

function selectActiveMatch(
  tr: Transaction,
  doc: ProseMirrorNode,
  nextState: FindReplaceState,
): Transaction {
  const match = nextState.matches[nextState.activeIndex]
  if (!nextState.open || !match) return tr
  return tr
    .setSelection(TextSelection.create(doc, match.from, match.to))
    .scrollIntoView()
}

function focusEditorView(editor: Editor, dispatch?: (tr: Transaction) => void): void {
  if (!dispatch || editor.isDestroyed) return
  editor.view.focus()
}

function buildDecorations(state: EditorState, pluginState: FindReplaceState): DecorationSet {
  if (!pluginState.open || pluginState.matches.length === 0) return DecorationSet.empty

  const decorations = pluginState.matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === pluginState.activeIndex
        ? 'tvp-find-match tvp-find-match--active'
        : 'tvp-find-match',
    }),
  )

  return DecorationSet.create(state.doc, decorations)
}

export const FindReplaceExtension = Extension.create<FindReplaceExtensionOptions>({
  name: 'findReplace',

  addOptions() {
    return {}
  },

  addCommands() {
    const editor = this.editor
    return {
      openFindReplace:
        () =>
        ({ state, dispatch }) => {
          const nextState = recomputeState(getFindReplaceState(state), state.doc, { open: true })
          const tr = dispatchMeta(state.tr, {
            open: true,
            activeIndex: nextState.activeIndex,
          })
          dispatch?.(tr)
          return true
        },
      closeFindReplace:
        () =>
        ({ state, dispatch }) => {
          dispatch?.(dispatchMeta(state.tr, { open: false }))
          return true
        },
      setFindReplaceQuery:
        (query) =>
        ({ state, dispatch }) => {
          const nextState = recomputeState(getFindReplaceState(state), state.doc, {
            open: true,
            query,
            activeIndex: 0,
          })
          const tr = selectActiveMatch(dispatchMeta(state.tr, {
            open: true,
            query,
            activeIndex: nextState.activeIndex,
          }), state.doc, nextState)
          dispatch?.(tr)
          return true
        },
      setFindReplaceReplacement:
        (replacement) =>
        ({ state, dispatch }) => {
          dispatch?.(dispatchMeta(state.tr, { replacement }))
          return true
        },
      setFindReplaceCaseSensitive:
        (caseSensitive) =>
        ({ state, dispatch }) => {
          const nextState = recomputeState(getFindReplaceState(state), state.doc, {
            caseSensitive,
            activeIndex: 0,
          })
          const tr = selectActiveMatch(dispatchMeta(state.tr, {
            caseSensitive,
            activeIndex: nextState.activeIndex,
          }), state.doc, nextState)
          dispatch?.(tr)
          return true
        },
      findReplaceNext:
        () =>
        ({ state, dispatch }) => {
          const current = getFindReplaceState(state)
          const activeIndex = nextFindReplaceIndex(current.activeIndex, current.matches.length, 1)
          const nextState = createFindReplaceState({ ...current, activeIndex })
          const tr = selectActiveMatch(dispatchMeta(state.tr, { activeIndex }), state.doc, nextState)
          dispatch?.(tr)
          focusEditorView(editor, dispatch)
          return true
        },
      findReplacePrevious:
        () =>
        ({ state, dispatch }) => {
          const current = getFindReplaceState(state)
          const activeIndex = nextFindReplaceIndex(current.activeIndex, current.matches.length, -1)
          const nextState = createFindReplaceState({ ...current, activeIndex })
          const tr = selectActiveMatch(dispatchMeta(state.tr, { activeIndex }), state.doc, nextState)
          dispatch?.(tr)
          focusEditorView(editor, dispatch)
          return true
        },
      replaceFindReplaceCurrent:
        (replacement) =>
        ({ state, dispatch }) => {
          const current = getFindReplaceState(state)
          const match = current.matches[current.activeIndex]
          if (!match) return false

          const nextReplacement = replacement ?? current.replacement
          let tr = state.tr.insertText(nextReplacement, match.from, match.to)
          const nextMatches = findTextMatches(tr.doc, current.query, { caseSensitive: current.caseSensitive })
          const mappedIndex = clampFindReplaceIndex(current.activeIndex, nextMatches.length)
          tr = dispatchMeta(tr, {
            replacement: nextReplacement,
            activeIndex: mappedIndex,
          })
          const nextState = createFindReplaceState({
            ...current,
            replacement: nextReplacement,
            matches: nextMatches,
            activeIndex: mappedIndex,
          })
          tr = selectActiveMatch(tr, tr.doc, nextState)
          dispatch?.(tr)
          return true
        },
      replaceFindReplaceAll:
        (replacement) =>
        ({ state, dispatch }) => {
          const current = getFindReplaceState(state)
          if (current.matches.length === 0) return false

          const nextReplacement = replacement ?? current.replacement
          let tr = state.tr
          for (const match of sortedMatchesForReplacement(current.matches)) {
            tr = tr.insertText(nextReplacement, match.from, match.to)
          }
          tr = dispatchMeta(tr, {
            replacement: nextReplacement,
            activeIndex: 0,
          })
          dispatch?.(tr)
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => this.editor.commands.openFindReplace(),
      Escape: () => {
        const state = getFindReplaceState(this.editor.state)
        if (!state.open) return false
        return this.editor.commands.closeFindReplace()
      },
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin<FindReplaceState>({
        key: findReplacePluginKey,
        state: {
          init: (_config, state) => recomputeState(EMPTY_FIND_REPLACE_STATE, state.doc),
          apply: (tr, prev, _oldState, newState) => {
            const meta = tr.getMeta(findReplacePluginKey) as FindReplaceMeta | undefined
            if (!meta && !tr.docChanged) return prev
            return recomputeState(prev, newState.doc, meta)
          },
        },
        props: {
          decorations: (state) => buildDecorations(state, getFindReplaceState(state)),
        },
        view: (view) => {
          let prev = getFindReplaceState(view.state)
          options.onUpdate?.(prev)
          return {
            update: (updatedView) => {
              const next = getFindReplaceState(updatedView.state)
              if (next === prev) return
              prev = next
              options.onUpdate?.(next)
            },
          }
        },
      }),
    ]
  },
})

export function getFindReplacePluginState(state: EditorState): FindReplaceState {
  return getFindReplaceState(state)
}

export function getFindReplaceActiveSelection(state: FindReplaceState): Range | null {
  const match = state.matches[state.activeIndex]
  return match ? { from: match.from, to: match.to } : null
}

export function getFindReplaceSelectionIndex(
  state: FindReplaceState,
  range: Range,
): number {
  return findSelectionIndex(state.matches, range)
}
