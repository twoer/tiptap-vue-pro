#!/usr/bin/env node
/**
 * CI 内发布四包,走 npm 受信发布(OIDC)——零 token、零 2FA。
 *
 * 前提(见 .github/workflows/release.yml 与 AGENTS.md「npm 发布与撤回认证规则」):
 *   - 在 GitHub Actions 的 GitHub 托管 runner 上运行,workflow 声明
 *     `permissions: id-token: write`,且 setup-node 配了 registry-url;
 *   - npm CLI ≥ 11.5.1(workflow 已 npm install -g npm@latest);
 *   - npmjs.com 上四个包各自配置了 trusted publisher,workflow 文件名逐字一致。
 *
 * 与 publish-webauth.mjs 相同的发版语义:按 core → 适配器顺序、registry 已有
 * 同版本自动跳过、临时把 workspace:^ 改写为 ^<版本>(发完 git 还原);
 * 区别是认证交给 OIDC,并附 --provenance 构建来源证明。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_ORDER = ['core', 'element-plus', 'naive', 'ant-design-vue']

// OIDC 环境探测:Actions 会注入这两个变量,本地运行时给出明确报错而不是模糊的 404
if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
  console.error(
    '[publish-oidc] 未检测到 GitHub Actions OIDC 环境(ACTIONS_ID_TOKEN_REQUEST_* 缺失)。\n' +
    '受信发布只能在配置了 id-token: write 的 GitHub 托管 runner 上运行;\n' +
    '本地发布请改用 node scripts/publish-webauth.mjs 或 scripts/npm-webauth-run.py 流程。',
  )
  process.exit(1)
}

function npmVersion() {
  const raw = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
  const [major, minor] = raw.split('.').map(Number)
  return { major, minor, raw }
}

const { major, minor, raw } = npmVersion()
if (major < 11 || (major === 11 && minor < 5)) {
  console.error(`[publish-oidc] npm ${raw} 过低:受信发布需要 npm ≥ 11.5.1。`)
  process.exit(1)
}

function publishedVersion(name) {
  try {
    return execFileSync('npm', ['view', name, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

let failed = false
for (const pkg of PKG_ORDER) {
  const pkgDir = join(repoRoot, 'packages', pkg)
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const { name, version } = manifest
  const remote = publishedVersion(name)

  if (remote === version) {
    console.log(`[skip] ${name}@${version} 已在 registry`)
    continue
  }
  console.log(`[publish] ${name}@${version}${remote ? `(registry 当前 ${remote})` : '(新包)'}`)

  const manifestPath = join(pkgDir, 'package.json')
  const usesWorkspace = readFileSync(manifestPath, 'utf8').includes('"workspace:^"')
  if (usesWorkspace) {
    execFileSync('sed', ['-i', '', 's/"workspace:\\^"/"^' + version + '"/g', manifestPath])
  }

  try {
    execFileSync('npm', ['publish', '--access', 'public', '--provenance'], {
      cwd: pkgDir,
      stdio: 'inherit',
    })
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
  console.error('\n存在发布失败的包;修复后重跑(已成功的包会自动跳过)。')
  process.exit(1)
}
console.log('\n全部发布完成。')
