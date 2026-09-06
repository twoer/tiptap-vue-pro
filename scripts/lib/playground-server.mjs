import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * e2e 共享的 playground dev server 生命周期管理。
 *
 * - PLAYGROund_URL 已设置或端口已有服务在跑:直接使用,不拉起进程;
 * - 否则自动 spawn `pnpm --filter playground dev`,轮询到 URL 可用;
 *   拉起的进程注册在 exit 钩子上,脚本退出(含异常)时自动回收。
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_PLAYGROUND_URL = 'http://localhost:5173/tiptap-vue-pro/playground/'
const SERVER_START_TIMEOUT_MS = 90_000

async function isServerUp(url) {
  try {
    // 必须有超时:端口被假死进程占用时,无超时的 fetch 会永久挂起整个脚本
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function ensurePlaygroundServer() {
  const basePlaygroundUrl = process.env.PLAYGROUND_URL ?? DEFAULT_PLAYGROUND_URL
  if (await isServerUp(basePlaygroundUrl)) {
    console.error(`[e2e] using existing playground server at ${basePlaygroundUrl}`)
    return basePlaygroundUrl
  }

  // 端口必须与轮询 URL 一致:显式 --port + --strictPort,禁止 vite 静默跳端口
  // (否则端口被其它项目占用时,vite 跑到 5174 而 we 死等 5173)。
  const port = new URL(basePlaygroundUrl).port || '5173'
  console.error(`[e2e] starting playground dev server on port ${port} ...`)
  let child
  // 端口冲突(比如上一个实例尚在关闭)时有限重试
  for (let attempt = 0; attempt < 3; attempt++) {
    child = spawn('pnpm', [
      '--filter', 'playground', 'dev', '--', '--port', port, '--strictPort',
    ], {
      cwd: repoRoot,
      stdio: 'ignore',
    })
    // 关键:解除子进程对事件循环的引用,否则脚本跑完后 node 会一直等 vite 退出
    child.unref()
    const exited = await Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ])
    if (!exited) break
    console.error(`[e2e] dev server exited (port ${port} busy?), retry ${attempt + 1}/3 ...`)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  process.once('exit', () => {
    child.kill('SIGTERM')
  })

  const deadline = Date.now() + SERVER_START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isServerUp(basePlaygroundUrl)) {
      console.error('[e2e] playground dev server ready')
      return basePlaygroundUrl
    }
    if (child.exitCode != null) {
      throw new Error(
        `playground dev server exited (code ${child.exitCode}); likely another server holds port ${port}`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  child.kill('SIGTERM')
  throw new Error(`playground dev server did not become ready at ${basePlaygroundUrl}`)
}
