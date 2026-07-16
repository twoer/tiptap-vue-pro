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
  },
  {
    name: 'naive',
    hash: '#/naive',
    root: '.tvp-editor--naive',
  },
  {
    name: 'ant-design-vue',
    hash: '#/ant-design-vue',
    root: '.tvp-editor--ant-design-vue',
  },
]

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
  await page.waitForSelector(`${adapter.root} .ProseMirror`, { timeout: 10000 })
}

async function clearEditor(page, adapter) {
  const editor = page.locator(`${adapter.root} .ProseMirror`).first()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(100)
}

async function typeSlash(page, adapter, text) {
  await clearEditor(page, adapter)
  await page.keyboard.insertText(text)
  await page.locator(`${adapter.root} .tvp-slash-menu`).waitFor({ state: 'visible', timeout: 5000 })
}

async function assertSlashTableKeyboard(page, adapter) {
  await gotoAdapter(page, adapter)
  await typeSlash(page, adapter, '/表')

  const menuText = await page.locator(`${adapter.root} .tvp-slash-menu`).innerText()
  assert(menuText.includes('表格'), `${adapter.name}: /表 should show table command`, { menuText })

  await page.keyboard.press('Enter')
  await page.waitForSelector(`${adapter.root} table`, { timeout: 5000 })

  const tableState = await page.evaluate((root) => {
    const table = document.querySelector(`${root} table`)
    const active = document.activeElement
    return {
      rowCount: table?.rows.length ?? 0,
      firstRowCellCount: table?.rows[0]?.cells.length ?? 0,
      activeInsideEditor: Boolean(active?.closest(`${root} .ProseMirror`)),
      text: document.querySelector(`${root} .ProseMirror`)?.textContent ?? '',
    }
  }, adapter.root)

  assert(tableState.rowCount === 3, `${adapter.name}: /表 Enter should insert a 3-row table`, tableState)
  assert(tableState.firstRowCellCount === 3, `${adapter.name}: /表 Enter should insert a 3-column table`, tableState)
  assert(tableState.activeInsideEditor, `${adapter.name}: cursor should remain inside editor after table insertion`, tableState)
}

async function assertSlashTodoClick(page, adapter) {
  await gotoAdapter(page, adapter)
  await typeSlash(page, adapter, '/todo')

  const todo = page.locator(`${adapter.root} .tvp-slash-menu button`).filter({ hasText: '待办' }).first()
  await todo.waitFor({ state: 'visible', timeout: 5000 })
  await todo.click()
  await page.waitForSelector(`${adapter.root} ul[data-type="taskList"]`, { timeout: 5000 })
}

async function assertSlashEscapeKeepsText(page, adapter) {
  await gotoAdapter(page, adapter)
  await typeSlash(page, adapter, '/表')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  const state = await page.evaluate((root) => {
    const menu = document.querySelector(`${root} .tvp-slash-menu`)
    const editor = document.querySelector(`${root} .ProseMirror`)
    return {
      hasMenu: Boolean(menu),
      text: editor?.textContent ?? '',
    }
  }, adapter.root)

  assert(!state.hasMenu, `${adapter.name}: Escape should close slash menu`, state)
  assert(state.text.includes('/表'), `${adapter.name}: Escape should keep typed slash text`, state)
}

async function assertAdapterSwitchNoErrors(page, errors) {
  for (const adapter of adapters) {
    await gotoAdapter(page, adapter)
    await typeSlash(page, adapter, '/表')
  }
  assert(errors.length === 0, 'adapter switching with an open slash menu should not emit page errors', {
    errors,
  })
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})

try {
  for (const adapter of adapters) {
    await assertSlashTableKeyboard(page, adapter)
    await assertSlashTodoClick(page, adapter)
    await assertSlashEscapeKeepsText(page, adapter)
  }
  await assertAdapterSwitchNoErrors(page, errors)
  console.log(`slash-command smoke passed for ${adapters.map((adapter) => adapter.name).join(', ')}`)
} finally {
  await browser.close()
}
