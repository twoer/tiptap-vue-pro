<script setup lang="ts">
/**
 * Naive 适配的气泡菜单:选中文字时浮现的小工具条。
 *
 * 实现说明:@tiptap/vue-3 v3 不导出 BubbleMenu 组件,
 * 改用 @tiptap/extension-bubble-menu 扩展(框架无关),把根 DOM 喂给扩展的
 * element 配置,扩展用 floating-ui 定位到选区附近。
 * shouldShow 仅在「有选区且非空」时显示。
 *
 * 包含最常用格式化:加粗/斜体/下划线/删除线/链接/清除格式。
 */
import { ref, computed } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Bold, Italic, Underline, Strikethrough, Link, Eraser } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { useEditorPluginRegistration, type ProEditorContext } from 'tiptap-vue-pro-core'

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
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proBubbleMenu',
    editor: ed,
    element,
    updateDelay: 100,
    shouldShow: ({ state }) => {
      if (state.selection.empty) return false
      // 在表格内选文字时不弹文字气泡,让表格气泡独占。
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
    <NButton text aria-label="加粗" :type="ctx.isActive('bold') ? 'primary' : 'default'" @click="ctx.commands.bold()"><Bold :size="16" /></NButton>
    <NButton text aria-label="斜体" :type="ctx.isActive('italic') ? 'primary' : 'default'" @click="ctx.commands.italic()"><Italic :size="16" /></NButton>
    <NButton text aria-label="下划线" :type="ctx.isActive('underline') ? 'primary' : 'default'" @click="ctx.commands.underline()"><Underline :size="16" /></NButton>
    <NButton text aria-label="删除线" :type="ctx.isActive('strike') ? 'primary' : 'default'" @click="ctx.commands.strike()"><Strikethrough :size="16" /></NButton>
    <NButton text aria-label="链接" @click="openQuickLink"><Link :size="16" /></NButton>
    <NButton text aria-label="清除格式" @click="ctx.commands.clearFormat()"><Eraser :size="16" /></NButton>

    <!-- 快速链接输入 -->
    <teleport to="body">
      <div v-if="linkInputVisible" class="tvp-bubble-link-mask" @click.self="linkInputVisible = false">
        <div class="tvp-bubble-link">
          <NInput
            v-model:value="linkUrl"
            placeholder="https://"
            style="width: 220px"
            @keyup.enter="confirmQuickLink"
          />
          <NButton size="small" type="primary" aria-label="确定链接" @click="confirmQuickLink">确定</NButton>
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
  background: var(--n-color, #fff);
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.tvp-bubble.is-visible {
  display: flex;
}

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
  background: var(--n-color, #fff);
  border-radius: 6px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}
</style>
