# Developer Diagnostics

Developer diagnostics help debug integration and editor behavior issues. They are not a visual Inspector and are not a user-facing debug mode. Diagnostics are disabled by default and only emit structured logs when `debug` is explicitly enabled.

## Enabling Diagnostics

The simplest usage is passing `debug`:

```vue
<ProEditorElementPlus v-model="content" debug />
```

By default, entries are written to `console.debug('[tiptap-vue-pro]', entry)`. If your app has its own logger, pass `debugLogger`:

```vue
<script setup lang="ts">
import type { ProEditorDebugEntry } from 'tiptap-vue-pro-core'

function debugLogger(entry: ProEditorDebugEntry) {
  console.debug(entry.channel, entry.event, entry.payload)
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :debug="{ channels: ['command', 'upload', 'table'] }"
    :debug-logger="debugLogger"
  />
</template>
```

Naive UI and Ant Design Vue expose the same props:

```vue
<ProEditorNaive v-model="content" :debug="{ channels: ['selection'] }" />
<ProEditorAntDesignVue v-model="content" :debug="{ level: 'warn' }" />
```

## Options

```ts
type ProEditorDebugLevel = 'debug' | 'info' | 'warn' | 'error'

type ProEditorDebugChannel =
  | 'lifecycle'
  | 'content'
  | 'selection'
  | 'transaction'
  | 'command'
  | 'upload'
  | 'markdown'
  | 'adapter'
  | 'table'

interface ProEditorDebugOptions {
  enabled?: boolean
  level?: ProEditorDebugLevel
  channels?: ProEditorDebugChannel[]
  includeContent?: boolean
}
```

- `debug: true`: enables all diagnostics channels.
- `debug: false` or omitted: disables diagnostics.
- `channels`: emits only selected channels.
- `level`: emits entries at or above the selected level.
- `includeContent`: defaults to `false`; set it to `true` only for temporary local debugging.

## Entry Shape

```ts
interface ProEditorDebugEntry {
  time: number
  level: ProEditorDebugLevel
  channel: ProEditorDebugChannel
  event: string
  source: 'core' | 'element-plus' | 'naive' | 'ant-design-vue'
  payload?: Record<string, unknown>
  error?: unknown
}
```

Common events:

| Channel | Example events | Use |
| --- | --- | --- |
| `lifecycle` | `init`, `editor-ready`, `destroy` | Editor initialization and cleanup |
| `content` | `update`, `external-sync` | `v-model` updates and external sync |
| `selection` | `update` | Selection changes and toolbar active state |
| `transaction` | `apply` | Whether ProseMirror transactions are produced |
| `command` | `run`, `result` | Whether toolbar commands are triggered |
| `upload` | `image:start`, `asset:error` | Image, video, audio, and file uploads |
| `markdown` | `import`, `export` | Markdown import/export |
| `adapter` | `toolbar-click`, `dialog-open` | Adapter UI actions |
| `table` | `select-line`, `delete-line`, `row-menu:open` | Table grips and table commands |

## Content Safety

By default, diagnostics do not include full HTML, JSON documents, typed text, tokens, passwords, or secrets. URLs are reduced to host information where possible:

```ts
{
  channel: 'upload',
  event: 'image:success',
  payload: {
    fileName: 'cover.png',
    urlHost: 'cdn.example.com'
  }
}
```

Content-like fields are only preserved when `includeContent: true` is set. This can expose user content, so avoid leaving it enabled in production.

## Table Grip Compatibility Switch

The older local table debugging switch still works:

```js
localStorage.setItem('tvp:table-grip-debug', '1')
```

When `debug` is not passed, this is equivalent to:

```ts
{
  channels: ['table'],
  level: 'debug'
}
```

If `debug` is passed, the public API takes precedence.
