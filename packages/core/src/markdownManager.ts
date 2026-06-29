import type { MarkdownManager } from '@tiptap/markdown'
import type { Editor } from '@tiptap/vue-3'

export interface ProMarkdownManager {
  getNativeManager(): MarkdownManager | undefined
  exportMarkdown(): string
  importMarkdown(markdown: string): void
}

/** 取到官方 @tiptap/markdown 挂在 editor.storage 上的 manager。 */
export function getNativeMarkdownManager(
  editor: Editor,
): MarkdownManager | undefined {
  const storage = editor.storage as unknown as Record<
    string,
    { manager?: MarkdownManager }
  >
  return storage.markdown?.manager
}

export function createMarkdownManager(editor: Editor): ProMarkdownManager {
  return {
    getNativeManager() {
      return getNativeMarkdownManager(editor)
    },

    exportMarkdown() {
      const manager = getNativeMarkdownManager(editor)
      if (!manager) return ''
      return manager.serialize(editor.getJSON())
    },

    importMarkdown(markdown: string) {
      const manager = getNativeMarkdownManager(editor)
      if (!manager) {
        editor.commands.setContent(markdown)
        return
      }

      try {
        editor.commands.setContent(manager.parse(markdown))
      } catch {
        editor.commands.setContent(markdown)
      }
    },
  }
}
