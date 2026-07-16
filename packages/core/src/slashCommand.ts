export type SlashCommandId =
  | 'heading'
  | 'todo'
  | 'bulletList'
  | 'orderedList'
  | 'table'
  | 'image'
  | 'divider'
  | 'codeBlock'

export interface SlashCommandItem {
  id: SlashCommandId
  label: string
  hint?: string
  icon: string
  aliases: string[]
  keywords: string[]
  hiddenInDefault?: boolean
  disabledReason?: string
}

export interface SlashCommandRunnerContext {
  commands: {
    toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6 | 0) => void
    taskList: () => void
    bulletList: () => void
    orderedList: () => void
    insertTable: (rows?: number, cols?: number) => void
    hr: () => void
    codeBlock: () => void
  }
}

export interface RunSlashCommandItemOptions {
  onImage?: (item: SlashCommandItem) => void
}

interface RankedSlashCommandItem {
  item: SlashCommandItem
  rank: number
  index: number
}

export const SLASH_COMMAND_DEFAULT_ITEM_IDS: SlashCommandId[] = [
  'heading',
  'todo',
  'bulletList',
  'orderedList',
  'table',
  'image',
  'divider',
  'codeBlock',
]

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'heading',
    label: '标题',
    hint: '把当前段落变成标题',
    icon: 'Heading',
    aliases: ['h', 'h1', 'h2', 'h3', 'bt', 'biaoti', 'title', 'heading'],
    keywords: ['标题', '一级标题', '二级标题', '三级标题', 'headline'],
  },
  {
    id: 'todo',
    label: '待办',
    hint: '开始一个任务列表',
    icon: 'ListChecks',
    aliases: ['todo', 'task', 'check', 'checkbox', 'renwu', 'daiban'],
    keywords: ['待办', '任务', '清单', '复选框', 'task list'],
  },
  {
    id: 'bulletList',
    label: '无序列表',
    hint: '开始项目符号列表',
    icon: 'List',
    aliases: ['ul', 'bullet', 'list', 'wuxu', 'wuxuliebiao'],
    keywords: ['无序', '列表', '项目符号', 'bullet list'],
  },
  {
    id: 'orderedList',
    label: '有序列表',
    hint: '开始数字编号列表',
    icon: 'ListOrdered',
    aliases: ['ol', 'ordered', 'number', 'numbered', 'youxu', 'youxuliebiao'],
    keywords: ['有序', '列表', '编号', '数字列表', 'ordered list'],
  },
  {
    id: 'table',
    label: '表格',
    hint: '插入 3 x 3 表格',
    icon: 'Table',
    aliases: ['biao', 'biaoge', 'table', 'grid'],
    keywords: ['表格', '网格', '单元格', 'table grid'],
  },
  {
    id: 'image',
    label: '图片',
    hint: '插入或上传图片',
    icon: 'ImagePlus',
    aliases: ['tu', 'tupian', 'image', 'img', 'picture', 'photo', 'upload'],
    keywords: ['图片', '图像', '上传图片', '插图', 'image upload'],
  },
  {
    id: 'divider',
    label: '分割线',
    hint: '插入水平分割线',
    icon: 'Minus',
    aliases: ['hr', 'line', 'rule', 'divider', 'fengexian'],
    keywords: ['分割线', '水平线', '分隔', 'horizontal rule'],
  },
  {
    id: 'codeBlock',
    label: '代码块',
    hint: '插入多行代码',
    icon: 'Code',
    aliases: ['code', 'pre', 'codeblock', 'daima', 'daimakuai'],
    keywords: ['代码', '代码块', '多行代码', 'code block'],
  },
]

function normalizeSlashCommandQuery(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, '')
}

function searchableValues(item: SlashCommandItem): string[] {
  return [
    item.id,
    item.label,
    item.hint ?? '',
    ...item.aliases,
    ...item.keywords,
  ].map(normalizeSlashCommandQuery)
}

function slashCommandRank(item: SlashCommandItem, query: string): number {
  const normalizedQuery = normalizeSlashCommandQuery(query)
  if (!normalizedQuery) return item.hiddenInDefault ? -1 : 100

  const values = searchableValues(item)
  if (item.aliases.map(normalizeSlashCommandQuery).includes(normalizedQuery)) return 500
  if (values.some((value) => value.startsWith(normalizedQuery))) return 400
  if (values.some((value) => value.includes(normalizedQuery))) return 300

  return -1
}

export function normalizeSlashCommandInput(value: string): string {
  return normalizeSlashCommandQuery(value)
}

export function isSlashCommandItemExecutable(item: SlashCommandItem): boolean {
  return !item.disabledReason
}

export function getDefaultSlashCommandItems(
  items: readonly SlashCommandItem[] = SLASH_COMMAND_ITEMS,
): SlashCommandItem[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return SLASH_COMMAND_DEFAULT_ITEM_IDS
    .map((id) => byId.get(id))
    .filter((item): item is SlashCommandItem => !!item && !item.hiddenInDefault)
}

export function filterSlashCommandItems(
  items: readonly SlashCommandItem[] = SLASH_COMMAND_ITEMS,
  query = '',
): SlashCommandItem[] {
  const normalizedQuery = normalizeSlashCommandQuery(query)
  const source = normalizedQuery ? items : getDefaultSlashCommandItems(items)
  return source
    .map((item, index): RankedSlashCommandItem => ({
      item,
      rank: slashCommandRank(item, normalizedQuery),
      index,
    }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => {
      const executableDelta = Number(isSlashCommandItemExecutable(b.item)) - Number(isSlashCommandItemExecutable(a.item))
      if (executableDelta !== 0) return executableDelta
      if (b.rank !== a.rank) return b.rank - a.rank
      return a.index - b.index
    })
    .map(({ item }) => item)
}

export function getSlashCommandItem(
  id: SlashCommandId,
  items: readonly SlashCommandItem[] = SLASH_COMMAND_ITEMS,
): SlashCommandItem | undefined {
  return items.find((item) => item.id === id)
}

export function runSlashCommandItem(
  ctx: SlashCommandRunnerContext,
  item: SlashCommandItem,
  options: RunSlashCommandItemOptions = {},
): boolean {
  if (!isSlashCommandItemExecutable(item)) return false

  switch (item.id) {
    case 'heading':
      ctx.commands.toggleHeading(2)
      return true
    case 'todo':
      ctx.commands.taskList()
      return true
    case 'bulletList':
      ctx.commands.bulletList()
      return true
    case 'orderedList':
      ctx.commands.orderedList()
      return true
    case 'table':
      ctx.commands.insertTable(3, 3)
      return true
    case 'image':
      options.onImage?.(item)
      return Boolean(options.onImage)
    case 'divider':
      ctx.commands.hr()
      return true
    case 'codeBlock':
      ctx.commands.codeBlock()
      return true
    default:
      return false
  }
}
