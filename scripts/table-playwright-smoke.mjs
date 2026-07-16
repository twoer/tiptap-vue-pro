import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = process.cwd()
const visualCompareDir = resolve(
  process.env.VISUAL_COMPARE_DIR ?? join(repoRoot, '..', 'visual-compare'),
)
const visualComparePackage = join(visualCompareDir, 'package.json')

if (!existsSync(visualComparePackage)) {
  throw new Error(
    `visual-compare not found at ${visualCompareDir}. Set VISUAL_COMPARE_DIR to the visual-compare repo.`,
  )
}

const requireFromVisualCompare = createRequire(visualComparePackage)
const { chromium } = requireFromVisualCompare('playwright')

const basePlaygroundUrl = process.env.PLAYGROUND_URL ??
  'http://localhost:5173/tiptap-vue-pro/playground/'
const adapters = [
  {
    name: 'element-plus',
    hash: '#/element-plus',
    root: '.tvp-editor--element-plus',
    dropdownMenu: '.el-dropdown-menu',
    dropdownItem: '.el-dropdown-menu__item',
    bubbleMenu: '.tvp-table-bubble-dropdown .el-dropdown-menu',
    bubbleItem: '.tvp-table-bubble-dropdown .el-dropdown-menu__item',
    bubbleLabel: '.tvp-table-bubble-dropdown .tvp-menu-item',
    resizeHandleColor: 'rgb(64, 158, 255)',
  },
  {
    name: 'naive',
    hash: '#/naive',
    root: '.tvp-editor--naive',
    dropdownMenu: '.n-dropdown-menu',
    dropdownItem: '.n-dropdown-option',
    bubbleMenu: '.tvp-table-bubble-dropdown.n-dropdown-menu, .tvp-table-bubble-dropdown .n-dropdown-menu',
    bubbleItem: '.tvp-table-bubble-dropdown .n-dropdown-option',
    bubbleLabel: '.tvp-table-bubble-dropdown .n-dropdown-option-body__label span',
    resizeHandleColor: 'rgb(24, 160, 88)',
  },
  {
    name: 'ant-design-vue',
    hash: '#/ant-design-vue',
    root: '.tvp-editor--ant-design-vue',
    dropdownMenu: '.ant-dropdown-menu',
    dropdownItem: '.tvp-ant-dropdown-menu__item',
    bubbleMenu: '.tvp-table-bubble-dropdown .ant-dropdown-menu',
    bubbleItem: '.tvp-table-bubble-dropdown .tvp-ant-dropdown-menu__item',
    bubbleLabel: '.tvp-table-bubble-dropdown .tvp-menu-item',
    resizeHandleColor: 'rgb(22, 119, 255)',
  },
]

const adapterFilter = (process.env.TABLE_E2E_ADAPTERS ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)
const selectedAdapters = adapterFilter.length
  ? adapters.filter((adapter) => adapterFilter.includes(adapter.name))
  : adapters

if (selectedAdapters.length === 0) {
  throw new Error(`No table e2e adapters matched TABLE_E2E_ADAPTERS=${process.env.TABLE_E2E_ADAPTERS}`)
}

function adapterUrl(adapter) {
  return `${basePlaygroundUrl.replace(/#.*$/, '')}${adapter.hash}`
}

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : ''
    throw new Error(`${message}${suffix}`)
  }
}

