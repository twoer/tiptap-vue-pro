<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput } from 'element-plus'
import { CircleHelp, TriangleAlert } from 'lucide-vue-next'
import {
  createMathRenderController,
  DEFAULT_MATH_BLOCK_LATEX,
  insertMathSnippet,
  MATH_SNIPPET_GROUPS,
  resolveLocale,
  type ActiveMathNode,
  type LocaleTranslate,
  type MathRenderState,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  modelValue: boolean
  math: ActiveMathNode | null
  t?: LocaleTranslate
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [latex: string, kind: 'inline' | 'block']
}>()

const fallbackT = resolveLocale().t
const t = (key: Parameters<LocaleTranslate>[0], params?: Record<string, string | number>) =>
  props.t?.(key, params) ?? fallbackT(key, params)

const dialogTitle = computed(() => (props.math ? t('math.dialog.title') : t('math.dialog.insertTitle')))

// 「行内」勾选:插入模式默认块级;编辑模式初始化为节点当前类型,勾选变化=类型转换
const insertInline = ref(false)

// ---- 常用语法速查 ----
const showHelp = ref(false)
const bodyEl = ref<HTMLElement | null>(null)

function insertSnippet(latex: string) {
  const textarea = bodyEl.value?.querySelector('textarea')
  if (textarea) insertMathSnippet(textarea, latex)
}

const latex = ref('')

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      // 插入模式预填示例公式,预览立刻有内容;编辑模式预填节点当前源码
      latex.value = props.math?.latex ?? DEFAULT_MATH_BLOCK_LATEX
      insertInline.value = props.math?.kind === 'inline'
    }
  },
  { immediate: true },
)

// 预览类型跟随勾选(编辑模式勾选变化即预览转换后的形态)
const displayMode = computed(() => !insertInline.value)

// 实时预览:复用 core 的 controller(异步契约 + 版本号丢弃过期结果)
const renderState = ref<MathRenderState>({ status: 'idle', html: '', error: '' })
const previewController = createMathRenderController({
  onState: (state) => {
    renderState.value = state
  },
})

watch(
  [latex, displayMode],
  () => {
    if (!props.modelValue) return
    if (!latex.value.trim()) {
      previewController.reset()
      return
    }
    void previewController.render(latex.value, { displayMode: displayMode.value })
  },
  { immediate: true },
)

function cancel() {
  emit('update:modelValue', false)
}

function confirm() {
  const value = latex.value.trim()
  if (!value) return
  emit('confirm', value, insertInline.value ? 'inline' : 'block')
  emit('update:modelValue', false)
}
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="520px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div ref="bodyEl" class="tvp-math-dialog-body">
      <label class="tvp-math-dialog-label" for="tvp-math-dialog-input">{{ t('math.dialog.label') }}</label>
      <ElInput
        id="tvp-math-dialog-input"
        v-model="latex"
        type="textarea"
        :rows="3"
        :placeholder="t('math.dialog.placeholder')"
        spellcheck="false"
      />
      <label class="tvp-math-dialog-inline">
        <input v-model="insertInline" type="checkbox" />
        <span>{{ t('math.dialog.kindInline') }}</span>
      </label>
      <div class="tvp-math-dialog-label tvp-math-dialog-preview-label">{{ t('math.dialog.preview') }}</div>
      <div
        class="tvp-math-dialog-preview"
        :data-render-status="renderState.status"
        :class="{ 'is-block-preview': displayMode }"
      >
        <div v-if="renderState.html" class="tvp-math-dialog-preview-render" v-html="renderState.html" />
        <span v-else-if="renderState.status === 'error'" class="tvp-math-dialog-preview-status is-error" role="status">
          <TriangleAlert :size="14" aria-hidden="true" />{{ t('math.dialog.previewError') }}
        </span>
        <span v-else class="tvp-math-dialog-preview-status">{{ t('math.render.empty') }}</span>
      </div>

      <div class="tvp-math-dialog-help">
        <button
          type="button"
          class="tvp-math-dialog-help-toggle"
          :aria-expanded="showHelp"
          @click="showHelp = !showHelp"
        >
          <span class="tvp-math-dialog-help-toggle-inner">
            <CircleHelp :size="14" aria-hidden="true" /><span>{{ t('math.dialog.help') }}</span>
          </span>
        </button>
        <div v-if="showHelp" class="tvp-math-dialog-help-panel" role="group" :aria-label="t('math.dialog.help')">
          <div v-for="group in MATH_SNIPPET_GROUPS" :key="group.title" class="tvp-math-help-group">
            <span class="tvp-math-help-title">{{ group.title }}</span>
            <span class="tvp-math-help-items">
              <button
                v-for="item in group.items"
                :key="item.display"
                type="button"
                class="tvp-math-help-chip"
                :title="item.latex"
                @click="insertSnippet(item.latex)"
              ><code>{{ item.display }}</code></button>
            </span>
          </div>
          <p class="tvp-math-help-hint">{{ t('math.dialog.helpHint') }}</p>
        </div>
      </div>
    </div>
    <template #footer>
      <ElButton @click="cancel">{{ t('toolbar.action.cancel') }}</ElButton>
      <ElButton type="primary" :disabled="!latex.trim()" @click="confirm">{{ t('toolbar.action.confirm') }}</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.tvp-math-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tvp-math-dialog-label {
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
}

.tvp-math-dialog-preview-label {
  margin-top: 4px;
}

.tvp-math-dialog-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 4px;
  background: var(--el-fill-color-blank, #fff);
  overflow: auto;
}

.tvp-math-dialog-preview[data-render-status='error'] {
  border-color: var(--el-color-danger, #f56c6c);
}

.tvp-math-dialog-preview-render {
  width: 100%;
  overflow-x: auto;
  text-align: center;
}

.tvp-math-dialog-preview.is-block-preview .tvp-math-dialog-preview-render :deep(.katex-display) {
  margin: 0;
}

.tvp-math-dialog-preview-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
}

.tvp-math-dialog-preview-status.is-error {
  color: var(--el-color-danger, #f56c6c);
}

.tvp-math-dialog-help {
  margin-top: 4px;
}

.tvp-math-dialog-help-toggle {
  display: inline-flex;
  align-items: center;
  padding: 2px 0;
  border: 0;
  background: none;
  color: var(--el-color-primary, #409eff);
  cursor: pointer;
  font-size: 13px;
}

.tvp-math-dialog-help-toggle-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tvp-math-dialog-help-panel {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 4px;
  background: var(--el-fill-color-extra-light, #fafafa);
}

.tvp-math-help-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.tvp-math-help-group + .tvp-math-help-group {
  margin-top: 8px;
}

.tvp-math-help-title {
  flex: 0 0 auto;
  min-width: 3em;
  padding-top: 3px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.tvp-math-help-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tvp-math-help-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 3px;
  background: var(--el-bg-color, #fff);
  cursor: pointer;
  line-height: 1.5;
}

.tvp-math-help-chip:hover {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
}

.tvp-math-help-chip code {
  font-family: var(--el-font-family, ui-monospace, monospace);
  font-size: 12px;
}

.tvp-math-help-hint {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.tvp-math-dialog-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular, #606266);
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}
</style>
