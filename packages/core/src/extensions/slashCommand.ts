import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import {
  Suggestion,
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion'
import {
  SLASH_COMMAND_ITEMS,
  filterSlashCommandItems,
  isSlashCommandItemExecutable,
  type SlashCommandItem,
} from '../slashCommand'

export interface SlashCommandRenderState {
  editor: Editor
  range: Range
  query: string
  text: string
  items: SlashCommandItem[]
  selectedIndex: number
  clientRect?: (() => DOMRect | null) | null
  loading: boolean
  command: (item: SlashCommandItem) => void
}

export interface SlashCommandExecuteState {
  editor: Editor
  range: Range
  query: string
  text: string
  item: SlashCommandItem
}

export interface SlashCommandExtensionOptions {
  enabled: boolean
  items: SlashCommandItem[]
  pluginKey: PluginKey
  onOpen?: (state: SlashCommandRenderState) => void
  onUpdate?: (state: SlashCommandRenderState) => void
  onClose?: () => void
  onExecute?: (state: SlashCommandExecuteState) => void
  allow?: (props: { editor: Editor; range: Range }) => boolean
}

export const slashCommandPluginKey = new PluginKey('slashCommand')

function clampSelectedIndex(index: number, items: readonly SlashCommandItem[]) {
  if (items.length === 0) return 0
  return Math.min(Math.max(index, 0), items.length - 1)
}

function findNextExecutableIndex(
  items: readonly SlashCommandItem[],
  from: number,
  direction: 1 | -1,
) {
  if (items.length === 0) return 0

  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (from + direction * offset + items.length) % items.length
    if (isSlashCommandItemExecutable(items[index])) {
      return index
    }
  }

  return clampSelectedIndex(from, items)
}

function firstExecutableIndex(items: readonly SlashCommandItem[]) {
  const index = items.findIndex(isSlashCommandItemExecutable)
  return index >= 0 ? index : 0
}

function toRenderState(
  props: SuggestionProps<SlashCommandItem, SlashCommandItem>,
  selectedIndex: number,
): SlashCommandRenderState {
  return {
    editor: props.editor,
    range: props.range,
    query: props.query,
    text: props.text,
    items: props.items,
    selectedIndex: clampSelectedIndex(selectedIndex, props.items),
    clientRect: props.clientRect,
    loading: props.loading,
    command: props.command,
  }
}

function executeSlashCommand(
  props: {
    editor: Editor
    range: Range
    query: string
    text: string
  },
  item: SlashCommandItem,
  onExecute?: SlashCommandExtensionOptions['onExecute'],
) {
  if (!isSlashCommandItemExecutable(item)) return

  const { editor, range } = props
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .run()

  onExecute?.({
    editor,
    range,
    query: props.query,
    text: props.text,
    item,
  })
}

export function createSlashCommandExtension(
  options: Partial<SlashCommandExtensionOptions> = {},
) {
  return SlashCommandExtension.configure(options)
}

export const SlashCommandExtension = Extension.create<SlashCommandExtensionOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      enabled: false,
      items: SLASH_COMMAND_ITEMS,
      pluginKey: slashCommandPluginKey,
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    if (!options.enabled) return []

    let selectedIndex = 0
    let latestProps: SuggestionProps<SlashCommandItem, SlashCommandItem> | null = null

    const emitUpdate = (
      props: SuggestionProps<SlashCommandItem, SlashCommandItem>,
      callback: SlashCommandExtensionOptions['onOpen'] | SlashCommandExtensionOptions['onUpdate'],
    ) => {
      latestProps = props
      selectedIndex = clampSelectedIndex(selectedIndex, props.items)
      callback?.(toRenderState(props, selectedIndex))
    }

    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: options.pluginKey,
        char: '/',
        allowedPrefixes: [' ', '\n'],
        decorationClass: 'tvp-slash-command-suggestion',
        items: ({ query }) => filterSlashCommandItems(options.items, query),
        allow: ({ editor, range }) => {
          if (!editor.isEditable) return false
          if (editor.isActive('codeBlock')) return false
          return options.allow?.({ editor, range }) ?? true
        },
        command: ({ editor, range, props }) => {
          executeSlashCommand(
            {
              editor,
              range,
              query: latestProps?.query ?? '',
              text: latestProps?.text ?? '',
            },
            props,
            options.onExecute,
          )
        },
        render: () => ({
          onStart: (props) => {
            selectedIndex = firstExecutableIndex(props.items)
            emitUpdate(props, options.onOpen)
          },
          onUpdate: (props) => {
            selectedIndex = clampSelectedIndex(selectedIndex, props.items)
            if (props.items[selectedIndex] && !isSlashCommandItemExecutable(props.items[selectedIndex])) {
              selectedIndex = firstExecutableIndex(props.items)
            }
            emitUpdate(props, options.onUpdate)
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!latestProps) return false

            if (event.key === 'ArrowDown') {
              selectedIndex = findNextExecutableIndex(latestProps.items, selectedIndex, 1)
              options.onUpdate?.(toRenderState(latestProps, selectedIndex))
              return true
            }

            if (event.key === 'ArrowUp') {
              selectedIndex = findNextExecutableIndex(latestProps.items, selectedIndex, -1)
              options.onUpdate?.(toRenderState(latestProps, selectedIndex))
              return true
            }

            if (event.key === 'Enter') {
              const item = latestProps.items[selectedIndex]
              if (!item || !isSlashCommandItemExecutable(item)) return true
              latestProps.command(item)
              return true
            }

            return false
          },
          onExit: () => {
            latestProps = null
            selectedIndex = 0
            options.onClose?.()
          },
        }),
      }),
    ]
  },
})

export { exitSuggestion as exitSlashCommand }
