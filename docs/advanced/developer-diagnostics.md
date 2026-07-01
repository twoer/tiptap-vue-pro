# 开发者诊断

开发者诊断用于排查业务接入和编辑器行为问题。它不是可视化 Inspector,也不是面向最终用户的调试模式;默认关闭,只在显式传入 `debug` 时输出结构化日志。

## 启用方式

最简单的方式是传入 `debug`:

```vue
<ProEditorElementPlus v-model="content" debug />
```

默认输出到 `console.debug('[tiptap-vue-pro]', entry)`。如果业务侧已经有日志系统,传入 `debugLogger` 接管输出:

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

Naive UI 和 Ant Design Vue 使用同样的 props:

```vue
<ProEditorNaive v-model="content" :debug="{ channels: ['selection'] }" />
<ProEditorAntDesignVue v-model="content" :debug="{ level: 'warn' }" />
```

## 配置项

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

- `debug: true`: 打开全部诊断通道。
- `debug: false` 或不传: 关闭诊断。
- `channels`: 只输出指定通道。
- `level`: 只输出等于或高于该级别的日志。
- `includeContent`: 默认 `false`;设为 `true` 时允许输出内容相关字段,仅建议本地排障临时使用。

## 日志结构

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

常见事件:

| 通道 | 事件示例 | 用途 |
| --- | --- | --- |
| `lifecycle` | `init`, `editor-ready`, `destroy` | 排查编辑器初始化和销毁 |
| `content` | `update`, `external-sync` | 排查 `v-model` 回写和外部同步 |
| `selection` | `update` | 排查选区变化和 toolbar active 态 |
| `transaction` | `apply` | 排查 ProseMirror transaction 是否产生 |
| `command` | `run`, `result` | 排查工具栏命令是否触发 |
| `upload` | `image:start`, `asset:error` | 排查图片、视频、音频、文件上传 |
| `markdown` | `import`, `export` | 排查 Markdown 导入导出 |
| `adapter` | `toolbar-click`, `dialog-open` | 排查 adapter UI 操作 |
| `table` | `select-line`, `delete-line`, `row-menu:open` | 排查表格行列抓手和表格命令 |

## 内容安全

默认日志不会输出完整 HTML、JSON 文档、用户输入文本、token、password、secret 等字段。URL 会尽量降级为 host 信息,例如:

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

只有在传入 `includeContent: true` 时,内容字段才会保留。这个选项可能暴露用户编辑内容,不要在生产环境长期启用。

## 表格抓手兼容开关

旧的本地表格排障开关仍然可用:

```js
localStorage.setItem('tvp:table-grip-debug', '1')
```

当没有显式传入 `debug` 时,这个开关等价于:

```ts
{
  channels: ['table'],
  level: 'debug'
}
```

如果已经传入 `debug`,以 public API 为准。
