<script setup lang="ts">
import { ref, computed } from 'vue'
import { AntButton } from './antDesignPrimitives'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Bold, Italic, Underline, Strikethrough, Link, Eraser } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { isSupportedLinkUrl, resolveLocale, shouldShowTextBubbleMenu, useEditorPluginRegistration, type LocaleKey, type ProEditorContext } from 'tiptap-vue-pro-core'

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
const fallbackT = resolveLocale().t
function t(key: LocaleKey) {
  return ctx.value.t?.(key) ?? fallbackT(key)
}

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
      ctx.value.notify(t('notify.linkRemoved'), 'success')
      linkInputVisible.value = false
      return
    }
    ctx.value.notify(t('notify.linkEmpty'), 'warning')
    return
  }
  if (!isSupportedLinkUrl(href)) {
    ctx.value.notify(t('notify.linkInvalid'), 'warning')
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
    // 显隐互斥规则(链接/文件/媒体/HR/代码块/表格独占)统一收口在 core。
    shouldShow: ({ editor, state }) => shouldShowTextBubbleMenu(editor, state),
  }),
})
</script>

<template>
  <div
    ref="rootEl"
    class="tvp-bubble"
    :class="{ 'is-visible': isVisible }"
  >
    <AntButton text :aria-label="t('command.bold')" :type="ctx.isActive('bold') ? 'primary' : 'default'" @click="ctx.commands.bold()"><Bold :size="16" /></AntButton>
    <AntButton text :aria-label="t('command.italic')" :type="ctx.isActive('italic') ? 'primary' : 'default'" @click="ctx.commands.italic()"><Italic :size="16" /></AntButton>
    <AntButton text :aria-label="t('command.underline')" :type="ctx.isActive('underline') ? 'primary' : 'default'" @click="ctx.commands.underline()"><Underline :size="16" /></AntButton>
    <AntButton text :aria-label="t('command.strike')" :type="ctx.isActive('strike') ? 'primary' : 'default'" @click="ctx.commands.strike()"><Strikethrough :size="16" /></AntButton>
    <AntButton text :aria-label="t('command.link')" @click="openQuickLink"><Link :size="16" /></AntButton>
    <AntButton text :aria-label="t('command.clearFormat')" @click="ctx.commands.clearFormat()"><Eraser :size="16" /></AntButton>

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
          <AntButton size="small" type="primary" :aria-label="t('toolbar.link.confirmAria')" @click="confirmQuickLink">{{ t('toolbar.action.confirm') }}</AntButton>
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
  border: 1px solid var(--tvp-ant-border-color, #d9d9d9);
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
  border: 1px solid var(--tvp-ant-border-color, #d9d9d9);
  border-radius: 4px;
  outline: none;
  width: 220px;
}
</style>
