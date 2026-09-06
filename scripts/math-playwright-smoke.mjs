import { chromium } from 'playwright'
import { ensurePlaygroundServer } from './lib/playground-server.mjs'

// 自包含 e2e:1) 演示公式渲染;2) 先弹层后插入:工具栏 ∑ → 空输入弹层 → 取消不落节点 → 重开 → 输入源码 → 预览 → 确认才插入
const basePlaygroundUrl = await ensurePlaygroundServer()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${basePlaygroundUrl.replace(/#.*$/, '')}#/element-plus`, { waitUntil: 'networkidle', timeout: 30000 })

const results = {}

// 1. 演示公式全部 ready
await page.locator('.tvp-math-node[data-render-status="ready"]').first().waitFor({ timeout: 30000 })
results.demoCount = await page.locator('.tvp-math-node[data-render-status="ready"]').count()
results.hasAligned = await page.locator('.katex-display .vlist').count() > 0
const demoTypes = await page.evaluate(() => Array.from(document.querySelectorAll('.tvp-math-node[data-type="math-block"]')).map(n => n.getAttribute('data-latex')?.slice(0, 30)))
results.blockDemos = demoTypes

// 2. compact 工具栏默认开,切 classic 找 ∑ 按钮
const compactToggle = page.locator('input[data-testid="compact-toolbar-toggle"]')
if (await compactToggle.isChecked()) await compactToggle.uncheck()
const mathBtn = page.locator('button[aria-label="公式"]')
await mathBtn.waitFor({ timeout: 15000 })
const countBefore = await page.locator('.tvp-math-node').count()
await mathBtn.click()

// 3. 弹层立即打开且预填默认公式(先弹层后插入)
const dialog = page.locator('.tvp-math-dialog-body')
await dialog.waitFor({ timeout: 5000 })
results.dialogAutoOpened = true
const textarea = page.locator('.tvp-math-dialog-body textarea')
results.dialogInitial = await textarea.inputValue()

// 4. 取消 → 文档不落任何节点
const cancelBtn = page.getByRole('button', { name: /取 消|取消/ }).first()
await cancelBtn.click()
await page.waitForTimeout(400)
results.cancelClean = (await page.locator('.tvp-math-node').count()) === countBefore

// 5. 重开 → 切「行内」→ 输入源码 → 确认插入行内公式
await mathBtn.click()
await dialog.waitFor({ timeout: 5000 })
const inlineCheck = page.locator('.tvp-math-dialog-inline input[type="checkbox"]')
await inlineCheck.check()
results.inlineToggled = await inlineCheck.isChecked()
await textarea.fill('k+1')
const confirmBtn = page.getByRole('button', { name: /确 定|确定/ }).first()
await confirmBtn.click()
await page.waitForTimeout(500)
results.inlineInserted = (await page.locator('.tvp-math-node[data-type="math-inline"]').count()) === 3

// 6. 重开 → 默认块级 → 输入源码 → 实时预览 → 确认插入块级公式
await mathBtn.click()
await dialog.waitFor({ timeout: 5000 })
results.defaultIsBlock = !(await page.locator('.tvp-math-dialog-inline input[type="checkbox"]').isChecked())
await textarea.fill('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')
await page.waitForTimeout(400) // 等实时预览
results.previewRendered = await page.locator('.tvp-math-dialog-preview .katex').count() > 0
await page.getByRole('button', { name: /确 定|确定/ }).first().click()
await page.waitForTimeout(500)
const latexList = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.tvp-math-node')).map(n => n.getAttribute('data-latex')))
results.writtenBack = latexList.some(l => (l ?? '').includes('b^2-4ac'))

console.log(JSON.stringify(results, null, 2))
await browser.close()
if (!(results.dialogAutoOpened && results.dialogInitial === 'E = mc^2' && results.cancelClean && results.inlineToggled && results.inlineInserted && results.defaultIsBlock && results.previewRendered && results.writtenBack && results.demoCount >= 5)) {
  console.error('E2E CHECK FAILED')
  process.exit(1)
}
console.log('E2E CHECK PASSED')
