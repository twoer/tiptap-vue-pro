import type { Editor } from '@tiptap/core'
import type { ProEditorCommands } from './types'

/**
 * findReplace 命令桥:把 FindReplace 扩展注册的 ProseMirror 命令包装成
 * ctx.commands 条目,供查找替换面板调用。
 *
 * 命令类型增强见 extensions/findReplace.ts 的 declare module;
 * `?.` 可选调用保持运行时安全(扩展未注册时静默失效)。
 */
export type FindReplaceCommandEntries = Pick<
  ProEditorCommands,
  | 'openFindReplace'
  | 'closeFindReplace'
  | 'setFindReplaceQuery'
  | 'setFindReplaceReplacement'
  | 'setFindReplaceCaseSensitive'
  | 'findReplaceNext'
  | 'findReplacePrevious'
  | 'replaceFindReplaceCurrent'
  | 'replaceFindReplaceAll'
>

export function createFindReplaceCommandEntries(
  cmd: () => Editor | undefined,
): FindReplaceCommandEntries {
  return {
    openFindReplace: () => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.openFindReplace?.()
    },
    closeFindReplace: () => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.closeFindReplace?.()
    },
    setFindReplaceQuery: (query) => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.setFindReplaceQuery?.(query)
    },
    setFindReplaceReplacement: (replacement) => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.setFindReplaceReplacement?.(replacement)
    },
    setFindReplaceCaseSensitive: (caseSensitive) => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.setFindReplaceCaseSensitive?.(caseSensitive)
    },
    findReplaceNext: () => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.findReplaceNext?.()
    },
    findReplacePrevious: () => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.findReplacePrevious?.()
    },
    replaceFindReplaceCurrent: (replacement) => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.replaceFindReplaceCurrent?.(replacement)
    },
    replaceFindReplaceAll: (replacement) => {
      const ed = cmd()
      if (!ed) return
      ;ed.commands.replaceFindReplaceAll?.(replacement)
    },
  }
}
