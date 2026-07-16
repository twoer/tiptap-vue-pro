<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Replace,
  Search,
  X,
} from 'lucide-vue-next'
import { AntButton, AntInput, AntTooltip } from './antDesignPrimitives'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

const props = defineProps<{
  ctx: ProEditorContext
  readonly?: boolean
}>()

const searchInput = ref<{ focus?: () => void } | null>(null)
const state = computed(() => props.ctx.findReplaceState.value)
const total = computed(() => state.value.matches.length)
const current = computed(() => total.value > 0 ? state.value.activeIndex + 1 : 0)
const query = computed({
  get: () => state.value.query,
  set: (value: string) => props.ctx.commands.setFindReplaceQuery(value),
})
const replacement = computed({
  get: () => state.value.replacement,
  set: (value: string) => props.ctx.commands.setFindReplaceReplacement(value),
})
const caseSensitive = computed({
  get: () => state.value.caseSensitive,
  set: (value: boolean) => props.ctx.commands.setFindReplaceCaseSensitive(value),
})

watch(
  () => state.value.open,
  async (open) => {
    if (!open) return
    await nextTick()
    searchInput.value?.focus?.()
  },
)

function onPanelKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key !== 'Escape') return
  event.preventDefault()
  props.ctx.commands.closeFindReplace()
}

function toggleCaseSensitive() {
  caseSensitive.value = !caseSensitive.value
}
</script>

<template>
  <div
    v-if="state.open"
    class="tvp-find-panel"
    role="search"
    @mousedown.stop
    @keydown="onPanelKeydown"
  >
    <div class="tvp-find-panel__row">
      <AntInput
        ref="searchInput"
        v-model="query"
        class="tvp-find-panel__input"
        size="small"
        placeholder="查找"
        allow-clear
        @keyup.enter="ctx.commands.findReplaceNext()"
      >
        <template #prefix>
          <Search :size="14" />
        </template>
      </AntInput>

      <span class="tvp-find-panel__count">{{ current }} / {{ total }}</span>

      <div class="tvp-find-panel__actions">
        <AntTooltip content="上一个" placement="top" :show-after="300">
          <AntButton
            class="tvp-find-panel__icon-btn"
            size="small"
            text
            :disabled="total === 0"
            aria-label="上一个"
            @click="ctx.commands.findReplacePrevious()"
          >
            <ChevronUp :size="16" :stroke-width="2.3" />
          </AntButton>
        </AntTooltip>

        <AntTooltip content="下一个" placement="top" :show-after="300">
          <AntButton
            class="tvp-find-panel__icon-btn"
            size="small"
            text
            :disabled="total === 0"
            aria-label="下一个"
            @click="ctx.commands.findReplaceNext()"
          >
            <ChevronDown :size="16" :stroke-width="2.3" />
          </AntButton>
        </AntTooltip>

        <AntTooltip content="大小写敏感" placement="top" :show-after="300">
          <AntButton
            class="tvp-find-panel__icon-btn tvp-find-panel__case-btn"
            size="small"
            text
            :type="caseSensitive ? 'primary' : undefined"
            aria-label="大小写敏感"
            :aria-pressed="caseSensitive"
            @click="toggleCaseSensitive"
          >
            <CaseSensitive :size="18" :stroke-width="2.3" />
          </AntButton>
        </AntTooltip>

        <AntTooltip content="关闭" placement="top" :show-after="300">
          <AntButton
            class="tvp-find-panel__icon-btn"
            size="small"
            text
            aria-label="关闭"
            @click="ctx.commands.closeFindReplace()"
          >
            <X :size="16" :stroke-width="2.3" />
          </AntButton>
        </AntTooltip>
      </div>
    </div>

    <div v-if="!readonly" class="tvp-find-panel__row">
      <AntInput
        v-model="replacement"
        class="tvp-find-panel__input"
        size="small"
        placeholder="替换为"
        allow-clear
        @keyup.enter="ctx.commands.replaceFindReplaceCurrent()"
      >
        <template #prefix>
          <Replace :size="14" />
        </template>
      </AntInput>

      <div class="tvp-find-panel__replace-actions">
        <AntButton
          class="tvp-find-panel__text-btn"
          size="small"
          :disabled="total === 0"
          aria-label="替换当前"
          @click="ctx.commands.replaceFindReplaceCurrent()"
        >
          <span>替换</span>
        </AntButton>
        <AntButton
          class="tvp-find-panel__text-btn"
          size="small"
          type="primary"
          :disabled="total === 0"
          aria-label="全部替换"
          @click="ctx.commands.replaceFindReplaceAll()"
        >
          <span>全部</span>
        </AntButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tvp-find-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2050;
  display: grid;
  width: min(520px, calc(100% - 16px));
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--tvp-ant-border-color-light, #e4e7ed);
  border-radius: 6px;
  background: var(--tvp-ant-bg-color-overlay, #fff);
  box-shadow: 0 6px 18px rgb(0 0 0 / 12%);
}

.tvp-find-panel__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tvp-find-panel__input {
  min-width: 96px;
  flex: 1 1 160px;
}

.tvp-find-panel__count {
  flex: 0 0 auto;
  min-width: 48px;
  color: var(--tvp-ant-text-color-secondary, #909399);
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
}

.tvp-find-panel__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.tvp-find-panel__replace-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.tvp-find-panel__icon-btn {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--tvp-ant-text-color-regular, #606266);
  line-height: 0;
}

.tvp-find-panel__icon-btn :deep(svg) {
  display: block;
}

.tvp-find-panel__case-btn {
  border: 1px solid var(--tvp-ant-border-color-lighter, #ebeef5);
  background: var(--tvp-ant-fill-color-lighter, #fafafa);
}

.tvp-find-panel__case-btn[aria-pressed="true"] {
  border-color: var(--tvp-ant-color-primary-light-5, #a0cfff);
  background: var(--tvp-ant-color-primary-light-9, #ecf5ff);
  color: var(--tvp-ant-color-primary, #409eff);
}

.tvp-find-panel__text-btn :deep(span) {
  letter-spacing: 0;
}

@media (max-width: 560px) {
  .tvp-find-panel {
    left: 8px;
    width: auto;
  }

  .tvp-find-panel__row {
    flex-wrap: wrap;
  }

  .tvp-find-panel__input {
    flex-basis: 100%;
  }
}
</style>
