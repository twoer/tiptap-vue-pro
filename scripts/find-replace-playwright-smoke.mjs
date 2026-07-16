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

async function setEditorText(page, adapter, text) {
  const editor = page.locator(`${adapter.root} .ProseMirror`).first()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText(text)
}

async function openFindPanelByKeyboard(page, adapter) {
  const editor = page.locator(`${adapter.root} .ProseMirror`).first()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+F' : 'Control+F')
  await page.locator(`${adapter.root} .tvp-find-panel`).waitFor({ state: 'visible', timeout: 5000 })
}

async function openFindPanelFromToolbar(page, adapter) {
  await page.locator(`${adapter.root} [aria-label="查找替换"]`).first().click()
  await page.locator(`${adapter.root} .tvp-find-panel`).waitFor({ state: 'visible', timeout: 5000 })
}

async function fillFind(page, adapter, value) {
  await page.locator(`${adapter.root} .tvp-find-panel input:not([type="checkbox"])`).first().fill(value)
}

async function fillReplacement(page, adapter, value) {
  await page.locator(`${adapter.root} .tvp-find-panel input:not([type="checkbox"])`).nth(1).fill(value)
}

async function findPanelText(page, adapter) {
  return page.locator(`${adapter.root} .tvp-find-panel`).innerText()
}

async function editorState(page, adapter) {
  return page.evaluate((root) => {
    const editor = document.querySelector(`${root} .ProseMirror`)
    return {
      text: editor?.textContent ?? '',
      matches: document.querySelectorAll(`${root} .tvp-find-match`).length,
      activeMatches: document.querySelectorAll(`${root} .tvp-find-match--active`).length,
      panelOpen: Boolean(document.querySelector(`${root} .tvp-find-panel`)),
    }
  }, adapter.root)
}

async function assertFindReplaceFlow(page, adapter) {
  await gotoAdapter(page, adapter)
  await setEditorText(page, adapter, 'alpha beta alpha ALPHA')
  await openFindPanelFromToolbar(page, adapter)
  await fillFind(page, adapter, 'alpha')

  await page.waitForFunction((root) => {
    return document.querySelectorAll(`${root} .tvp-find-match`).length === 3
  }, adapter.root)

  let state = await editorState(page, adapter)
  let panelText = await findPanelText(page, adapter)
  assert(panelText.includes('1 / 3'), `${adapter.name}: find panel should show first match count`, { panelText })
  assert(state.matches === 3, `${adapter.name}: query should highlight all matches`, state)
  assert(state.activeMatches === 1, `${adapter.name}: query should mark one active match`, state)

  await page.locator(`${adapter.root} .tvp-find-panel [aria-label="下一个"]`).click()
  panelText = await findPanelText(page, adapter)
  assert(panelText.includes('2 / 3'), `${adapter.name}: next should move active match`, { panelText })

  await fillReplacement(page, adapter, 'omega')
  await page.locator(`${adapter.root} .tvp-find-panel [aria-label="替换当前"]`).click()
  await page.waitForFunction((root) => {
    return document.querySelectorAll(`${root} .tvp-find-match`).length === 2
  }, adapter.root)

  state = await editorState(page, adapter)
  panelText = await findPanelText(page, adapter)
  assert(state.text.includes('omega'), `${adapter.name}: replace current should update editor text`, state)
  assert(panelText.includes('/ 2'), `${adapter.name}: replace current should reduce match count`, { panelText })

  await page.locator(`${adapter.root} .tvp-find-panel [aria-label="全部替换"]`).click()
  await page.waitForFunction((root) => {
    return document.querySelectorAll(`${root} .tvp-find-match`).length === 0
  }, adapter.root)

  state = await editorState(page, adapter)
  assert(state.text === 'omega beta omega omega', `${adapter.name}: replace all should update remaining matches`, state)
  assert(state.matches === 0, `${adapter.name}: replace all should clear match decorations`, state)

  await page.keyboard.press('Escape')
  await page.locator(`${adapter.root} .tvp-find-panel`).waitFor({ state: 'hidden', timeout: 5000 })
  state = await editorState(page, adapter)
  assert(!state.panelOpen, `${adapter.name}: Escape should close find panel`, state)
  assert(state.matches === 0, `${adapter.name}: Escape should leave no find decorations`, state)
}

async function assertFindPanelStaysPinnedDuringNavigation(page, adapter) {
  await gotoAdapter(page, adapter)
  const longText = [
    'alpha at top',
    ...Array.from({ length: 80 }, (_, index) => `filler line ${index + 1}`),
    'alpha at bottom',
  ].join('\n')
  await setEditorText(page, adapter, longText)
  await openFindPanelFromToolbar(page, adapter)
  await fillFind(page, adapter, 'alpha')

  await page.waitForFunction((root) => {
    return document.querySelectorAll(`${root} .tvp-find-match`).length === 2
  }, adapter.root)

  const nextButton = page.locator(`${adapter.root} .tvp-find-panel [aria-label="下一个"]`)
  const before = await nextButton.boundingBox()
  assert(before, `${adapter.name}: next button should have a bounding box before navigation`)

  await nextButton.click()

  await page.waitForFunction((root) => {
    const wrap = document.querySelector(`${root} .tvp-content-wrap`)
    return (wrap?.scrollTop ?? 0) > 0
  }, adapter.root)

  const after = await nextButton.boundingBox()
  assert(after, `${adapter.name}: next button should have a bounding box after navigation`)
  const dx = Math.abs(before.x - after.x)
  const dy = Math.abs(before.y - after.y)
  assert(dx <= 1 && dy <= 1, `${adapter.name}: find panel controls should stay pinned while matches scroll`, {
    before,
    after,
    dx,
    dy,
  })
}

async function assertAdapterSwitchNoErrors(page, errors) {
  for (const adapter of adapters) {
    await gotoAdapter(page, adapter)
    await setEditorText(page, adapter, 'switch alpha alpha')
    await openFindPanelByKeyboard(page, adapter)
    await fillFind(page, adapter, 'alpha')
  }
  assert(errors.length === 0, 'adapter switching with an open find panel should not emit page errors', {
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
    await assertFindReplaceFlow(page, adapter)
    await assertFindPanelStaysPinnedDuringNavigation(page, adapter)
  }
  await assertAdapterSwitchNoErrors(page, errors)
  console.log(`find-replace smoke passed for ${adapters.map((adapter) => adapter.name).join(', ')}`)
} finally {
  await browser.close()
}
