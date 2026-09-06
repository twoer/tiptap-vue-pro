<script setup lang="ts">
import { computed } from 'vue'
import { ElButton } from 'element-plus'
import {
  Code,
  Heading,
  ImagePlus,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Table,
  Workflow,
} from 'lucide-vue-next'
import {
  clampFloatingMenuLeft,
  isSlashCommandItemExecutable,
  resolveLocale,
  type LocaleKey,
  type LocaleTranslate,
  type SlashCommandItem,
  type SlashCommandRenderState,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  state: SlashCommandRenderState | null
  /** 宿主传入的 locale 翻译函数;缺省回落默认语言(zh-CN) */
  t?: LocaleTranslate
}>()

const fallbackT = resolveLocale().t
// slash 菜单项文案 locale 优先,数据表里的文案作为兜底
function slashLabel(item: SlashCommandItem) {
  return props.t?.(`slash.${item.id}.label` as LocaleKey, item.label)
    ?? fallbackT(`slash.${item.id}.label` as LocaleKey, item.label)
}
function slashHint(item: SlashCommandItem) {
  return props.t?.(`slash.${item.id}.hint` as LocaleKey, item.hint)
    ?? fallbackT(`slash.${item.id}.hint` as LocaleKey, item.hint)
}

const iconMap = {
  Heading,
  ListChecks,
  List,
  ListOrdered,
  Table,
  ImagePlus,
  Minus,
  Code,
  Workflow,
} as const

const menuStyle = computed(() => {
  const rect = props.state?.clientRect?.()
  if (!rect) return { display: 'none' }

  const width = 300
  const left = clampFloatingMenuLeft(rect.left, width)
  return {
    left: `${left}px`,
    top: `${rect.bottom + 6}px`,
    width: `${width}px`,
  }
})

function iconFor(item: SlashCommandItem) {
  return iconMap[item.icon as keyof typeof iconMap] ?? Code
}

function execute(item: SlashCommandItem) {
  if (!props.state || !isSlashCommandItemExecutable(item)) return
  props.state.command(item)
}
</script>

<template>
  <div
    v-if="state && state.items.length > 0"
    class="tvp-slash-menu"
    :style="menuStyle"
    role="listbox"
  >
    <ElButton
      v-for="(item, index) in state.items"
      :key="item.id"
      text
      class="tvp-slash-menu__item"
      :class="{ 'is-active': index === state.selectedIndex }"
      :disabled="!isSlashCommandItemExecutable(item)"
      role="option"
      :aria-selected="index === state.selectedIndex"
      @mousedown.prevent.stop
      @click="execute(item)"
    >
      <span class="tvp-slash-menu__icon">
        <component :is="iconFor(item)" :size="16" />
      </span>
      <span class="tvp-slash-menu__body">
        <span class="tvp-slash-menu__label">{{ slashLabel(item) }}</span>
        <span class="tvp-slash-menu__hint">{{ item.disabledReason ?? slashHint(item) }}</span>
      </span>
    </ElButton>
  </div>
</template>

<style scoped>
.tvp-slash-menu {
  position: fixed;
  z-index: 2200;
  max-height: 336px;
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 6px;
  background: var(--el-bg-color-overlay, #fff);
  box-shadow: var(--el-box-shadow-light, 0 0 12px rgb(0 0 0 / 12%));
}

.tvp-slash-menu__item {
  display: flex;
  width: 100%;
  min-height: 40px;
  height: auto;
  justify-content: flex-start;
  padding: 6px 8px;
  border-radius: 4px;
  color: var(--el-text-color-primary, #303133);
}

.tvp-slash-menu__item + .tvp-slash-menu__item {
  margin-left: 0;
}

.tvp-slash-menu__item.is-active {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
}

.tvp-slash-menu__item:disabled {
  opacity: 0.55;
}

.tvp-slash-menu__item :deep(span) {
  display: inline-flex;
  align-items: center;
}

.tvp-slash-menu__icon {
  flex: 0 0 auto;
  justify-content: center;
  width: 22px;
  color: currentColor;
}

.tvp-slash-menu__body {
  min-width: 0;
  margin-left: 6px;
  flex-direction: column;
  align-items: flex-start !important;
  line-height: 1.2;
}

.tvp-slash-menu__label {
  max-width: 240px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tvp-slash-menu__hint {
  max-width: 240px;
  overflow: hidden;
  margin-top: 2px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
