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

async function gotoAdapter(page, adapter) {
  // The playground keeps its v-model content across hash-only navigation.
  // Reload the document so every adapter starts from the same Mermaid source.
  await page.goto('about:blank')
  await page.goto(adapterUrl(adapter), { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator(`${adapter.root} .tvp-mermaid-block`).first().waitFor({ timeout: 15000 })
  await page.locator(`${adapter.root} .tvp-mermaid-svg svg`).first().waitFor({ timeout: 30000 })
}

async function inspectAdapter(page, adapter) {
  console.log(`checking Mermaid browser flow for ${adapter.name}`)
  const block = page.locator(`${adapter.root} .tvp-mermaid-block`).first()
  const buttons = block.locator('.tvp-mermaid-mode-group button')
  const labels = await buttons.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))
  assert(labels.join('|') === '代码|图表|分屏', `${adapter.name}: view labels should match`, { labels })

  const metrics = await block.evaluate(element => {
    const toolbar = element.querySelector('.tvp-mermaid-toolbar')
    const code = element.querySelector('.tvp-mermaid-code-pane')
    const diagram = element.querySelector('.tvp-mermaid-diagram-pane')
    const modeGroup = element.querySelector('.tvp-mermaid-mode-group')
    const modeGroupRect = modeGroup?.getBoundingClientRect()
    const buttons = Array.from(element.querySelectorAll('.tvp-mermaid-mode-group button'))
    const buttonRects = buttons.map(button => button.getBoundingClientRect())
    const modeButtons = buttons.map((button) => {
      const iconWrap = button.querySelector('.tvp-mermaid-mode-icon-wrap')
      const icon = button.querySelector('.tvp-mermaid-mode-icon')
      const buttonRect = button.getBoundingClientRect()
      const wrapRect = iconWrap?.getBoundingClientRect()
      const wrapStyle = iconWrap ? getComputedStyle(iconWrap) : null
      const iconStyle = icon ? getComputedStyle(icon) : null
      const iconRect = icon?.getBoundingClientRect()

      return {
        label: button.getAttribute('aria-label'),
        buttonWidth: buttonRect.width,
        buttonHeight: buttonRect.height,
        wrapDisplay: wrapStyle?.display,
        wrapAlignItems: wrapStyle?.alignItems,
        wrapJustifyContent: wrapStyle?.justifyContent,
        iconWidth: iconRect?.width ?? 0,
        iconHeight: iconRect?.height ?? 0,
        iconFlexShrink: iconStyle?.flexShrink,
        iconTransform: iconStyle?.transform,
        horizontalCenterDelta: iconRect
          ? Math.abs((iconRect.left + iconRect.width / 2) - (buttonRect.left + buttonRect.width / 2))
          : null,
        verticalCenterDelta: wrapRect
          ? Math.abs((wrapRect.top + wrapRect.height / 2) - (buttonRect.top + buttonRect.height / 2))
          : null,
      }
    })
    return {
      toolbarHeight: toolbar?.getBoundingClientRect().height ?? 0,
      modeGroupInsets: modeGroupRect && buttonRects.length > 0 ? {
        top: buttonRects[0].top - modeGroupRect.top,
        right: modeGroupRect.right - buttonRects.at(-1).right,
        bottom: modeGroupRect.bottom - buttonRects[0].bottom,
        left: buttonRects[0].left - modeGroupRect.left,
      } : null,
      modeButtons,
      codeWidth: code?.getBoundingClientRect().width ?? 0,
      diagramWidth: diagram?.getBoundingClientRect().width ?? 0,
    }
  })
  assert(metrics.toolbarHeight >= 43 && metrics.toolbarHeight <= 46, `${adapter.name}: block toolbar height should be 44px`, metrics)
  assert(metrics.modeButtons.length === 3, `${adapter.name}: all three mode buttons should be measurable`, metrics)
  assert(
    metrics.modeGroupInsets
      && Object.values(metrics.modeGroupInsets).every(inset => Math.abs(inset) <= 0.5),
    `${adapter.name}: native button group should not add an uneven outer tray`,
    metrics.modeGroupInsets,
  )
  for (const modeButton of metrics.modeButtons) {
    assert(
      modeButton.buttonWidth === 28
        && modeButton.buttonHeight === 28
        && ['flex', 'inline-flex'].includes(modeButton.wrapDisplay)
        && modeButton.wrapAlignItems === 'center'
        && modeButton.wrapJustifyContent === 'center'
        && modeButton.iconWidth === 14
        && modeButton.iconHeight === 14
        && modeButton.iconFlexShrink === '0'
        && modeButton.iconTransform === 'matrix(1, 0, 0, 1, 0, 1)'
        && modeButton.horizontalCenterDelta !== null
        && modeButton.horizontalCenterDelta <= 0.5
        && modeButton.verticalCenterDelta !== null
        && modeButton.verticalCenterDelta <= 0.5,
      `${adapter.name}: ${modeButton.label} should be a centered 28px icon button`,
      modeButton,
    )
  }
  assert(Math.abs(metrics.codeWidth - metrics.diagramWidth) <= 2, `${adapter.name}: split panes should be equal width`, metrics)

  await buttons.nth(1).click()
  assert(await block.getAttribute('data-view-mode') === 'diagram', `${adapter.name}: diagram mode should persist on the node`)
  assert(await block.locator('.tvp-mermaid-code-pane').count() === 0, `${adapter.name}: diagram mode should hide code`)

  await block.locator('.tvp-mermaid-diagram-pane').dblclick()
  await block.locator('.cm-content').waitFor({ timeout: 15000 })
  assert(
    await block.locator('.cm-content').getAttribute('aria-label') === 'Mermaid 源码',
    `${adapter.name}: source editor should expose its localized accessible label`,
  )
  await page.waitForFunction(root => {
    const block = document.querySelector(`${root} .tvp-mermaid-block`)
    return block?.getAttribute('data-view-mode') === 'split' && block.contains(document.activeElement)
  }, adapter.root, { timeout: 15000 })

  await buttons.nth(0).click()
  assert(await block.getAttribute('data-view-mode') === 'code', `${adapter.name}: code mode should persist on the node`)
  assert(await block.locator('.tvp-mermaid-diagram-pane').count() === 0, `${adapter.name}: code mode should hide diagram`)

  await buttons.nth(2).click()
  await block.locator('.cm-content').waitFor({ timeout: 15000 })
  await block.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText('flowchart LR\n  X[Alpha] --> Y[Omega]')
  await page.waitForFunction(root => {
    const diagram = document.querySelector(`${root} .tvp-mermaid-diagram-pane`)
    return diagram?.getAttribute('data-render-status') === 'ready' && diagram.textContent?.includes('Omega')
  }, adapter.root, { timeout: 15000 })

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')
  await page.waitForFunction(root => {
    const source = document.querySelector(`${root} .cm-content`)
    return !source?.textContent?.includes('Omega')
  }, adapter.root)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z')
  await page.waitForFunction(root => document.querySelector(`${root} .cm-content`)?.textContent?.includes('Omega'), adapter.root)

  await block.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText('flowchart TD\n  A[broken')
  await block.locator('.tvp-mermaid-error').waitFor({ timeout: 15000 })
  assert(await block.locator('.tvp-mermaid-svg svg').count() === 1, `${adapter.name}: invalid source should preserve the last valid SVG`)
  assert(await page.locator('[id^="dtvp-mermaid-"]').count() === 0, `${adapter.name}: invalid source should not leak Mermaid error SVGs into the page`)

  await block.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText('flowchart LR\n  X[Alpha] --> Y[Omega]')
  await page.waitForFunction(root => {
    const block = document.querySelector(`${root} .tvp-mermaid-block`)
    const diagram = block?.querySelector('.tvp-mermaid-diagram-pane')
    return diagram?.getAttribute('data-render-status') === 'ready' && diagram.textContent?.includes('Omega')
  }, adapter.root, { timeout: 15000 })

  await block.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await page.waitForFunction(root => document.querySelector(`${root} .tvp-mermaid-diagram-pane`)?.getAttribute('data-render-status') === 'idle', adapter.root)
  assert(await block.locator('.tvp-mermaid-svg svg').count() === 0, `${adapter.name}: empty source should clear the cached SVG`)
  await page.keyboard.insertText('flowchart LR\n  X[Alpha] --> Y[Omega]')
  await page.waitForFunction(root => document.querySelector(`${root} .tvp-mermaid-diagram-pane`)?.getAttribute('data-render-status') === 'ready', adapter.root, { timeout: 15000 })

  const darkToggle = page.locator('.demo-toolbar .control--switch input').first()
  await darkToggle.check()
  await page.waitForFunction(root => document.querySelector(`${root} .tvp-mermaid-block`)?.classList.contains('is-dark'), adapter.root)
  await page.waitForFunction(root => document.querySelector(`${root} .tvp-mermaid-diagram-pane`)?.getAttribute('data-render-status') === 'ready', adapter.root, { timeout: 15000 })
  const darkIconColors = await block.evaluate(element => Array.from(
    element.querySelectorAll('.tvp-mermaid-title, .tvp-mermaid-mode-icon-wrap'),
  ).map(label => ({
    label: getComputedStyle(label).color,
    icon: label.querySelector('svg') ? getComputedStyle(label.querySelector('svg')).color : '',
  })))
  assert(darkIconColors.every(pair => pair.label === pair.icon), `${adapter.name}: dark mode icons should inherit their label color`, darkIconColors)

  const readonlyToggle = page.locator('.demo-toolbar .control--switch input').nth(1)
  await readonlyToggle.check()
  assert(await block.locator('.tvp-mermaid-toolbar').count() === 0, `${adapter.name}: readonly should hide Mermaid controls`)
  assert(await block.locator('.cm-content').getAttribute('contenteditable') === 'false', `${adapter.name}: readonly should lock CodeMirror`)
  await readonlyToggle.uncheck()
  await darkToggle.uncheck()
  await page.waitForFunction(root => {
    const block = document.querySelector(`${root} .tvp-mermaid-block`)
    return !block?.classList.contains('is-dark') && block?.querySelector('.tvp-mermaid-diagram-pane')?.getAttribute('data-render-status') === 'ready'
  }, adapter.root, { timeout: 15000 })

  await page.screenshot({
    path: join(screenshotDir, `tvp-mermaid-${adapter.name}.png`),
    fullPage: true,
  })
  return metrics
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  const metrics = []
  for (const adapter of adapters) {
    await gotoAdapter(page, adapter)
    metrics.push({ name: adapter.name, ...await inspectAdapter(page, adapter) })
  }

  const heights = metrics.map(item => item.toolbarHeight)
  assert(Math.max(...heights) - Math.min(...heights) <= 1, 'adapter toolbar heights should match', metrics)

  await page.setViewportSize({ width: 390, height: 844 })
  await gotoAdapter(page, adapters[0])
  const mobile = await page.locator(`${adapters[0].root} .tvp-mermaid-block`).first().evaluate(element => {
    const code = element.querySelector('.tvp-mermaid-code-pane')?.getBoundingClientRect()
    const diagram = element.querySelector('.tvp-mermaid-diagram-pane')?.getBoundingClientRect()
    const toolbar = element.querySelector('.tvp-mermaid-toolbar')?.getBoundingClientRect()
    const modeGroup = element.querySelector('.tvp-mermaid-mode-group')?.getBoundingClientRect()
    const modeButtonWidths = Array.from(element.querySelectorAll('.tvp-mermaid-mode-group button'))
      .map(button => button.getBoundingClientRect().width)
    return {
      stacked: Boolean(code && diagram && diagram.top >= code.bottom - 1),
      compactModeButtons: modeButtonWidths.every(width => width === 28),
      toolbarSingleRow: Boolean(toolbar && modeGroup && modeGroup.top >= toolbar.top && modeGroup.bottom <= toolbar.bottom),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
  assert(mobile.stacked, 'mobile split mode should stack code above diagram', mobile)
  assert(mobile.compactModeButtons, 'mobile mode buttons should stay compact', mobile)
  assert(mobile.toolbarSingleRow, 'mobile Mermaid toolbar should stay on one row', mobile)
  assert(mobile.scrollWidth <= mobile.clientWidth, 'mobile layout should not overflow horizontally', mobile)
  await page.screenshot({ path: join(screenshotDir, 'tvp-mermaid-mobile.png'), fullPage: true })

  assert(errors.length === 0, 'Mermaid browser flow should not emit page errors', { errors })
  console.log(`mermaid smoke passed for ${adapters.map(adapter => adapter.name).join(', ')}`)
  console.log(JSON.stringify({ metrics, mobile }, null, 2))
} finally {
  await browser.close()
}
