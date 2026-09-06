/**
 * 把 KaTeX 的 CSS 与 woff2 字体拷贝进 adapter 的 dist/。
 *
 * 背景:vite lib 模式会把 CSS 引用的资源强制 base64 内联(assetsInlineLimit 不生效),
 * 直接在 adapter 里 import 'katex/dist/katex.min.css' 会把全部 60 个字体文件
 * (~1.1MB,三格式)打进 style.css,页面加载成本过高。
 * 改为随包附带 dist/katex.css + dist/katex-fonts/(仅 woff2,现代浏览器全覆盖),
 * 宿主额外引入一行 `import 'xxx-adapter/katex.css'` 即可,字体由浏览器按需加载。
 *
 * 在 adapter 目录下执行(由各 adapter 的 build script 调用):
 *   node ../../scripts/copy-katex-assets.mjs
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const adapterDir = process.cwd()
const requireFromAdapter = createRequire(join(adapterDir, 'package.json'))

const katexPackageJson = requireFromAdapter.resolve('katex/package.json')
const katexDist = join(dirname(katexPackageJson), 'dist')

let css = readFileSync(join(katexDist, 'katex.min.css'), 'utf8')

// 只保留 woff2 源,剥离 woff/ttf(woff2 现代浏览器全覆盖,包体缩到 1/3)
const before = css.length
css = css.replace(
  /,url\((fonts\/[^)]+?\.(?:woff|ttf))\)\s*format\("(?:woff|truetype)"\)/g,
  '',
)
css = css.replace(/url\(fonts\//g, 'url(katex-fonts/')

const outDir = join(adapterDir, 'dist')
const fontsDir = join(outDir, 'katex-fonts')
mkdirSync(fontsDir, { recursive: true })

let copied = 0
for (const file of readdirSync(join(katexDist, 'fonts'))) {
  if (!file.endsWith('.woff2')) continue
  copyFileSync(join(katexDist, 'fonts', file), join(fontsDir, file))
  copied += 1
}

writeFileSync(join(outDir, 'katex.css'), css)

if (css.length >= before || copied === 0) {
  console.error(`[copy-katex-assets] unexpected katex css layout (fonts copied: ${copied})`)
  process.exit(1)
}
console.log(`[copy-katex-assets] dist/katex.css + ${copied} woff2 fonts`)
