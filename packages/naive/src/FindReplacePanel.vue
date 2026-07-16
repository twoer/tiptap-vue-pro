<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NInput, NTooltip } from 'naive-ui'
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Replace,
  Search,
  X,
} from 'lucide-vue-next'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

const props = defineProps<{
  ctx: ProEditorContext
  readonly?: boolean
}>()

const searchInput = ref<InstanceType<typeof NInput> | null>(null)
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
    searchInput.value?.focus()
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
      <NInput
        ref="searchInput"
        v-model:value="query"
        class="tvp-find-panel__input"
        size="small"
        placeholder="查找"
        clearable
        @keyup.enter="ctx.commands.findReplaceNext()"
      >
        <template #prefix>
          <Search :size="14" />
        </template>
      </NInput>

      <span class="tvp-find-panel__count">{{ current }} / {{ total }}</span>

      <div class="tvp-find-panel__actions">
        <NTooltip placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              class="tvp-find-panel__icon-btn"
              size="small"
              text
              :disabled="total === 0"
              aria-label="上一个"
              @click="ctx.commands.findReplacePrevious()"
            >
              <ChevronUp :size="16" :stroke-width="2.3" />
            </NButton>
          </template>
          上一个
        </NTooltip>

        <NTooltip placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              class="tvp-find-panel__icon-btn"
              size="small"
              text
              :disabled="total === 0"
              aria-label="下一个"
              @click="ctx.commands.findReplaceNext()"
            >
              <ChevronDown :size="16" :stroke-width="2.3" />
            </NButton>
          </template>
          下一个
        </NTooltip>

        <NTooltip placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              class="tvp-find-panel__icon-btn tvp-find-panel__case-btn"
              size="small"
              text
              :type="caseSensitive ? 'primary' : undefined"
              aria-label="大小写敏感"
              :aria-pressed="caseSensitive"
              @click="toggleCaseSensitive"
            >
              <CaseSensitive :size="18" :stroke-width="2.3" />
            </NButton>
          </template>
          大小写敏感
        </NTooltip>

        <NTooltip placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              class="tvp-find-panel__icon-btn"
              size="small"
              text
              aria-label="关闭"
              @click="ctx.commands.closeFindReplace()"
            >
              <X :size="16" :stroke-width="2.3" />
            </NButton>
          </template>
          关闭
        </NTooltip>
      </div>
    </div>

    <div v-if="!readonly" class="tvp-find-panel__row">
      <NInput
        v-model:value="replacement"
        class="tvp-find-panel__input"
        size="small"
        placeholder="替换为"
        clearable
        @keyup.enter="ctx.commands.replaceFindReplaceCurrent()"
      >
        <template #prefix>
          <Replace :size="14" />
        </template>
      </NInput>

      <div class="tvp-find-panel__replace-actions">
        <NButton
          size="small"
          :disabled="total === 0"
          aria-label="替换当前"
          @click="ctx.commands.replaceFindReplaceCurrent()"
        >
          替换
        </NButton>
        <NButton
          size="small"
          type="primary"
          :disabled="total === 0"
          aria-label="全部替换"
          @click="ctx.commands.replaceFindReplaceAll()"
        >
          全部
        </NButton>
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
  border: 1px solid var(--n-border-color, #e4e7ed);
  border-radius: 6px;
  background: var(--n-color, #fff);
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
  color: var(--n-text-color-3, #909399);
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
  color: var(--n-text-color-2, #606266);
  line-height: 0;
}

.tvp-find-panel__icon-btn :deep(svg) {
  display: block;
}

.tvp-find-panel__case-btn {
  border: 1px solid var(--n-border-color, #e4e7ed);
  background: var(--n-action-color, #fafafa);
}

.tvp-find-panel__case-btn[aria-pressed="true"] {
  border-color: var(--n-primary-color, #18a058);
  background: color-mix(in srgb, var(--n-primary-color, #18a058) 12%, transparent);
  color: var(--n-primary-color, #18a058);
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
