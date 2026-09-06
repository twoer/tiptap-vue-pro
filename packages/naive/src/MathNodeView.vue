<script setup lang="ts">
import { LoaderCircle, Sigma, TriangleAlert } from 'lucide-vue-next'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'
import { useMathNodeView } from 'tiptap-vue-pro-core'

const props = defineProps<NodeViewProps>()
const view = useMathNodeView(props)
</script>

<template>
  <NodeViewWrapper
    class="tvp-math-node"
    :as="view.isBlock.value ? 'div' : 'span'"
    :class="[
      view.isBlock.value ? 'is-block' : 'is-inline',
      { 'is-dark': view.theme.value === 'dark', 'is-editable': view.editable.value },
    ]"
    :data-type="view.isBlock.value ? 'math-block' : 'math-inline'"
    :data-latex="view.latex.value"
    :data-render-status="view.renderState.value.status"
    contenteditable="false"
    role="img"
    :aria-label="view.t('math.node.label')"
  >
    <span
      v-if="view.renderState.value.html"
      class="tvp-math-render"
      v-html="view.renderState.value.html"
    />
    <span v-else-if="view.renderState.value.status === 'loading'" class="tvp-math-status">
      <LoaderCircle :size="14" class="is-spinning" aria-hidden="true" />{{ view.t('math.render.loading') }}
    </span>
    <span v-else-if="view.renderState.value.status === 'error'" class="tvp-math-status is-error" role="status">
      <TriangleAlert :size="14" aria-hidden="true" />{{ view.t('math.render.error') }}
      <code class="tvp-math-source">{{ view.latex.value }}</code>
      <span v-if="view.renderState.value.error" class="tvp-math-error-detail">{{ view.renderState.value.error }}</span>
    </span>
    <span v-else class="tvp-math-status is-empty">
      <Sigma :size="14" aria-hidden="true" />{{ view.t('math.render.empty') }}
    </span>
  </NodeViewWrapper>
</template>

<style scoped>
.tvp-math-node {
  --tvp-math-muted: rgba(194, 194, 208, 0.9);
  --tvp-math-error: #d03050;
  --tvp-math-border: #d9d9df;
  --tvp-math-subtle: rgba(247, 247, 250, 0.9);
  --tvp-math-primary: var(--n-color-target, #18a058);
  --tvp-math-primary-soft: var(--n-primary-color-hover, #36ad6a);
}

.tvp-math-node.is-inline {
  display: inline;
}

.tvp-math-node.is-block {
  display: block;
  margin: 12px 0;
  text-align: center;
}

/*
 * 选中态(NodeSelection 加 ProseMirror-selectednode;范围选中由
 * rangeSelection 装饰加 tvp-range-selected-node):主色描边,
 * 让公式获得与图片/媒体一致的「可点选的独立元素」反馈。
 * is-editable 由 editable 注入,只读/预览态不带该类,选中效果一并隐藏。
 */
.tvp-math-node.is-editable.ProseMirror-selectednode,
.tvp-math-node.is-editable.tvp-range-selected-node {
  outline: 2px solid var(--tvp-math-primary);
}

.tvp-math-node.is-inline.ProseMirror-selectednode,
.tvp-math-node.is-inline.tvp-range-selected-node {
  outline-offset: 1px;
  border-radius: 2px;
}

.tvp-math-node.is-block.ProseMirror-selectednode,
.tvp-math-node.is-block.tvp-range-selected-node {
  outline-offset: 3px;
  border-radius: 4px;
}

/* hover 描边:浅主色提示可点选(仅可编辑且未选中时显示) */
.tvp-math-node.is-editable:not(.ProseMirror-selectednode):not(.tvp-range-selected-node):hover {
  outline: 1.5px solid var(--tvp-math-primary-soft);
}

.tvp-math-node.is-inline.is-editable:not(.ProseMirror-selectednode):not(.tvp-range-selected-node):hover {
  outline-offset: 1px;
  border-radius: 2px;
}

.tvp-math-node.is-block.is-editable:not(.ProseMirror-selectednode):not(.tvp-range-selected-node):hover {
  outline-offset: 3px;
  border-radius: 4px;
}

.tvp-math-node.is-block[data-render-status='error'],
.tvp-math-node.is-block[data-render-status='idle'] {
  padding: 10px 12px;
  border: 1px dashed var(--tvp-math-border);
  border-radius: 4px;
}

.tvp-math-node[data-render-status='error'] {
  color: var(--tvp-math-error);
}

.tvp-math-node.is-block[data-render-status='error'] {
  border-color: var(--tvp-math-error);
}

.tvp-math-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tvp-math-muted);
  font-size: 13px;
}

.tvp-math-status.is-error {
  flex-wrap: wrap;
  color: var(--tvp-math-error);
}

.tvp-math-status svg {
  flex: 0 0 auto;
}

.tvp-math-source {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--tvp-math-subtle);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.tvp-math-error-detail {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tvp-math-render {
  display: inline;
}

.tvp-math-render :deep(.katex-display) {
  margin: 0;
}

.is-spinning {
  animation: tvp-math-spin 900ms linear infinite;
}

@keyframes tvp-math-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning {
    animation: none;
  }
}
</style>
