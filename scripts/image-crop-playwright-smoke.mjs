import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

async function createTestPng() {
  const dir = await mkdtemp(join(tmpdir(), 'tiptap-image-crop-'))
  const filePath = join(dir, 'wide-test-image.png')
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWElEQVR4nO3PQQ3AIADAQEAsaZVNgxx28HtttkpXKlnPrw3wXHF/uwN8NcAWYAswBZgCzB28A3wHX2AY7vVxtdfRGf1HPA2YAswBZgCzAFuALcAWYAswBZgCTJ0DH2P2KXv+AAAAAElFTkSuQmCC'
  await writeFile(filePath, Buffer.from(pngBase64, 'base64'))
  return { dir, filePath }
}

async function gotoAdapter(page, adapter) {
  await page.goto(adapterUrl(adapter), { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForSelector(`${adapter.root} .ProseMirror`, { timeout: 10000 })
}

async function selectImageFile(page, adapter, imagePath) {
  await page.locator(`${adapter.root} input[type="file"][accept="image/*"]`).first().setInputFiles(imagePath)
}

async function waitForCropDialog(page) {
  await page.getByText('裁剪图片').waitFor({ state: 'visible', timeout: 5000 })
  await waitForActiveCropPreview(page)
}

function activeCropPreviewScript() {
  const previews = Array.from(document.querySelectorAll('.tvp-image-crop__preview'))
  const candidates = previews
    .map((el, index) => {
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const visible = box.width > 0 &&
        box.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      return {
        index,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        area: box.width * box.height,
        visible,
      }
    })
    .filter((candidate) => candidate.visible)
    .sort((a, b) => b.area - a.area)
  return candidates[0] ?? null
}

async function waitForActiveCropPreview(page, minWidth = 1, minHeight = 1) {
  await page.waitForFunction(
    ({ minWidth, minHeight }) => {
      const previews = Array.from(document.querySelectorAll('.tvp-image-crop__preview'))
      return previews.some((el) => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return box.width >= minWidth &&
          box.height >= minHeight &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
      })
    },
    { minWidth, minHeight },
    { timeout: 5000 },
  )
}

async function activeCropPreviewBox(page) {
  return page.evaluate(activeCropPreviewScript)
}

async function activeCropImageTransform(page) {
  return page.evaluate(() => {
    const previews = Array.from(document.querySelectorAll('.tvp-image-crop__preview'))
    const candidates = previews
      .map((el) => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const visible = box.width > 0 &&
          box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        return { el, area: box.width * box.height, visible }
      })
      .filter((candidate) => candidate.visible)
      .sort((a, b) => b.area - a.area)
    const image = candidates[0]?.el.querySelector('img')
    return image ? getComputedStyle(image).transform : null
  })
}

async function waitForCropDialogClosed(page) {
  await page.waitForFunction(() => {
    const previews = Array.from(document.querySelectorAll('.tvp-image-crop__preview'))
    return previews.every((el) => {
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return box.width === 0 ||
        box.height === 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden'
    })
  }, null, { timeout: 5000 })
}

async function currentEditorImageCount(page, adapter) {
  return page.locator(`${adapter.root} .ProseMirror img`).count()
}

async function assertCropPreview(page, adapter) {
  await waitForActiveCropPreview(page, 160, 80)
  const box = await activeCropPreviewBox(page)
  assert(box, `${adapter.name}: crop preview should have a bounding box`)
  assert(box.width > 160 && box.height > 80, `${adapter.name}: crop preview should be visible`, box)
  const ratio = box.width / box.height
  assert(Math.abs(ratio - (16 / 9)) < 0.08, `${adapter.name}: crop preview should use 16:9 ratio`, {
    width: box.width,
    height: box.height,
    ratio,
  })
}

async function assertMaskClickDoesNotCloseCropDialog(page, adapter) {
  await page.mouse.click(12, 12)
  await page.waitForTimeout(200)
  const visible = await activeCropPreviewBox(page)
  assert(visible, `${adapter.name}: clicking the blank mask should not close crop dialog`)
}

