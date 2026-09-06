#!/usr/bin/env node
/**
 * 发布后验证:以陌生消费者视角验证刚发布的版本在 npm registry 上真实可用。
 *
 * 流程(与 2026-09-06 对 0.2.5 的人工验证完全一致):
 *   1. registry 可见性:轮询 `npm view <pkg> version` 直到等于待验证版本;
 *   2. 在 /tmp 下的全新目录生成消费者工程——版本号从各包 manifest 与
 *      core devDependencies 动态派生(@tiptap 家族、三套 UI 库、vue),
 *      保证 tiptap 升级后验证器不漂移;
 *   3. pnpm install 后断言 node_modules 解析到的正是目标版本;
 *   4. vite build + vite preview,playwright 断言三套编辑器挂载、
 *      打字生效、零页面错误,截图存档。
 *
 * 用法:
 *   node scripts/verify-publish.mjs            # 验证 workspace manifest 中的版本
 *   node scripts/verify-publish.mjs --version 0.2.5   # 显式指定版本
 *
 * 退出码:0 = 全部通过;1 = 任一环节失败(日志含具体环节)。
 * playwright 取自仓库 node_modules,因此本脚本必须在仓库根目录运行。
 */
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const versionArgIdx = args.indexOf('--version')
const explicitVersion = versionArgIdx !== -1 ? args[versionArgIdx + 1] : null

const PKGS = ['core', 'element-plus', 'naive', 'ant-design-vue']
const CONSUMER_ROOT = '/tmp/tvp-publish-verify'
const PREVIEW_PORT = 4521
const REGISTRY_PROPAGATION_TIMEOUT_MS = 90_000

const fail = (msg) => {
  console.error(`[verify:FAIL] ${msg}`)
  process.exit(1)
}
const step = (msg) => console.log(`[verify] ${msg}`)

// ---- 收集待验证的包与版本 ----
const packages = PKGS.map((p) => {
  const dir = join(repoRoot, 'packages', p)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  return { name: manifest.name, version: explicitVersion ?? manifest.version }
})
const versionLabel = explicitVersion ?? packages[0].version
step(`目标版本 ${versionLabel}: ${packages.map((p) => p.name).join(', ')}`)

