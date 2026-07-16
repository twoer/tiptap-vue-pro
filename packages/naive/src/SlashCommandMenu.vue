<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import {
  Code,
  Heading,
  ImagePlus,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Table,
} from 'lucide-vue-next'
import {
  isSlashCommandItemExecutable,
  type SlashCommandItem,
  type SlashCommandRenderState,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  state: SlashCommandRenderState | null
}>()

const iconMap = {
  Heading,
  ListChecks,
  List,
  ListOrdered,
  Table,
  ImagePlus,
  Minus,
  Code,
} as const

const menuStyle = computed(() => {
  const rect = props.state?.clientRect?.()
  if (!rect) return { display: 'none' }

  const width = 300
  const viewportWidth = typeof window === 'undefined' ? width : window.innerWidth
  const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8))
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
    <NButton
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
        <span class="tvp-slash-menu__label">{{ item.label }}</span>
        <span class="tvp-slash-menu__hint">{{ item.disabledReason ?? item.hint }}</span>
      </span>
    </NButton>
  </div>
</template>

<style scoped>
.tvp-slash-menu {
  position: fixed;
  z-index: 2200;
  max-height: 336px;
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--n-border-color, #e0e0e6);
  border-radius: 6px;
  background: var(--n-color, #fff);
  box-shadow: var(--n-box-shadow2, 0 3px 12px rgb(0 0 0 / 12%));
}

.tvp-slash-menu__item {
  display: flex;
  width: 100%;
  min-height: 40px;
  height: auto;
  justify-content: flex-start;
  padding: 6px 8px;
  border-radius: 4px;
  color: var(--n-text-color, #303133);
}

.tvp-slash-menu__item.is-active {
  background: var(--n-color-target, #f0f6ff);
  color: var(--n-primary-color, #18a058);
}

.tvp-slash-menu__item :deep(.n-button__content) {
  display: inline-flex;
  align-items: center;
  width: 100%;
}

.tvp-slash-menu__icon {
  display: inline-flex;
  flex: 0 0 auto;
  justify-content: center;
  width: 22px;
  color: currentColor;
}

.tvp-slash-menu__body {
  display: inline-flex;
  min-width: 0;
  margin-left: 6px;
  flex-direction: column;
  align-items: flex-start;
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
  color: var(--n-text-color-3, #909399);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
