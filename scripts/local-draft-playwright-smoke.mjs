import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = process.cwd()
const visualCompareDir = resolve(process.env.VISUAL_COMPARE_DIR ?? join(repoRoot, '..', 'visual-compare'))
const visualComparePackage = join(visualCompareDir, 'package.json')
if (!existsSync(visualComparePackage)) throw new Error(`visual-compare not found at ${visualCompareDir}`)

const { chromium } = createRequire(visualComparePackage)('playwright')
const baseUrl = process.env.PLAYGROUND_URL ?? 'http://localhost:5173/tiptap-vue-pro/playground/'
const screenshotDir = resolve(process.env.SCREENSHOT_DIR ?? '/tmp')
const adapters = [
  { name: 'element-plus', hash: '#/element-plus', root: '.tvp-editor--element-plus' },
  { name: 'naive', hash: '#/naive', root: '.tvp-editor--naive' },
  { name: 'ant-design-vue', hash: '#/ant-design-vue', root: '.tvp-editor--ant-design-vue' },
]

function assert(condition, message, details) {
  if (condition) return
  throw new Error(`${message}${details ? `\n${JSON.stringify(details, null, 2)}` : ''}`)
}

function url(adapter) {
  return `${baseUrl.replace(/#.*$/, '')}${adapter.hash}`
}

function storageKey(adapter) {
  return `tiptap-vue-pro:draft:${encodeURIComponent(`playground-${adapter.name}`)}`
}

async function insertText(page, adapter, text) {
  const paragraph = page.locator(`${adapter.root} .tiptap p`).first()
  await paragraph.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(text)
}

async function waitForRecovery(page, adapter) {
  await page.locator(`${adapter.root} .tvp-draft-recovery`).waitFor({ timeout: 10000 })
}

async function inspectAdapter(page, adapter) {
  console.log(`checking local draft recovery for ${adapter.name}`)
  await page.goto(url(adapter), { waitUntil: 'networkidle', timeout: 30000 })
  await page.evaluate(key => localStorage.removeItem(key), storageKey(adapter))
  await page.reload({ waitUntil: 'networkidle' })

  const draftToggle = page.getByTestId('draft-toggle')
  const failureToggle = page.getByTestId('autosave-failure-toggle')
  await failureToggle.check()
  await draftToggle.uncheck()
  await insertText(page, adapter, ' draft-disabled')
  await page.waitForTimeout(350)
  assert(await page.evaluate(key => localStorage.getItem(key), storageKey(adapter)) === null, `${adapter.name}: disabled drafts should not write storage`)

  await draftToggle.check()
  const token = ` recovery-${adapter.name}-${Date.now()}`
  await insertText(page, adapter, token)
  await page.waitForFunction(key => localStorage.getItem(key) !== null, storageKey(adapter), { timeout: 10000 })
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey(adapter))
  assert(stored.version === 1 && stored.key === `playground-${adapter.name}`, `${adapter.name}: should write a versioned keyed envelope`, stored)
  assert(String(stored.content).includes(token), `${adapter.name}: envelope should contain latest full content`)

  await page.reload({ waitUntil: 'networkidle' })
  await waitForRecovery(page, adapter)
  assert(!(await page.locator(`${adapter.root} .tiptap`).textContent()).includes(token), `${adapter.name}: discovery must not silently restore`)
  assert(await page.locator(`${adapter.root} .tvp-draft-recovery`).getAttribute('aria-live') === 'polite', `${adapter.name}: recovery should be a polite live region`)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await page.locator(`${adapter.root} .tvp-draft-recovery`).evaluate((element) => {
    const band = element.getBoundingClientRect()
    const actions = element.querySelector('.tvp-draft-recovery__actions')?.getBoundingClientRect()
    return {
      scrollWidth: element.scrollWidth,
      width: band.width,
      actionsInside: Boolean(actions && actions.left >= band.left && actions.right <= band.right),
      actionGap: getComputedStyle(element.querySelector('.tvp-draft-recovery__actions')).gap,
    }
  })
  assert(mobile.scrollWidth <= mobile.width && mobile.actionsInside && mobile.actionGap === '6px', `${adapter.name}: mobile recovery layout should fit`, mobile)
  await page.screenshot({ path: join(screenshotDir, `tvp-local-draft-${adapter.name}-mobile.png`), fullPage: true })
  await page.getByTestId('dark-toggle').check()
  await page.waitForTimeout(350)
  const darkRecovery = await page.locator(`${adapter.root} .tvp-draft-recovery`).evaluate((element) => {
    const style = getComputedStyle(element)
    const action = element.querySelector('.tvp-draft-restore')
    const actionColor = action ? getComputedStyle(action).color : null
    const actionChannels = actionColor?.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? []
    return {
      color: style.color,
      background: style.backgroundColor,
      border: style.borderBottomColor,
      actionColor,
      actionReadable: actionChannels.length === 3
        && actionChannels.reduce((sum, channel) => sum + channel, 0) >= 350,
    }
  })
  assert(
    darkRecovery.background === 'rgb(43, 37, 23)'
      && darkRecovery.color !== 'rgb(216, 150, 20)'
      && darkRecovery.actionReadable,
    `${adapter.name}: dark recovery colors should use adapter dark tokens`,
    darkRecovery,
  )
  await page.screenshot({ path: join(screenshotDir, `tvp-local-draft-${adapter.name}-dark-mobile.png`), fullPage: true })
  await page.getByTestId('dark-toggle').uncheck()
  await page.setViewportSize({ width: 1440, height: 1000 })

  await failureToggle.check()
  await page.locator(`${adapter.root} .tvp-draft-restore`).click()
  await page.waitForFunction(({ root, token }) => document.querySelector(`${root} .tiptap`)?.textContent?.includes(token), { root: adapter.root, token })

  await page.reload({ waitUntil: 'networkidle' })
  await waitForRecovery(page, adapter)
  await page.locator(`${adapter.root} .tvp-draft-discard`).click()
  await page.waitForFunction(key => localStorage.getItem(key) === null, storageKey(adapter))
  assert(!(await page.locator(`${adapter.root} .tiptap`).textContent()).includes(token), `${adapter.name}: deleting a draft must not alter server content`)

  return { name: adapter.name, mobile }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

try {
  const metrics = []
  for (const adapter of adapters) metrics.push(await inspectAdapter(page, adapter))
  assert(errors.length === 0, 'local draft flow should not emit page errors', { errors })
  console.log(`local draft smoke passed for ${adapters.map(adapter => adapter.name).join(', ')}`)
  console.log(JSON.stringify(metrics, null, 2))
} finally {
  await browser.close()
}
