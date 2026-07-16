import { describe, expect, it, vi } from 'vitest'
import {
  SLASH_COMMAND_DEFAULT_ITEM_IDS,
  SLASH_COMMAND_ITEMS,
  filterSlashCommandItems,
  getDefaultSlashCommandItems,
  getSlashCommandItem,
  isSlashCommandItemExecutable,
  normalizeSlashCommandInput,
  runSlashCommandItem,
  type SlashCommandItem,
  type SlashCommandRunnerContext,
} from './slashCommand'

function ids(items: SlashCommandItem[]) {
  return items.map((item) => item.id)
}

describe('slash command protocol', () => {
  it('keeps the V2 default menu short and ordered', () => {
    expect(SLASH_COMMAND_DEFAULT_ITEM_IDS).toEqual([
      'heading',
      'todo',
      'bulletList',
      'orderedList',
      'table',
      'image',
      'divider',
      'codeBlock',
    ])
    expect(ids(getDefaultSlashCommandItems())).toEqual(SLASH_COMMAND_DEFAULT_ITEM_IDS)
    expect(getDefaultSlashCommandItems()).toHaveLength(8)
  })

  it('normalizes typed slash queries', () => {
    expect(normalizeSlashCommandInput('/ 表 ')).toBe('表')
    expect(normalizeSlashCommandInput('//TODO')).toBe('todo')
    expect(normalizeSlashCommandInput(' code block ')).toBe('codeblock')
  })

  it.each([
    ['/表', 'table'],
    ['/biaoge', 'table'],
    ['/table', 'table'],
    ['/todo', 'todo'],
    ['/renwu', 'todo'],
    ['/h1', 'heading'],
    ['/bt', 'heading'],
    ['/img', 'image'],
    ['/tu', 'image'],
    ['/line', 'divider'],
    ['/code', 'codeBlock'],
  ] as const)('ranks %s as %s', (query, expectedId) => {
    expect(filterSlashCommandItems(SLASH_COMMAND_ITEMS, query)[0]?.id).toBe(expectedId)
  })

  it('keeps executable matches ahead of disabled matches', () => {
    const items: SlashCommandItem[] = [
      {
        id: 'image',
        label: '图片',
        icon: 'ImagePlus',
        aliases: ['media'],
        keywords: ['media'],
        disabledReason: '未配置上传',
      },
      {
        id: 'table',
        label: '媒体表格',
        icon: 'Table',
        aliases: ['media'],
        keywords: ['media'],
      },
    ]

    expect(filterSlashCommandItems(items, '/media')[0]?.id).toBe('table')
  })

  it('can mark command items as executable or disabled', () => {
    const image = getSlashCommandItem('image')!
    expect(isSlashCommandItemExecutable(image)).toBe(true)
    expect(isSlashCommandItemExecutable({ ...image, disabledReason: '未配置上传' })).toBe(false)
  })

  it('looks up command items by id', () => {
    expect(getSlashCommandItem('table')?.label).toBe('表格')
    expect(getSlashCommandItem('divider')?.aliases).toContain('hr')
  })

  it('runs core-owned slash commands through the editor command context', () => {
    const commands: SlashCommandRunnerContext['commands'] = {
      toggleHeading: vi.fn(),
      taskList: vi.fn(),
      bulletList: vi.fn(),
      orderedList: vi.fn(),
      insertTable: vi.fn(),
      hr: vi.fn(),
      codeBlock: vi.fn(),
    }
    const ctx = { commands }

    expect(runSlashCommandItem(ctx, getSlashCommandItem('heading')!)).toBe(true)
    expect(commands.toggleHeading).toHaveBeenCalledWith(2)

    expect(runSlashCommandItem(ctx, getSlashCommandItem('table')!)).toBe(true)
    expect(commands.insertTable).toHaveBeenCalledWith(3, 3)

    expect(runSlashCommandItem(ctx, getSlashCommandItem('divider')!)).toBe(true)
    expect(commands.hr).toHaveBeenCalledTimes(1)
  })

  it('delegates image slash commands to the adapter flow', () => {
    const ctx = {
      commands: {
        toggleHeading: vi.fn(),
        taskList: vi.fn(),
        bulletList: vi.fn(),
        orderedList: vi.fn(),
        insertTable: vi.fn(),
        hr: vi.fn(),
        codeBlock: vi.fn(),
      },
    }
    const onImage = vi.fn()
    const image = getSlashCommandItem('image')!

    expect(runSlashCommandItem(ctx, image)).toBe(false)
    expect(runSlashCommandItem(ctx, image, { onImage })).toBe(true)
    expect(onImage).toHaveBeenCalledWith(image)
  })
})
