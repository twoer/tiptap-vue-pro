# Autosave + Local Drafts

Use this recipe for knowledge bases, long articles, help docs, and workflows where losing edits is expensive. The recommended model is: remote autosave is the business source of truth; local drafts are only a recovery layer.

[Try this scenario online](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=autosave-drafts)

## Minimal integration

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import type { AutosaveStatus } from 'tiptap-vue-pro-core'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const documentId = ref('kb-getting-started')
const content = ref('<h2>Getting Started</h2><p>Maintain the knowledge-base body here.</p>')
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
  lastError.value = error instanceof Error ? error.message : 'Autosave failed'
}
</script>

<template>
  <section>
    <p>Save status: {{ saveState }}</p>
    <p v-if="lastError">Last error: {{ lastError }}</p>

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

## Design notes

- `autosave.key` and `draft.key` should use a stable business ID, such as article ID or document ID.
- Do not clear local drafts when remote save fails; network failures should not increase data-loss risk.
- Local drafts are a recovery layer, not a multi-user collaboration or cross-device sync feature.

See [Autosave](/en/guide/autosave) and [Local Draft Recovery](/en/guide/local-drafts) for details.
