<script setup lang="ts">
import { ElButton, ElButtonGroup, ElTooltip } from 'element-plus'
import { Code2, Columns2, LoaderCircle, TriangleAlert, Workflow } from 'lucide-vue-next'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'
import { MERMAID_VIEW_MODES, useMermaidNodeView, type MermaidViewMode } from 'tiptap-vue-pro-core'

const props = defineProps<NodeViewProps>()
const view = useMermaidNodeView(props)
const codeHost = view.codeHost
const modeIcons = { code: Code2, diagram: Workflow, split: Columns2 }

function modeLabel(mode: MermaidViewMode) {
  return view.t(`mermaid.view.${mode}` as const)
}
</script>

<template>
  <NodeViewWrapper
    class="tvp-mermaid-block"
    :class="[`is-${view.viewMode.value}`, { 'is-dark': view.theme.value === 'dark' }]"
    :data-view-mode="view.viewMode.value"
    contenteditable="false"
  >
    <div v-if="view.editable.value" class="tvp-mermaid-toolbar">
      <span class="tvp-mermaid-title"><Workflow :size="15" aria-hidden="true" /><span>Mermaid</span></span>
      <ElButtonGroup class="tvp-mermaid-mode-group" :aria-label="view.t('mermaid.view.label')">
        <ElTooltip v-for="mode in MERMAID_VIEW_MODES" :key="mode" :content="modeLabel(mode)" placement="top" :show-after="300">
          <ElButton
            size="small"
            :type="view.viewMode.value === mode ? 'primary' : 'default'"
            :aria-label="modeLabel(mode)"
            :aria-pressed="view.viewMode.value === mode"
            @mousedown.prevent
            @click="view.setViewMode(mode)"
          >
            <span class="tvp-mermaid-mode-icon-wrap"><component :is="modeIcons[mode]" :size="14" class="tvp-mermaid-mode-icon" aria-hidden="true" /></span>
          </ElButton>
        </ElTooltip>
      </ElButtonGroup>
    </div>

    <div class="tvp-mermaid-body" :class="`is-${view.viewMode.value}`">
      <div v-if="view.showCode.value" class="tvp-mermaid-code-pane">
        <div ref="codeHost" class="tvp-mermaid-code-host" />
      </div>
      <div
        v-if="view.showDiagram.value"
        class="tvp-mermaid-diagram-pane"
        :data-render-status="view.renderState.value.status"
        role="img"
        :aria-label="view.t('mermaid.diagram.label')"
        @dblclick.stop.prevent="view.editDiagram"
      >
        <div v-if="view.renderState.value.svg" class="tvp-mermaid-svg" v-html="view.renderState.value.svg" />
        <div v-else-if="view.renderState.value.status === 'loading'" class="tvp-mermaid-status"><LoaderCircle :size="18" class="is-spinning" />{{ view.t('mermaid.render.loading') }}</div>
        <div v-else-if="view.renderState.value.status === 'error'" class="tvp-mermaid-status is-error" role="status"><TriangleAlert :size="18" />{{ view.t('mermaid.render.error') }}</div>
        <div v-else class="tvp-mermaid-status">{{ view.t('mermaid.render.empty') }}</div>
        <div v-if="view.renderState.value.status === 'loading' && view.renderState.value.svg" class="tvp-mermaid-loading" aria-live="polite"><LoaderCircle :size="14" class="is-spinning" />{{ view.t('mermaid.render.loading') }}</div>
        <div v-if="view.renderState.value.status === 'error'" class="tvp-mermaid-error" role="status"><TriangleAlert :size="15" />{{ view.t('mermaid.render.error') }}<span v-if="view.renderState.value.errorLine"> · L{{ view.renderState.value.errorLine }}</span></div>
      </div>
    </div>
    <NodeViewContent class="tvp-mermaid-source-content" />
  </NodeViewWrapper>
</template>

