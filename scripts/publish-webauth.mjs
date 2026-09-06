#!/usr/bin/env node
/**
 * npm 12 网页认证发布(Security Key / WebAuthn 账号专用)。
 *
 * 背景(2026-09 实证):账号使用 Security Key 时,`changeset publish`(npm 10)
 * 的发布链路只会报 EOTP 死路——npm 10 只支持 TOTP,不支持 WebAuthn 挑战;
 * npm 12 原生支持发布网页认证:在 TTY 下打印 npmjs.com/auth/cli/... 链接,
 * 浏览器完成安全钥匙验证后,发布自动继续。
 *
 * 本脚本封装完整流程,按 core → 适配器顺序逐包发布:
 *   1. 临时把包内 `workspace:^` 依赖改写为 `^<当前版本>`(发布 tarball 需要,
 *      与 changeset publish 的行为一致),结束后用 git 还原 manifest;
 *   2. 在伪 TTY(macOS script)中运行 `npx -y npm@12 publish --access public`,
 *      轮询输出捕获认证链接并自动打开浏览器;
 *   3. registry 已存在同版本时自动跳过,可安全重复执行。
 *
 * 用法:node scripts/publish-webauth.mjs [package-dir ...]
 * 不带参数时发布 packages/ 下全部四包。
 */
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const NPM_VERSION = '12'
const PKG_ORDER = ['core', 'element-plus', 'naive', 'ant-design-vue']
const repoRoot = join(new URL(import.meta.url).pathname, '..', '..')

const dirs =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : PKG_ORDER.map((p) => join(repoRoot, 'packages', p))

function publishedVersion(name) {
  try {
    return execFileSync('npm', ['view', name, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null // registry 上不存在(首发或网络外的 404)
  }
}

function publishWithWebAuth(pkgDir) {
  return new Promise((resolve, reject) => {
    // 伪 TTY:npm 12 在非交互环境下打印认证链接后会立即退出,
    // macOS 的 script 让进程持有 TTY,从而保持轮询等待浏览器授权。
    const child = spawn(
      '/usr/bin/script',
      ['-q', '/dev/null', 'npx', '-y', `npm@${NPM_VERSION}`, 'publish', '--access', 'public'],
      { cwd: pkgDir, env: process.env },
    )
    let buffer = ''
    let opened = false
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      process.stdout.write(chunk)
      const match = buffer.match(/https:\/\/www\.npmjs\.com\/auth\/cli\/[a-zA-Z0-9._-]+/)
      if (match && !opened) {
        opened = true
        console.log(`\n[publish-webauth] 打开认证链接,请完成 Security Key 验证: ${match[0]}\n`)
        try {
          execFileSync('open', [match[0]])
        } catch {
          console.log(`[publish-webauth] 自动打开失败,请手动访问上面的链接`)
        }
      }
    })
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npm publish exited with ${code}`))))
    child.on('error', reject)
  })
}

let failed = false
for (const pkgDir of dirs) {
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const { name, version } = manifest
  const remote = publishedVersion(name)

  if (remote === version) {
    console.log(`[skip] ${name}@${version} 已在 registry`)
    continue
  }
  console.log(`[publish] ${name}@${version}${remote ? `(registry 当前 ${remote})` : '(新包)'}`)

  const raw = readFileSync(join(pkgDir, 'package.json'), 'utf8')
  const usesWorkspace = raw.includes('"workspace:^"')
  if (usesWorkspace) {
    // 与 changeset publish 相同的语义:workspace:^ → ^<自身版本>
    execFileSync('sed', ['-i', '', 's/"workspace:\\^"/"^' + version + '"/g', join(pkgDir, 'package.json')])
  }

  try {
    await publishWithWebAuth(pkgDir)
    console.log(`[ok] ${name}@${version} 发布成功`)
  } catch (error) {
    console.error(`[fail] ${name}@${version}: ${error.message}`)
    failed = true
  } finally {
    if (usesWorkspace) {
      try {
        execFileSync('git', ['checkout', '--', 'package.json'], { cwd: pkgDir })
      } catch {
        console.error(`[warn] ${pkgDir}/package.json 未能自动还原,请检查 git diff`)
      }
    }
  }
}

if (failed) {
  console.error('\n存在发布失败的包,请根据上方日志处理后重跑(已成功的包会自动跳过)。')
  process.exit(1)
}
console.log('\n全部完成。')

// 发布成功后自动执行消费者视角验证(registry 可见性 + 全新安装 + 浏览器冒烟),
// 失败时以非零码退出,让"发布成功但不可用"无法静默溜过。
console.log('\n[publish-webauth] 自动执行发布后验证…')
const verify = spawn('node', [join(repoRoot, 'scripts', 'verify-publish.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
})
verify.on('exit', (code) => process.exit(code ?? 1))