async function assertZoomControlChangesPreview(page, adapter) {
  const slider = page.locator('[role="slider"]').last()
  await slider.focus()
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('ArrowRight')
  }
  await page.waitForFunction(() => {
    const previews = Array.from(document.querySelectorAll('.tvp-image-crop__preview'))
    const candidates = previews
      .map((el) => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const visible = box.width > 0 &&
          box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        return { el, area: box.width * box.height, visible }
      })
      .filter((candidate) => candidate.visible)
      .sort((a, b) => b.area - a.area)
    const imageEl = candidates[0]?.el.querySelector('img')
    return imageEl ? getComputedStyle(imageEl).transform !== 'none' : false
  })
  const transform = await activeCropImageTransform(page)
  assert(transform !== 'none', `${adapter.name}: zoom control should update crop preview transform`, {
    transform,
  })
}

async function assertDraggingMovesZoomedPreview(page, adapter) {
  const before = await activeCropImageTransform(page)
  const box = await activeCropPreviewBox(page)
  assert(box, `${adapter.name}: crop preview should have a bounding box before dragging`)

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 72, box.y + box.height / 2 - 24, { steps: 8 })
  await page.mouse.up()

  await page.waitForFunction((previousTransform) => {
    const previews = Array.from(document.querySelectorAll('.tvp-image-crop__preview'))
    const candidates = previews
      .map((el) => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const visible = box.width > 0 &&
          box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        return { el, area: box.width * box.height, visible }
      })
      .filter((candidate) => candidate.visible)
      .sort((a, b) => b.area - a.area)
    const imageEl = candidates[0]?.el.querySelector('img')
    return imageEl ? getComputedStyle(imageEl).transform !== previousTransform : false
  }, before)
  const after = await activeCropImageTransform(page)
  assert(after !== before, `${adapter.name}: dragging zoomed crop preview should move the image`, {
    before,
    after,
  })

  await page.mouse.move(box.x + box.width / 2 - 96, box.y + box.height / 2 + 64, { steps: 8 })
  await page.waitForTimeout(100)
  const afterReleaseMove = await activeCropImageTransform(page)
  assert(
    afterReleaseMove === after,
    `${adapter.name}: crop preview should stop dragging after pointer release`,
    {
      after,
      afterReleaseMove,
    },
  )
}

async function assertSkipCrop(page, adapter, imagePath) {
  await gotoAdapter(page, adapter)
  const before = await currentEditorImageCount(page, adapter)
  await selectImageFile(page, adapter, imagePath)
  await waitForCropDialog(page)
  await assertCropPreview(page, adapter)
  await assertMaskClickDoesNotCloseCropDialog(page, adapter)
  await assertZoomControlChangesPreview(page, adapter)
  await assertDraggingMovesZoomedPreview(page, adapter)
  await page.getByRole('button', { name: '跳过裁剪' }).click()
  await page.waitForFunction(({ root, beforeCount }) => {
    return document.querySelectorAll(`${root} .ProseMirror img`).length > beforeCount
  }, { root: adapter.root, beforeCount: before })
  await waitForCropDialogClosed(page)
}

async function assertConfirmCrop(page, adapter, imagePath) {
  await gotoAdapter(page, adapter)
  const before = await currentEditorImageCount(page, adapter)
  await selectImageFile(page, adapter, imagePath)
  await waitForCropDialog(page)
  await assertCropPreview(page, adapter)
  await page.getByText('缩放', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await page.getByRole('button', { name: '裁剪并上传' }).click()
  await page.waitForFunction(({ root, beforeCount }) => {
    return document.querySelectorAll(`${root} .ProseMirror img`).length > beforeCount
  }, { root: adapter.root, beforeCount: before })
  await waitForCropDialogClosed(page)
}

const { dir, filePath } = await createTestPng()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})

try {
  for (const adapter of adapters) {
    await assertSkipCrop(page, adapter, filePath)
    await assertConfirmCrop(page, adapter, filePath)
  }
  assert(errors.length === 0, 'image crop smoke should not emit page errors', { errors })
  console.log(`image-crop smoke passed for ${adapters.map((adapter) => adapter.name).join(', ')}`)
} finally {
  await browser.close()
  await rm(dir, { recursive: true, force: true })
}
