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

async function inspectAdapter(page, adapter) {
  await page.goto('about:blank')
  await page.goto(adapterUrl(adapter), { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator(`${adapter.root} button[aria-label="预览"]`).click()

  const button = page.locator(`${adapter.root} .tvp-preview-bar__edit-btn`)
  await button.waitFor({ timeout: 15000 })
  const metrics = await button.evaluate(element => {
    const content = element.querySelector('.tvp-preview-bar__edit-content')
    const icon = content?.querySelector('.tvp-preview-bar__edit-icon')
    const text = content?.querySelector('span')
    const contentStyle = content ? getComputedStyle(content) : null
    const iconStyle = icon ? getComputedStyle(icon) : null
    const iconRect = icon?.getBoundingClientRect()
    const textRect = text?.getBoundingClientRect()
    return {
      display: contentStyle?.display,
      alignItems: contentStyle?.alignItems,
      gap: contentStyle?.gap,
      iconWidth: iconRect?.width ?? 0,
      iconHeight: iconRect?.height ?? 0,
      iconFlexShrink: iconStyle?.flexShrink,
      horizontalDistance: iconRect && textRect ? textRect.left - iconRect.right : -1,
      verticalCenterDelta: iconRect && textRect
        ? Math.abs((iconRect.top + iconRect.height / 2) - (textRect.top + textRect.height / 2))
        : -1,
    }
  })

  assert(['flex', 'inline-flex'].includes(metrics.display), `${adapter.name}: preview edit content should use flex or inline-flex`, metrics)
  assert(metrics.alignItems === 'center', `${adapter.name}: preview edit icon and text should be vertically centered`, metrics)
  assert(metrics.gap === '6px', `${adapter.name}: preview edit icon and text should use a 6px gap`, metrics)
  assert(metrics.iconWidth === 16 && metrics.iconHeight === 16, `${adapter.name}: preview edit icon should be 16px`, metrics)
  assert(metrics.iconFlexShrink === '0', `${adapter.name}: preview edit icon should not shrink`, metrics)
  assert(Math.abs(metrics.horizontalDistance - 6) <= 0.5, `${adapter.name}: rendered icon/text distance should be 6px`, metrics)
  assert(metrics.verticalCenterDelta <= 0.5, `${adapter.name}: rendered icon/text centers should align`, metrics)

  await page.screenshot({
    path: join(screenshotDir, `tvp-preview-edit-${adapter.name}.png`),
    fullPage: true,
  })
  return metrics
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  const metrics = []
  for (const adapter of adapters) {
    metrics.push({ name: adapter.name, ...await inspectAdapter(page, adapter) })
  }
  assert(errors.length === 0, 'Preview browser flow should not emit page errors', { errors })
  console.log(`preview edit alignment passed for ${adapters.map(adapter => adapter.name).join(', ')}`)
  console.log(JSON.stringify(metrics, null, 2))
} finally {
  await browser.close()
}