// ---- 1. registry 可见性 ----
step('等待 registry 可见…')
const registryDeadline = Date.now() + REGISTRY_PROPAGATION_TIMEOUT_MS
for (const { name, version } of packages) {
  for (;;) {
    let remote = null
    try {
      remote = execFileSync('npm', ['view', name, 'version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      /* 404 = 尚不可见 */
    }
    if (remote === version) break
    if (remote != null) fail(`${name} registry 版本为 ${remote},期望 ${version}`)
    if (Date.now() > registryDeadline) fail(`${name} 在 ${REGISTRY_PROPAGATION_TIMEOUT_MS}ms 内未出现在 registry`)
    await new Promise((r) => setTimeout(r, 5000))
  }
}
step('registry 全部可见')

// ---- 2. 生成消费者工程 ----
step(`生成消费者工程 ${CONSUMER_ROOT} …`)
rmSync(CONSUMER_ROOT, { recursive: true, force: true })
mkdirSync(join(CONSUMER_ROOT, 'src'), { recursive: true })

const coreManifest = JSON.parse(readFileSync(join(repoRoot, 'packages/core/package.json'), 'utf8'))
const coreDev = coreManifest.devDependencies
const deps = {
  vue: coreDev.vue,
  'tiptap-vue-pro-core': versionLabel,
  ...Object.fromEntries(packages.map((p) => [p.name, p.version])),
  // tiptap 家族是 core 的 peerDependencies,消费者必须自备;
  // 版本取 core devDependencies 的钉版,保持验证器与核心测试环境一致。
  ...Object.fromEntries(Object.entries(coreDev).filter(([k]) => k.startsWith('@tiptap/'))),
}
for (const p of ['element-plus', 'naive', 'ant-design-vue']) {
  const adapter = JSON.parse(readFileSync(join(repoRoot, `packages/${p}/package.json`), 'utf8'))
  const uiLib = p === 'element-plus' ? 'element-plus' : p === 'naive' ? 'naive-ui' : 'ant-design-vue'
  deps[uiLib] = adapter.devDependencies[uiLib]
}

writeFileSync(
  join(CONSUMER_ROOT, 'package.json'),
  JSON.stringify(
    {
      name: 'tvp-publish-verify',
      private: true,
      type: 'module',
      dependencies: deps,
      devDependencies: { vite: '^5.4.0', '@vitejs/plugin-vue': '^5.0.0' },
    },
    null,
    2,
  ),
)
writeFileSync(
  join(CONSUMER_ROOT, 'vite.config.js'),
  `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ plugins: [vue()] })\n`,
)
writeFileSync(
  join(CONSUMER_ROOT, 'index.html'),
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>publish verify</title></head>
<body style="margin:0;font-family:sans-serif;background:#f5f5f5">
<div id="ep"></div><div id="nv"></div><div id="ant"></div>
<script type="module" src="/src/main.js"></script></body></html>`,
)
writeFileSync(
  join(CONSUMER_ROOT, 'src/main.js'),
  `import { createApp, h, ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'
import 'tiptap-vue-pro-naive/style.css'
import 'tiptap-vue-pro-ant-design-vue/style.css'

const content = '<h2>publish verify</h2><p>从 npm 安装的 <strong>tiptap-vue-pro</strong> 三套适配器。</p><ul><li>表格</li><li>任务列表</li></ul>'
function mount(el, Editor) {
  const model = ref(content)
  createApp({ render: () => h('div', { style: 'padding:12px' }, [
    h(Editor, { modelValue: model.value, 'onUpdate:modelValue': (v) => (model.value = v) }),
  ]) }).mount(el)
}
mount('#ep', ProEditorElementPlus)
mount('#nv', ProEditorNaive)
mount('#ant', ProEditorAntDesignVue)
`,
)

// ---- 3. 安装并断言解析版本 ----
step('pnpm install(来自 registry)…')
run('pnpm', ['install', '--reporter=append-only'], CONSUMER_ROOT)
for (const { name, version } of packages) {
  const resolved = JSON.parse(
    readFileSync(join(CONSUMER_ROOT, 'node_modules', name, 'package.json'), 'utf8'),
  ).version
  if (resolved !== version) fail(`${name} node_modules 解析为 ${resolved},期望 ${version}`)
}
step('node_modules 解析版本全部正确')

// ---- 4. 构建 + 预览 + 浏览器冒烟 ----
step('vite build …')
run('npx', ['vite', 'build'], CONSUMER_ROOT)

step(`vite preview :${PREVIEW_PORT} …`)
const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
  cwd: CONSUMER_ROOT,
  stdio: 'ignore',
})
preview.unref()
process.once('exit', () => preview.kill('SIGTERM'))
const upDeadline = Date.now() + 30_000
for (;;) {
  if (preview.exitCode != null) fail(`vite preview 提前退出(code ${preview.exitCode})`)
  try {
    const res = await fetch(`http://localhost:${PREVIEW_PORT}/`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) break
  } catch {}
  if (Date.now() > upDeadline) fail('vite preview 未在 30s 内就绪')
  await new Promise((r) => setTimeout(r, 500))
}

step('playwright 冒烟:挂载 / 打字 / 页面错误 …')
const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1500, height: 1080 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
await page.goto(`http://localhost:${PREVIEW_PORT}/`, { waitUntil: 'networkidle', timeout: 30000 })

const results = {}
for (const [label, sel] of [
  ['element-plus', '#ep .ProseMirror'],
  ['naive', '#nv .ProseMirror'],
  ['ant-design-vue', '#ant .ProseMirror'],
]) {
  await page.locator(sel).first().waitFor({ state: 'visible', timeout: 15000 })
  const before = await page.locator(sel).first().innerHTML()
  await page.locator(sel).first().click()
  await page.keyboard.type('OK')
  const after = await page.locator(sel).first().innerHTML()
  results[label] = { mounted: true, typingWorks: after.length > before.length }
}
const shotPath = join(CONSUMER_ROOT, 'verify.png')
await page.screenshot({ path: shotPath, fullPage: true })
await browser.close()
preview.kill('SIGTERM')

for (const [label, r] of Object.entries(results)) {
  if (!r.typingWorks) fail(`${label} 编辑器打字未生效`)
}
if (pageErrors.length > 0) fail(`页面存在 ${pageErrors.length} 个未捕获错误: ${pageErrors[0]}`)

console.log('[verify:PASS] 三套适配器安装、构建、挂载、输入全部通过;截图:', shotPath)

// ---- 小工具 ----
function run(cmd, cmdArgs, cwd) {
  execFileSync(cmd, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
}
