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
const basePlaygroundUrl = process.env.PLAYGROUND_URL
  ?? 'http://localhost:5173/tiptap-vue-pro/playground/'
const screenshotDir = resolve(process.env.SCREENSHOT_DIR ?? '/tmp')
const adapters = [
  { name: 'element-plus', hash: '#/element-plus', root: '.tvp-editor--element-plus' },
  { name: 'naive', hash: '#/naive', root: '.tvp-editor--naive' },
  { name: 'ant-design-vue', hash: '#/ant-design-vue', root: '.tvp-editor--ant-design-vue' },
]

function assert(condition, message, details) {
  if (condition) return
  const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : ''
  throw new Error(`${message}${suffix}`)
}

function adapterUrl(adapter) {
  return `${basePlaygroundUrl.replace(/#.*$/, '')}${adapter.hash}`
}

async function waitForStatus(page, adapter, label) {
  await page.waitForFunction(
    ({ root, label }) => document.querySelector(`${root} .tvp-autosave-status`)?.textContent?.trim() === label,
    { root: adapter.root, label },
    { timeout: 10000 },
  )
}

async function insertText(page, adapter, text) {
  const paragraph = page.locator(`${adapter.root} .tiptap p`).first()
  await paragraph.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(text)
}

async function footerMetrics(page, adapter) {
  return page.locator(`${adapter.root} .tvp-footer`).evaluate((footer) => {
    const footerRect = footer.getBoundingClientRect()
    const status = footer.querySelector('.tvp-autosave-status')?.getBoundingClientRect()
    const wordCount = Array.from(footer.children)
      .find(element => !element.classList.contains('tvp-autosave-status-group'))
      ?.getBoundingClientRect()
    return {
      footerWidth: footerRect.width,
      footerScrollWidth: footer.scrollWidth,
      statusWidth: status?.width ?? 0,
      statusInside: Boolean(status && status.left >= footerRect.left && status.right <= footerRect.right),
      wordCountInside: Boolean(wordCount && wordCount.left >= footerRect.left && wordCount.right <= footerRect.right),
      overlap: Boolean(status && wordCount && status.right > wordCount.left),
    }
  })
}

async function inspectAdapter(page, adapter) {
  console.log(`checking autosave browser flow for ${adapter.name}`)
  await page.goto('about:blank')
  await page.goto(adapterUrl(adapter), { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator(adapter.root).waitFor({ timeout: 15000 })

  const autosaveToggle = page.getByTestId('autosave-toggle')
  const failureToggle = page.getByTestId('autosave-failure-toggle')
  const wordCountToggle = page.getByTestId('word-count-toggle')
  const status = page.locator(`${adapter.root} .tvp-autosave-status`)

  assert(await status.getAttribute('aria-live') === 'polite', `${adapter.name}: status should be polite live text`)
  await autosaveToggle.uncheck()
  assert(await status.count() === 0, `${adapter.name}: disabled autosave should hide status`)
  await autosaveToggle.check()
  await page.evaluate(() => window.__TVP_AUTOSAVE__.reset())

  await insertText(page, adapter, ` autosave-${adapter.name}`)
  await waitForStatus(page, adapter, '未保存')
  await waitForStatus(page, adapter, '保存中...')
  await waitForStatus(page, adapter, '已保存')

  await page.evaluate(() => window.__TVP_AUTOSAVE__.reset())
  await insertText(page, adapter, ' rapid-a')
  await page.waitForTimeout(80)
  await page.keyboard.insertText('-b')
  await page.waitForTimeout(80)
  await page.keyboard.insertText('-latest')
  await waitForStatus(page, adapter, '已保存')
  const rapid = await page.evaluate(() => ({
    attempts: window.__TVP_AUTOSAVE__.getAttemptCount(),
    content: window.__TVP_AUTOSAVE__.getLastSavedContent(),
  }))
  assert(rapid.attempts === 1, `${adapter.name}: rapid edits should debounce to one save`, rapid)
  assert(String(rapid.content).includes('rapid-a-b-latest'), `${adapter.name}: latest content should win`, rapid)

  await failureToggle.check()
  await insertText(page, adapter, ' failure')
  await waitForStatus(page, adapter, '保存失败')
  assert((await page.locator(`${adapter.root} .tvp-footer`).textContent()).includes('字符'), `${adapter.name}: error should not hide word count`)

  await wordCountToggle.uncheck()
  assert(await status.isVisible(), `${adapter.name}: status should remain visible without word count`)
  await wordCountToggle.check()
  await failureToggle.uncheck()
  await page.locator(`${adapter.root} .tvp-autosave-retry`).click()
  await waitForStatus(page, adapter, '保存中...')
  await waitForStatus(page, adapter, '已保存')

  const desktop = await footerMetrics(page, adapter)
  assert(
    desktop.statusWidth >= 72
      && desktop.statusInside
      && desktop.wordCountInside
      && !desktop.overlap
      && desktop.footerScrollWidth <= desktop.footerWidth,
    `${adapter.name}: desktop footer should not overlap or overflow`,
    desktop,
  )

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await footerMetrics(page, adapter)
  assert(
    mobile.statusWidth >= 72
      && mobile.statusInside
      && mobile.wordCountInside
      && !mobile.overlap
      && mobile.footerScrollWidth <= mobile.footerWidth,
    `${adapter.name}: mobile footer should not overlap or overflow`,
    mobile,
  )
  await page.screenshot({
    path: join(screenshotDir, `tvp-autosave-${adapter.name}-mobile.png`),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })

  return { name: adapter.name, desktop, mobile }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  const metrics = []
  for (const adapter of adapters) metrics.push(await inspectAdapter(page, adapter))

  assert(errors.length === 0, 'autosave browser flow should not emit page errors', { errors })
  console.log(`autosave smoke passed for ${adapters.map(adapter => adapter.name).join(', ')}`)
  console.log(JSON.stringify(metrics, null, 2))
} finally {
  await browser.close()
}
