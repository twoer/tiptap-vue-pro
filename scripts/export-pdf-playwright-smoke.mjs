import { chromium } from 'playwright'
import { ensurePlaygroundServer } from './lib/playground-server.mjs'
import { join, resolve } from 'node:path'

// 自包含 e2e:验证打印按钮走管线且导出语义生效(Mermaid 源码在打印文档中被内联为渲染后的 SVG,
// @page 规则与正文内容保留)。打印对话框无法自动化,这里断言 printEditorContent 生成的 iframe srcdoc。
// 打印对话框无法自动化,这里断言 printEditorContent 生成的 iframe srcdoc 内容。
const basePlaygroundUrl = await ensurePlaygroundServer()
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
  await page.goto('about:blank')
  await page.goto(adapterUrl(adapter), { waitUntil: 'networkidle', timeout: 30000 })
  // 等 Mermaid 首图渲染完成,保证点击导出时 mermaid 模块已加载,内联渲染走热路径
  await page.locator(`${adapter.root} .tvp-mermaid-svg svg`).first().waitFor({ timeout: 30000 })
  // 等公式 NodeView 渲染完成(KaTeX 动态加载完毕),打印替换走热路径
  await page.locator(`${adapter.root} .tvp-math-node[data-render-status="ready"]`).first().waitFor({ timeout: 30000 })
  // basic 场景默认 compact 布局,打印收在「更多」菜单里;切回 classic 直接点顶层打印按钮
  const compactToggle = page.locator('input[data-testid="compact-toolbar-toggle"]')
  if (await compactToggle.isChecked()) await compactToggle.uncheck()
  await page.locator(`${adapter.root} button[aria-label="打印 / 导出 PDF"]`).waitFor({ timeout: 15000 })
}

async function inspectAdapter(page, adapter) {
  console.log(`checking export-pdf flow for ${adapter.name}`)
  // 清掉可能的旧打印 iframe,避免断言命中历史文档
  await page.evaluate(() => {
    document.querySelectorAll('iframe[srcdoc]').forEach(iframe => iframe.remove())
  })

  await page.locator(`${adapter.root} button[aria-label="打印 / 导出 PDF"]`).click()

  // 打印 iframe 在 Mermaid 内联完成后创建;onload 后约 500ms 被回收,srcdoc 属性全程可读
  await page.waitForFunction(
    () => Boolean(document.querySelector('iframe[srcdoc*="tvp-print-mermaid"]')),
    { timeout: 20000 },
  )

  const doc = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[srcdoc]')
    const srcdoc = iframe?.getAttribute('srcdoc') ?? ''
    return {
      hasFigure: srcdoc.includes('class="tvp-print-mermaid"'),
      hasSvg: /<figure class="tvp-print-mermaid">[\s\S]*?<svg/.test(srcdoc),
      noSourceBlock: !srcdoc.includes('data-type="mermaid-block"'),
      hasPageRule: srcdoc.includes('@page{size:A4;margin:18mm 16mm}'),
      keepsTaskList: srcdoc.includes('ul data-type="taskList"'),
      keepsParagraphs: srcdoc.includes('<p'),
      escapedTitleOk: srcdoc.includes('<title>'),
      hasMathml: srcdoc.includes('<math'),
      noKatexHtml: !srcdoc.includes('katex-html'),
      keepsMathSource: srcdoc.includes('data-type="math-block"'),
    }
  })

  assert(doc.hasFigure, `${adapter.name}: print doc should inline mermaid as figure`, doc)
  assert(doc.hasSvg, `${adapter.name}: mermaid figure should contain rendered svg`, doc)
  assert(doc.noSourceBlock, `${adapter.name}: mermaid source block should be replaced`, doc)
  assert(doc.hasPageRule, `${adapter.name}: print doc should declare @page A4`, doc)
  assert(doc.keepsTaskList, `${adapter.name}: task list should survive into print doc`, doc)
  assert(doc.keepsParagraphs, `${adapter.name}: paragraphs should survive into print doc`, doc)
  assert(doc.escapedTitleOk, `${adapter.name}: print doc should keep a title element`, doc)
  assert(doc.hasMathml, `${adapter.name}: math formulas should be inlined as native MathML`, doc)
  assert(doc.noKatexHtml, `${adapter.name}: print doc should not depend on KaTeX screen HTML`, doc)
  assert(doc.keepsMathSource, `${adapter.name}: math wrapper should keep its source attribute`, doc)

  await page.screenshot({
    path: join(screenshotDir, `tvp-export-pdf-${adapter.name}.png`),
    fullPage: true,
  })
  return doc
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  for (const adapter of adapters) {
    await gotoAdapter(page, adapter)
    await inspectAdapter(page, adapter)
  }

  assert(errors.length === 0, 'print/export-pdf flow should not emit page errors', { errors })
  console.log(`export-pdf smoke passed for ${adapters.map(adapter => adapter.name).join(', ')}`)
} finally {
  await browser.close()
}
