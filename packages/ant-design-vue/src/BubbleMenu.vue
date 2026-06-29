<script setup lang="ts">
import { ref, computed } from 'vue'
import { AntButton } from './antDesignPrimitives'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Bold, Italic, Underline, Strikethrough, Link, Eraser } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { useEditorPluginRegistration, type ProEditorContext } from 'tiptap-vue-pro-core'

/**
 * 气泡菜单:选中文字时浮现的小工具条。
 *
 * 实现说明:
 * - @tiptap/vue-3 在 v3 不再导出 BubbleMenu 组件,
 *   改用 @tiptap/extension-bubble-menu 扩展(框架无关)。
 * - 组件挂载后,把根 DOM 元素喂给扩展的 element 配置,
 *   扩展负责用 floating-ui 定位到选区附近。
 * - shouldShow 仅在「有选区且非空」时显示(避免点击光标时弹出)。
 *
 * 包含最常用格式化:加粗/斜体/下划线/删除线/链接/清除格式。
 */
const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
}>()

const rootEl = ref<HTMLElement | null>(null)
const isVisible = ref(false)

const ctx = computed(() => props.ctx)

// 链接快捷输入
const linkInputVisible = ref(false)
const linkUrl = ref('')

function openQuickLink() {
  const attrs = props.editor?.getAttributes('link') as { href?: string } | undefined
  linkUrl.value = attrs?.href ?? ''
  linkInputVisible.value = true
}

function confirmQuickLink() {
  const href = linkUrl.value.trim()
  if (!href) {
    if (props.editor?.isActive('link')) {
      ctx.value.commands.setLink('')
      ctx.value.notify('已移除链接', 'success')
      linkInputVisible.value = false
      return
    }
    ctx.value.notify('请填写链接地址', 'warning')
    return
  }
  if (!/^(https?:|mailto:|tel:)/i.test(href) && !/\.[a-z]{2,}/i.test(href)) {
    ctx.value.notify('链接格式不正确,请输入完整网址(如 https://example.com)', 'warning')
    return
  }
  ctx.value.commands.setLink(href)
  linkInputVisible.value = false
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proBubbleMenu',
  // BubbleMenuPlugin 是 ProseMirror Plugin 工厂,
  // 直接注册到 editor。扩展内部用 floating-ui 定位元素到选区附近。
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proBubbleMenu',
    editor: ed,
    element,
    updateDelay: 100,
    shouldShow: ({ state }) => {
      // 仅在有非空选区时显示(纯光标点击不弹)
      if (state.selection.empty) return false
      // 在表格内选文字时不弹文字气泡——表格气泡(proTableBubble)独占,
      // 避免两个气泡同时浮现在同一位置打架。表格内的文字格式化用顶部工具栏。
      const { $from } = state.selection
      for (let d = $from.depth; d > 0; d--) {
        const name = $from.node(d).type.name
        if (name === 'tableCell' || name === 'tableHeader') return false
      }
      return true
    },
  }),
})
</script>

<template>
  <div
    ref="rootEl"
    class="tvp-bubble"
    :class="{ 'is-visible': isVisible }"
  >
    <AntButton text aria-label="加粗" :type="ctx.isActive('bold') ? 'primary' : 'default'" @click="ctx.commands.bold()"><Bold :size="16" /></AntButton>
    <AntButton text aria-label="斜体" :type="ctx.isActive('italic') ? 'primary' : 'default'" @click="ctx.commands.italic()"><Italic :size="16" /></AntButton>
    <AntButton text aria-label="下划线" :type="ctx.isActive('underline') ? 'primary' : 'default'" @click="ctx.commands.underline()"><Underline :size="16" /></AntButton>
    <AntButton text aria-label="删除线" :type="ctx.isActive('strike') ? 'primary' : 'default'" @click="ctx.commands.strike()"><Strikethrough :size="16" /></AntButton>
    <AntButton text aria-label="链接" @click="openQuickLink"><Link :size="16" /></AntButton>
    <AntButton text aria-label="清除格式" @click="ctx.commands.clearFormat()"><Eraser :size="16" /></AntButton>

    <!-- 快速链接输入 -->
    <teleport to="body">
      <div v-if="linkInputVisible" class="tvp-bubble-link-mask" @click.self="linkInputVisible = false">
        <div class="tvp-bubble-link">
          <input
            v-model="linkUrl"
            type="url"
            placeholder="https://"
            @keyup.enter="confirmQuickLink"
          />
          <AntButton size="small" type="primary" aria-label="确定链接" @click="confirmQuickLink">确定</AntButton>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.tvp-bubble {
  display: none;
  align-items: center;
  gap: 1px;
  padding: 4px;
  background: var(--tvp-ant-bg-color, #fff);
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.tvp-bubble.is-visible {
  display: flex;
}

/* 链接快捷输入 */
.tvp-bubble-link-mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.tvp-bubble-link {
  display: flex;
  gap: 6px;
  padding: 12px;
  background: var(--tvp-ant-bg-color, #fff);
  border-radius: 6px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.tvp-bubble-link input {
  padding: 6px 10px;
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 4px;
  outline: none;
  width: 220px;
}
</style>
