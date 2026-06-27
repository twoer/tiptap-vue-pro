/**
 * Vitest 全局 setup。
 *
 * 主要处理 Tiptap 在 jsdom/happy-dom 下的已知 unmount 问题
 * (https://github.com/ueberdosis/tiptap/issues/6777):
 * 编辑器销毁时 ProseMirror 调用 `_a.remove()`,在 happy-dom 下偶发抛
 * "TypeError: _a.remove is not a function"。该错误发生在 afterEach 之后、
 * 不影响断言,但会冒泡成 uncaughtException 让 vitest 误判失败。
 *
 * 这里安装一个 uncaughtException 过滤器,只吞掉这一个已知噪音错误,
 * 其余异常照常抛出,避免掩盖真实问题。
 */
const TIPTAP_UNMOUNT_RE = /_a\.remove is not a function|\.remove is not a function/

if (typeof process !== 'undefined' && process.on) {
  process.on('uncaughtException', (err: NodeJS.ErrnoException | Error) => {
    const msg = err?.message ?? String(err)
    if (TIPTAP_UNMOUNT_RE.test(msg)) {
      // 已知噪音,吞掉
      return
    }
    // 其余异常重新抛出,交给 vitest 正常处理
    throw err
  })
}
