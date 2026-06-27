<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { ElButton } from 'element-plus'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

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
let extensionAdded = false

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
  ctx.value.commands.setLink(linkUrl.value.trim())
  linkInputVisible.value = false
}

function registerBubbleMenu() {
  const ed = props.editor
  if (!ed || !rootEl.value || extensionAdded) return

  // BubbleMenuPlugin 是 ProseMirror Plugin 工厂,
  // 直接注册到 editor。扩展内部用 floating-ui 定位元素到选区附近。
  const plugin = BubbleMenuPlugin({
    pluginKey: 'proBubbleMenu',
    editor: ed,
    element: rootEl.value,
    updateDelay: 100,
    shouldShow: ({ state }) => {
      // 仅在有非空选区时显示(纯光标点击不弹)
      return !state.selection.empty
    },
  })
  ed.registerPlugin(plugin)
  extensionAdded = true
}

onMounted(() => {
  registerBubbleMenu()
})

// editor 异步就绪后注册
watch(
  () => props.editor,
  (ed) => {
    if (ed) registerBubbleMenu()
  },
)

onBeforeUnmount(() => {
  const ed = props.editor
  if (ed) {
    ed.unregisterPlugin('proBubbleMenu')
  }
})
</script>

<template>
  <div
    ref="rootEl"
    class="tvp-bubble"
    :class="{ 'is-visible': isVisible }"
  >
    <ElButton text :type="ctx.isActive('bold') ? 'primary' : 'default'" @click="ctx.commands.bold()">B</ElButton>
    <ElButton text :type="ctx.isActive('italic') ? 'primary' : 'default'" @click="ctx.commands.italic()"><i>I</i></ElButton>
    <ElButton text :type="ctx.isActive('underline') ? 'primary' : 'default'" @click="ctx.commands.underline()"><u>U</u></ElButton>
    <ElButton text :type="ctx.isActive('strike') ? 'primary' : 'default'" @click="ctx.commands.strike()"><s>S</s></ElButton>
    <ElButton text @click="openQuickLink">🔗</ElButton>
    <ElButton text @click="ctx.commands.clearFormat()">⌫</ElButton>

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
          <ElButton size="small" type="primary" @click="confirmQuickLink">确定</ElButton>
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
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
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
  background: var(--el-bg-color, #fff);
  border-radius: 6px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.tvp-bubble-link input {
  padding: 6px 10px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  outline: none;
  width: 220px;
}
</style>