<style scoped>
.tvp-mermaid-block {
  --tvp-mermaid-border: var(--el-border-color, #dcdfe6);
  --tvp-mermaid-divider: var(--el-border-color-lighter, #ebeef5);
  --tvp-mermaid-surface: var(--el-bg-color, #fff);
  --tvp-mermaid-subtle: var(--el-fill-color-light, #f5f7fa);
  --tvp-mermaid-muted: var(--el-text-color-secondary, #909399);
  --tvp-mermaid-text: var(--el-text-color-primary, #303133);
  --tvp-mermaid-code-bg: var(--el-fill-color-extra-light, #fafafa);
  --tvp-mermaid-code-text: var(--el-text-color-primary, #303133);
  --tvp-mermaid-code-caret: var(--el-color-primary, #409eff);
  --tvp-mermaid-gutter-bg: var(--el-fill-color-light, #f5f7fa);
  --tvp-mermaid-gutter-text: var(--el-text-color-placeholder, #a8abb2);
  --tvp-mermaid-active-line: color-mix(in srgb, var(--el-color-primary, #409eff) 8%, transparent);
  --tvp-mermaid-selection: color-mix(in srgb, var(--el-color-primary, #409eff) 20%, transparent);
  --tvp-mermaid-error-line: color-mix(in srgb, var(--el-color-danger, #f56c6c) 10%, transparent);
  --tvp-mermaid-error: var(--el-color-danger, #f56c6c);
  margin: 16px 0;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--tvp-mermaid-border);
  border-radius: 4px;
  background: var(--tvp-mermaid-surface);
  color: var(--tvp-mermaid-text);
}
.tvp-mermaid-toolbar { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 8px 6px 12px; border-bottom: 1px solid var(--tvp-mermaid-divider); background: var(--tvp-mermaid-subtle); }
.tvp-mermaid-title, .tvp-mermaid-status, .tvp-mermaid-loading, .tvp-mermaid-error { display: inline-flex; align-items: center; gap: 6px; }
.tvp-mermaid-title { font-size: 13px; font-weight: 600; }
.tvp-mermaid-title svg, .tvp-mermaid-status svg, .tvp-mermaid-loading svg, .tvp-mermaid-error svg { flex: 0 0 auto; }
.tvp-mermaid-mode-group { display: inline-flex; align-items: center; }
.tvp-mermaid-mode-group :deep(.el-button) { width: 28px; height: 28px; padding: 0; }
.tvp-mermaid-mode-icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; }
.tvp-mermaid-mode-icon { display: block; width: 14px; height: 14px; flex: 0 0 auto; transform: translateY(1px); }
.tvp-mermaid-body { display: grid; min-width: 0; }
.tvp-mermaid-body.is-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.tvp-mermaid-code-pane, .tvp-mermaid-diagram-pane { min-width: 0; min-height: 280px; }
.tvp-mermaid-code-pane { background: var(--tvp-mermaid-code-bg); }
.tvp-mermaid-body.is-split .tvp-mermaid-code-pane { border-right: 1px solid var(--tvp-mermaid-divider); }
.tvp-mermaid-code-host { height: 100%; min-height: 280px; }
.tvp-mermaid-diagram-pane { position: relative; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 20px; background: var(--tvp-mermaid-surface); }
.tvp-mermaid-svg { width: 100%; text-align: center; }
.tvp-mermaid-svg :deep(svg) { display: inline-block; max-width: 100%; height: auto; }
.tvp-mermaid-status { max-width: 100%; color: var(--tvp-mermaid-muted); font-size: 13px; text-align: center; }
.tvp-mermaid-status.is-error, .tvp-mermaid-error { color: var(--tvp-mermaid-error); }
.tvp-mermaid-loading, .tvp-mermaid-error { position: absolute; right: 8px; bottom: 8px; max-width: calc(100% - 16px); padding: 5px 8px; border-radius: 3px; background: var(--tvp-mermaid-subtle); font-size: 12px; }
.is-spinning { animation: tvp-mermaid-spin 900ms linear infinite; }
.tvp-mermaid-source-content { position: absolute !important; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
@keyframes tvp-mermaid-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .tvp-mermaid-body.is-split { grid-template-columns: minmax(0, 1fr); }
  .tvp-mermaid-body.is-split .tvp-mermaid-code-pane { border-right: 0; border-bottom: 1px solid var(--tvp-mermaid-divider); }
  .tvp-mermaid-code-pane, .tvp-mermaid-diagram-pane, .tvp-mermaid-code-host { min-height: 220px; }
}
@media (prefers-reduced-motion: reduce) { .is-spinning { animation: none; } }
</style>
