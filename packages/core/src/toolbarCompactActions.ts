import type { ToolbarBuiltinKey } from './toolbar'
import type {
  ToolbarHorizontalRuleOption,
  ToolbarMarkdownOption,
} from './toolbarConfigData'

export interface ToolbarCompactAction {
  key: string
  item: ToolbarBuiltinKey
  payload?: string
}

export interface ToolbarCompactActionOptions {
  hasImageUpload: boolean
  allowImageUrl: boolean
  hasAssetUpload: boolean
  horizontalRules: readonly ToolbarHorizontalRuleOption[]
  markdown: readonly ToolbarMarkdownOption[]
}

export function resolveToolbarCompactActions(
  items: readonly ToolbarBuiltinKey[],
  options: ToolbarCompactActionOptions,
): ToolbarCompactAction[] {
  return items.flatMap((item) => {
    if (item === 'image') {
      const actions: ToolbarCompactAction[] = []
      if (options.hasImageUpload) actions.push({ key: 'image:upload', item, payload: 'upload' })
      if (options.allowImageUrl) actions.push({ key: 'image:url', item, payload: 'url' })
      return actions
    }

    if (item === 'attachment') {
      return options.hasAssetUpload
        ? [
            { key: 'attachment:video', item, payload: 'video' },
            { key: 'attachment:file', item, payload: 'file' },
          ]
        : []
    }

    if (item === 'hr') {
      return options.horizontalRules.map((rule) => ({
        key: `hr:${rule.value}`,
        item,
        payload: rule.value,
      }))
    }

    if (item === 'markdown') {
      return options.markdown.map((action) => ({
        key: `markdown:${action.value}`,
        item,
        payload: action.value,
      }))
    }

    return [{ key: item, item }]
  })
}
