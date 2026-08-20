export type ToolbarBuiltinKey =
  | 'undo'
  | 'redo'
  | 'heading'
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'underline'
  | 'code'
  | 'superscript'
  | 'subscript'
  | 'color'
  | 'highlight'
  | 'align'
  | 'decreaseIndent'
  | 'increaseIndent'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'mermaid'
  | 'hr'
  | 'link'
  | 'image'
  | 'attachment'
  | 'table'
  | 'clearFormat'
  | 'findReplace'
  | 'markdown'
  | 'print'
  | 'fullscreen'
  | 'preview'

export type ToolbarGroupConfig = ToolbarBuiltinKey[]
export type ToolbarConfig = ToolbarGroupConfig[]
export type ToolbarProp = ToolbarConfig | false
export type ToolbarLayoutMode = 'classic' | 'compact'
export type ToolbarCompactMenuId = 'format' | 'list' | 'insert' | 'more'

export interface ToolbarCompactMenu {
  id: ToolbarCompactMenuId
  items: ToolbarBuiltinKey[]
}

export interface ResolvedToolbarLayout {
  mode: ToolbarLayoutMode
  groups: ToolbarConfig
  menus: ToolbarCompactMenu[]
  trailing: ToolbarBuiltinKey[]
}

export const DEFAULT_TOOLBAR: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'strike', 'code', 'superscript', 'subscript'],
  ['color', 'highlight', 'clearFormat'],
  ['align', 'decreaseIndent', 'increaseIndent'],
  ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'],
  ['link', 'image', 'attachment', 'table', 'mermaid', 'hr'],
  ['findReplace', 'markdown', 'print'],
  ['preview', 'fullscreen'],
]

const COMPACT_MENU_ITEMS: Record<ToolbarCompactMenuId, readonly ToolbarBuiltinKey[]> = {
  format: ['strike', 'code', 'superscript', 'subscript', 'clearFormat'],
  list: ['decreaseIndent', 'increaseIndent', 'bulletList', 'orderedList', 'taskList', 'blockquote'],
  // Code block and table keep their dedicated pickers in compact mode.
  insert: ['image', 'attachment', 'mermaid', 'hr'],
  more: ['findReplace', 'markdown', 'print'],
}

const COMPACT_MENU_ORDER = Object.keys(COMPACT_MENU_ITEMS) as ToolbarCompactMenuId[]
const COMPACT_TRAILING_ITEMS = new Set<ToolbarBuiltinKey>(['preview', 'fullscreen'])
const COMPACT_MENU_BY_ITEM = new Map<ToolbarBuiltinKey, ToolbarCompactMenuId>(
  COMPACT_MENU_ORDER.flatMap((menuId) =>
    COMPACT_MENU_ITEMS[menuId].map((item) => [item, menuId] as const),
  ),
)

export function normalizeToolbarConfig(toolbar?: ToolbarProp): ToolbarConfig {
  if (toolbar === false) return []
  const source = toolbar ?? DEFAULT_TOOLBAR
  return source
    .filter((group) => group.length > 0)
    .map((group) => [...group])
}

export function resolveToolbarLayout(
  toolbar: ToolbarProp | undefined,
  mode: ToolbarLayoutMode = 'classic',
): ResolvedToolbarLayout {
  const groups = normalizeToolbarConfig(toolbar)

  if (mode === 'classic') {
    return { mode, groups, menus: [], trailing: [] }
  }

  const menuItems = new Map<ToolbarCompactMenuId, ToolbarBuiltinKey[]>(
    COMPACT_MENU_ORDER.map((menuId) => [menuId, []]),
  )
  const trailing: ToolbarBuiltinKey[] = []
  const primaryGroups = groups
    .map((group) => group.filter((item) => {
      if (COMPACT_TRAILING_ITEMS.has(item)) {
        trailing.push(item)
        return false
      }

      const menuId = COMPACT_MENU_BY_ITEM.get(item)
      if (!menuId) return true
      menuItems.get(menuId)?.push(item)
      return false
    }))
    .filter((group) => group.length > 0)

  const menus = COMPACT_MENU_ORDER
    .map((id) => ({ id, items: menuItems.get(id) ?? [] }))
    .filter((menu) => menu.items.length > 0)

  return {
    mode,
    groups: primaryGroups,
    menus,
    trailing,
  }
}
