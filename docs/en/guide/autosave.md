# Autosave

All three adapters expose the same autosave behavior through the `autosave` prop. Core debounces save requests and runs them strictly in sequence. When edits arrive during a save, only the latest pending content is retained.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'

const articleId = ref('article-42')
const content = ref('<p>Start writing</p>')

async function saveArticle(key: string | number | undefined, value: string | object) {
  await fetch(`/api/articles/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: value }),
  })
}

function reportSaveError(error: unknown) {
  console.error(error)
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :autosave="{
      key: articleId,
      delay: 1200,
      onSave: (value, { key }) => saveArticle(key, value),
    }"
    @autosave-error="reportSaveError"
  />
</template>
```

## Options

```ts
interface AutosaveOptions<T = string | object> {
  key?: string | number
  enabled?: boolean
  delay?: number
  saveOnUnmount?: boolean
  getIdentity?: (content: T) => string
  onSave: (content: T, context: AutosaveSaveContext) => Promise<void> | void
}
```

- `key` identifies the current document. Changing it cancels pending content and uses the current editor content as the new baseline.
- `delay` is the debounce after editing stops and defaults to `1000ms`.
- `enabled: false` temporarily disables autosave; passing `autosave=false` does the same.
- `getIdentity` supplies a comparison key for custom content that cannot be stably serialized with `JSON.stringify`.
- `saveOnUnmount` attempts to flush when the Vue component unmounts, but browsers do not wait for asynchronous work to finish.

## States And Events

The states are `idle`, `dirty`, `saving`, `saved`, and `error`. When enabled, adapters show a localized status in the footer and emit snapshots through `autosave-status-change`; failures also emit `autosave-error`.

`onSave` calls never overlap. Rapid edits, including edits made while a save is active, keep only the latest pending content. A stale request from an old document cannot update the new document state. External `v-model` changes reset the saved baseline and are not sent back through autosave.

## Manual Flush And Retry

When using Core directly, `useProEditor` returns `flushAutosave()` and `retryAutosave()`:

```ts
const editor = useProEditor(options)

await editor.flushAutosave()
await editor.retryAutosave()
```

`retryAutosave()` retries the most recent failed content when it is still the latest revision.

All three adapters show a Retry action in the failed state and expose `flushAutosave()` and `retryAutosave()` on the component instance.

## Page Exit

`saveOnUnmount` is best effort only. During navigation, refresh, or tab close, the browser may terminate a request before its Promise settles. If page-exit delivery is required, use `navigator.sendBeacon()` or an equivalent strategy inside the consumer's `onSave` implementation for that case.

Autosave itself never reads or writes browser storage. Enable [Local Draft Recovery](/en/guide/local-drafts) separately for refresh or crash recovery. It does not provide an offline request queue, version history, or conflict merging.