async function gotoAdapter(page, adapter) {
  await page.goto(adapterUrl(adapter), { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForSelector(`${adapter.root} table`, { timeout: 10000 })
}

async function getTableRows(page, adapter) {
  return page.evaluate((root) => {
    const table = document.querySelector(`${root} table`)
    return Array.from(table?.rows ?? []).map((row) =>
      Array.from(row.cells).map((cell) => cell.textContent?.trim() || ''),
    )
  }, adapter.root)
}

async function visibleCount(page, selector) {
  return page.evaluate((cssSelector) => {
    return Array.from(document.querySelectorAll(cssSelector)).filter((el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0
    }).length
  }, selector)
}

async function openSecondColumnGrip(page, adapter) {
  const secondHeader = page.locator(`${adapter.root} table tr:first-child th, ${adapter.root} table tr:first-child td`).nth(1)
  await secondHeader.scrollIntoViewIfNeeded()
  await secondHeader.click()

  const grips = page.locator(`${adapter.root} .tvp-table-grip--col .tvp-table-grip__icon`)
  await grips.nth(1).waitFor({ state: 'visible', timeout: 5000 })
  await grips.nth(1).click()
}

async function assertMoveRightSuppressesBubble(page, adapter) {
  await gotoAdapter(page, adapter)
  await openSecondColumnGrip(page, adapter)

  const rightMoveItem = page.locator(`${adapter.dropdownMenu}:visible ${adapter.dropdownItem}`).filter({ hasText: '右移' })
  await rightMoveItem.waitFor({ state: 'visible', timeout: 5000 })

  const openMenuCount = await visibleCount(page, adapter.dropdownMenu)
  const openBubbleDisplay = await page.evaluate((root) => {
    const bubble = document.querySelector(`${root} .tvp-table-bubble`)
    return bubble ? getComputedStyle(bubble).display : null
  }, adapter.root)
  assert(openMenuCount === 1, `${adapter.name}: grip should open exactly one dropdown menu`, { openMenuCount })
  assert(openBubbleDisplay === 'none', `${adapter.name}: table bubble should be hidden while grip menu is open`, { openBubbleDisplay })

  await rightMoveItem.click()
  await page.waitForTimeout(300)

  const state = await page.evaluate(({ rootSelector, dropdownSelector }) => {
    const root = document.querySelector(rootSelector)
    const bubble = document.querySelector(`${rootSelector} .tvp-table-bubble`)
    const dropdowns = Array.from(document.querySelectorAll(dropdownSelector)).filter((el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0
    })
    return {
      attr: root?.getAttribute('data-table-grip-suppress-bubble') ?? null,
      bubbleDisplay: bubble ? getComputedStyle(bubble).display : null,
      dropdownCount: dropdowns.length,
      selectedCells: document.querySelectorAll(`${rootSelector} td.selectedCell, ${rootSelector} th.selectedCell`).length,
    }
  }, { rootSelector: adapter.root, dropdownSelector: adapter.dropdownMenu })
  const rows = await getTableRows(page, adapter)

  assert(rows[0]?.join('|') === '模块|状态|能力|备注', `${adapter.name}: move right should reorder the second column`, { rows })
  assert(state.attr === 'true', `${adapter.name}: grip command should keep table bubble suppressed after dropdown closes`, state)
  assert(state.bubbleDisplay === 'none', `${adapter.name}: table bubble should not appear after grip move command`, state)
  assert(state.dropdownCount === 0, `${adapter.name}: grip dropdown should be closed after command`, state)
}

async function assertTableBubbleDropdownDensity(page, adapter) {
  await gotoAdapter(page, adapter)

  const cells = page.locator(`${adapter.root} table tr:first-child th, ${adapter.root} table tr:first-child td`)
  await cells.nth(0).click()
  await page.keyboard.down('Shift')
  await cells.nth(1).click()
  await page.keyboard.up('Shift')
  await page.waitForTimeout(200)

  const bubbleState = await page.evaluate((rootSelector) => {
    const bubble = document.querySelector(`${rootSelector} .tvp-table-bubble`)
    return {
      display: bubble ? getComputedStyle(bubble).display : null,
      selectedCells: document.querySelectorAll(`${rootSelector} td.selectedCell, ${rootSelector} th.selectedCell`).length,
    }
  }, adapter.root)
  assert(bubbleState.display === 'flex', `${adapter.name}: manual cell selection should show the merge bubble`, bubbleState)
  assert(bubbleState.selectedCells >= 2, `${adapter.name}: manual selection should mark selected cells`, bubbleState)

  const moreButton = page.locator(`${adapter.root} .tvp-table-bubble button`).last()
  await moreButton.waitFor({ state: 'visible', timeout: 5000 })
  await moreButton.click()
  await page.waitForTimeout(150)

  const density = await page.evaluate(({ menuSelector, itemSelector, labelSelector }) => {
    const menu = document.querySelector(menuSelector)
    const item = document.querySelector(itemSelector)
    const label = document.querySelector(labelSelector)
    const menuRect = menu?.getBoundingClientRect()
    const itemRect = item?.getBoundingClientRect()
    return {
      menuWidth: menuRect?.width ?? 0,
      itemHeight: itemRect?.height ?? 0,
      labelGap: label ? getComputedStyle(label).gap : '',
      visibleText: menu?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    }
  }, {
    menuSelector: adapter.bubbleMenu,
    itemSelector: adapter.bubbleItem,
    labelSelector: adapter.bubbleLabel,
  })

  assert(density.menuWidth >= 167.5, `${adapter.name}: table bubble dropdown should have enough width`, density)
  assert(density.itemHeight >= 46, `${adapter.name}: table bubble dropdown items should have enough height`, density)
  assert(density.labelGap === '9px', `${adapter.name}: table bubble dropdown icon/text gap should be 9px`, density)
}

async function assertColumnResizePersists(page, adapter) {
  await gotoAdapter(page, adapter)

  const table = page.locator(`${adapter.root} table`).first()
  await table.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)

  const before = await page.evaluate((rootSelector) => {
    const firstCell = document.querySelector(`${rootSelector} table tr:first-child th, ${rootSelector} table tr:first-child td`)
    const rect = firstCell?.getBoundingClientRect()
    return {
      width: rect?.width ?? 0,
      right: rect?.right ?? 0,
      top: rect?.top ?? 0,
      height: rect?.height ?? 0,
    }
  }, adapter.root)
  assert(before.width > 0, `${adapter.name}: first table cell should have a measurable width`, before)

  const dragY = before.top + Math.min(12, Math.max(4, before.height / 2))
  const dragX = before.right - 2
  await page.mouse.move(dragX, dragY)
  await page.waitForTimeout(150)

  const resizeState = await page.evaluate((rootSelector) => {
    const editor = document.querySelector(`${rootSelector} .ProseMirror`)
    const handle = document.querySelector(`${rootSelector} .column-resize-handle`)
    const rect = handle?.getBoundingClientRect()
    const style = handle ? window.getComputedStyle(handle) : null
    const beforeStyle = handle ? window.getComputedStyle(handle, '::before') : null
    const beforeBackground = beforeStyle?.backgroundColor ?? ''
    const opacity = Number(style?.opacity ?? 0)
    const hasVisibleColor =
      beforeBackground !== '' &&
      beforeBackground !== 'transparent' &&
      !beforeBackground.endsWith(', 0)') &&
      beforeBackground !== 'rgba(0, 0, 0, 0)'
    return {
      editorClass: editor?.getAttribute('class') ?? '',
      hasHandle: Boolean(handle),
      handleWidth: rect?.width ?? 0,
      handleHeight: rect?.height ?? 0,
      handleDisplay: style?.display ?? '',
      handleVisibility: style?.visibility ?? '',
      handleOpacity: style?.opacity ?? '',
      beforeBackground,
      hasVisibleColor,
      isVisible:
        Boolean(handle) &&
        (rect?.width ?? 0) >= 4 &&
        (rect?.height ?? 0) >= 16 &&
        style?.display !== 'none' &&
        style?.visibility !== 'hidden' &&
        opacity > 0 &&
        hasVisibleColor,
    }
  }, adapter.root)
  assert(resizeState.editorClass.includes('resize-cursor'), `${adapter.name}: column boundary hover should enable resize cursor`, resizeState)
  assert(resizeState.hasHandle, `${adapter.name}: column boundary hover should render resize handle`, resizeState)
  assert(resizeState.isVisible, `${adapter.name}: column resize handle should be visibly styled`, resizeState)
  assert(
    resizeState.beforeBackground === adapter.resizeHandleColor,
    `${adapter.name}: column resize handle should use the adapter primary color`,
    resizeState,
  )

  await page.mouse.down()
  await page.mouse.move(dragX + 80, dragY, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)

  const after = await page.evaluate((rootSelector) => {
    const firstCell = document.querySelector(`${rootSelector} table tr:first-child th, ${rootSelector} table tr:first-child td`)
    const firstCol = document.querySelector(`${rootSelector} table col`)
    const rect = firstCell?.getBoundingClientRect()
    return {
      width: rect?.width ?? 0,
      colStyle: firstCol?.getAttribute('style') ?? '',
      colwidth: firstCell?.getAttribute('colwidth') ?? '',
      tableHTML: document.querySelector(`${rootSelector} table`)?.outerHTML ?? '',
    }
  }, adapter.root)

  assert(
    after.width - before.width >= 40,
    `${adapter.name}: dragging the first column boundary should increase first column width`,
    { before, after },
  )
  assert(
    /width:\s*\d+px/.test(after.colStyle),
    `${adapter.name}: resized column should persist width on col style`,
    after,
  )
  assert(
    /^\d+$/.test(after.colwidth),
    `${adapter.name}: resized header cell should persist colwidth`,
    after,
  )

  const secondHeader = page.locator(`${adapter.root} table tr:first-child th, ${adapter.root} table tr:first-child td`).nth(1)
  await secondHeader.hover()
  const visibleGripCount = await visibleCount(page, `${adapter.root} .tvp-table-grip`)
  assert(visibleGripCount > 0, `${adapter.name}: table grips should remain visible after column resize`, { visibleGripCount })
}

const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' })
try {
  for (const adapter of selectedAdapters) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    try {
      await assertColumnResizePersists(page, adapter)
      await assertMoveRightSuppressesBubble(page, adapter)
      await assertTableBubbleDropdownDensity(page, adapter)
      console.log(`table-playwright-smoke ${adapter.name} passed`)
    } finally {
      await page.close()
    }
  }

  console.log(`table-playwright-smoke passed (${selectedAdapters.map((adapter) => adapter.name).join(', ')})`)
} finally {
  await browser.close()
}
