import { chromium } from 'playwright'
import { ensurePlaygroundServer } from './lib/playground-server.mjs'

// 自包含 e2e:表格行/列抓手与表格的几何对齐。
// 覆盖两个相位:① 正常布局;② 宿主把编辑器包在 contain: layout paint 容器里
// (fixed 包含块祖先)——引擎必须把视口坐标换算到该包含块,抓手仍对齐。
// 回归背景:playground 曾给 .editor-stage 加 contain: layout paint,抓手整体
// 偏移宿主布局偏移量(测量视口坐标、渲染却相对包含块)。
const basePlaygroundUrl = await ensurePlaygroundServer()
const adapters = [
  { name: 'element-plus', hash: '#/element-plus' },
  { name: 'naive', hash: '#/naive' },
  { name: 'ant-design-vue', hash: '#/ant-design-vue' },
]

const GRIP_SIZE = 22
const GRIP_GAP = -3
const TOLERANCE = 2

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}\n${JSON.stringify(detail, null, 2)}`)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

async function hoverRow(rowIndex) {
  const cell = page.locator('.tvp-content table tbody tr').nth(rowIndex).locator('td, th').first()
  await cell.hover()
  await page.locator('.tvp-table-grip--row').first().waitFor({ timeout: 5000 })
  await page.waitForTimeout(200)
}

async function measure() {
  return page.evaluate(() => {
    const table = document.querySelector('.tvp-content table')
    const trs = Array.from(table.querySelectorAll('tr'))
    const rowGrips = Array.from(document.querySelectorAll('.tvp-table-grip--row'))
    const colGrips = Array.from(document.querySelectorAll('.tvp-table-grip--col'))
    const firstRowCells = Array.from(trs[0].querySelectorAll('th, td'))
    const tableRect = table.getBoundingClientRect()
    return {
      table: { left: tableRect.left, top: tableRect.top },
      rowDeltas: rowGrips.map((g, i) => {
        const gr = g.getBoundingClientRect()
        const tr = trs[i]?.getBoundingClientRect()
        return { left: Math.round(gr.left - tableRect.left), top: Math.round(gr.top - (tr?.top ?? 0)) }
      }),
      colDeltas: colGrips.map((g, i) => {
        const gr = g.getBoundingClientRect()
        const cell = firstRowCells[i]?.getBoundingClientRect()
        return {
          left: Math.round(gr.left - (cell?.left ?? 0)),
          bottom: Math.round(gr.bottom - tableRect.top),
        }
      }),
    }
  })
}

async function checkAlignment(adapter, phase) {
  const m = await measure()
  const expectedLeft = -GRIP_SIZE - GRIP_GAP // 行抓手左缘相对表格左缘
  const expectedBottom = -GRIP_GAP // 列抓手底缘相对表格上缘(伸入表格 3px)
  for (const [i, d] of m.rowDeltas.entries()) {
    assert(
      Math.abs(d.left - expectedLeft) <= TOLERANCE && Math.abs(d.top) <= TOLERANCE,
      `${adapter.name} ${phase}: 行抓手 #${i} 偏移 (left=${d.left}, top=${d.top}),期望 left≈${expectedLeft}, top≈0`,
      m,
    )
  }
  for (const [i, d] of m.colDeltas.entries()) {
    assert(
      Math.abs(d.left) <= TOLERANCE && Math.abs(d.bottom - expectedBottom) <= TOLERANCE,
      `${adapter.name} ${phase}: 列抓手 #${i} 偏移 (left=${d.left}, bottom=${d.bottom}),期望 left≈0, bottom≈${expectedBottom}`,
      m
    )
  }
  console.log(`  [${adapter.name}] ${phase}: 行×${m.rowDeltas.length} 列×${m.colDeltas.length} 对齐通过`)
}

for (const adapter of adapters) {
  await page.goto(`${basePlaygroundUrl.replace(/#.*$/, '')}${adapter.hash}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('.tvp-content table').first().waitFor({ timeout: 15000 })

  // 相位一:正常布局(playground 舞台无 fixed 包含块祖先)
  await hoverRow(1)
  await checkAlignment(adapter, '正常布局')

  // 相位二:注入 contain: layout paint,重现 fixed 包含块祖先条件,
  // 引擎的坐标换算应让抓手保持对齐
  await page.addStyleTag({ content: '.editor-stage { contain: layout paint !important; }' })
  await page.mouse.move(10, 10)
  await hoverRow(1)
  await checkAlignment(adapter, 'contain 包含块')
  await page.evaluate(() => document.querySelectorAll('style[data-grip-probe]').forEach(n => n.remove()))
}

await browser.close()
console.log('table grip alignment smoke: all adapters passed')
