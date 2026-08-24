# 自动保存 + 本地草稿

这个 recipe 适合知识库、长文章、帮助文档和任何「丢稿成本很高」的场景。推荐模式是:远端 autosave 作为业务数据源,本地 draft 只做兜底恢复。

[在线体验这个场景](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=autosave-drafts)

## 最小接入

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import type { AutosaveStatus } from 'tiptap-vue-pro-core'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const documentId = ref('kb-getting-started')
const content = ref('<h2>快速开始</h2><p>在这里维护知识库正文。</p>')
const saveState = ref<AutosaveStatus>('idle')
const lastError = ref('')

const autosave = computed(() => ({
  key: documentId.value,
  delay: 1200,
  async onSave(value: string | object) {
    await fetch(`/api/knowledge-base/${documentId.value}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: value }),
    })
  },
}))

const draft = computed(() => ({
  key: documentId.value,
  delay: 300,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}))

function handleAutosaveStatus(state: { status: AutosaveStatus }) {
  saveState.value = state.status
}

function handleAutosaveError(error: unknown) {
  lastError.value = error instanceof Error ? error.message : '自动保存失败'
}
</script>

<template>
  <section>
    <p>保存状态: {{ saveState }}</p>
    <p v-if="lastError">最近错误: {{ lastError }}</p>

    <ProEditorElementPlus
      v-model="content"
      toolbar-layout="compact"
      :autosave="autosave"
      :draft="draft"
      @autosave-status-change="handleAutosaveStatus"
      @autosave-error="handleAutosaveError"
    />
  </section>
</template>
```

## 设计建议

- `autosave.key` 和 `draft.key` 应该使用稳定业务 ID,例如文章 ID、知识库文档 ID。
- 远端保存失败时不要清空本地草稿,否则网络抖动会放大丢稿风险。
- 本地草稿只是兜底,不要把它当成多人协作或跨设备同步方案。

更多行为细节见 [自动保存](/guide/autosave) 和 [本地草稿恢复](/guide/local-drafts)。
