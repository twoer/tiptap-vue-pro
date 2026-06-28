import { Markdown } from '@tiptap/markdown'
import type { MarkdownManager } from '@tiptap/markdown'
import type { Editor } from '@tiptap/vue-3'

/**
 * Markdown 导入/导出能力(基于官方 @tiptap/markdown 扩展)。
 *
 * 设计说明:
 * - 扩展会把 MarkdownManager 挂到 editor.storage.markdown.manager,
 *   并给 editor 实例追加 getMarkdown() 方法。这里统一从 storage 取 manager,
 *   避免对 editor 实例做 as any(扩展未在 Editor 类型上声明这两个成员)。
 * - 官方扩展不支持「把无对应 MD 语法的样式降级为内联 HTML」,
 *   因此颜色/高亮/对齐等富样式在导出时会丢失——这是第一档取舍:
 *   覆盖标题/粗斜体/列表/任务/引用/代码块/表格/链接/图片等 MD 原生能力。
 */

export { Markdown as MarkdownExtension }

/** 取到编辑器上的 MarkdownManager(未启用扩展时为 undefined) */
export function getMarkdownManager(editor: Editor): MarkdownManager | undefined {
  const storage = editor.storage as unknown as Record<
    string,
    { manager?: MarkdownManager }
  >
  return storage.markdown?.manager
}

/** 编辑器当前内容序列化为 Markdown 字符串。未启用扩展时返回空串。 */
export function getMarkdown(editor: Editor): string {
  const manager = getMarkdownManager(editor)
  if (!manager) return ''
  return manager.serialize(editor.getJSON())
}

/**
 * 把一段 Markdown 写入编辑器(替换全部内容)。
 *
 * - 启用了扩展:用 manager.parse 转 JSON 后 setContent,
 *   解析失败时降级为原文直接塞入(勉强兼容纯文本)。
 * - 未启用扩展:直接 setContent(md)——此时按 HTML/JSON 默认规则处理。
 *
 * 不传 emitUpdate:false,以便新内容通过 onUpdate 流回 v-model。
 */
export function importMarkdown(editor: Editor, md: string): void {
  const manager = getMarkdownManager(editor)
  if (manager) {
    try {
      const json = manager.parse(md)
      editor.commands.setContent(json)
      return
    } catch {
      // 解析失败则走下面的降级路径
    }
  }
  editor.commands.setContent(md)
}
