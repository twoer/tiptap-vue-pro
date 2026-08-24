# 自动保存

三套 Adapter 都通过 `autosave` prop 提供同一套自动保存行为。保存请求由 Core 防抖并严格串行执行；编辑期间产生的新内容只保留最新一份，当前请求结束后继续保存。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'

const articleId = ref('article-42')
const content = ref('<p>开始写作</p>')

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

长文档或知识库场景通常还需要本地防丢兜底。完整接入示例见 [知识库编辑器](/guide/examples#知识库编辑器)。

## 配置

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

- `key` 标识当前文档。key 变化会取消待保存内容，并把当前编辑器内容设为新基线。
- `delay` 是编辑停止后的防抖时间，默认 `1000ms`。
- `enabled: false` 临时关闭自动保存；也可直接传 `autosave=false`。
- `getIdentity` 可为无法稳定 `JSON.stringify` 的自定义内容提供比较标识。
- `saveOnUnmount` 会在 Vue 组件卸载时尝试 flush，但浏览器不会等待异步请求完成。

## 状态与事件

状态依次为 `idle`、`dirty`、`saving`、`saved` 和 `error`。启用后，Adapter footer 会显示本地化状态文本，并分别通过 `autosave-status-change` 和 `autosave-error` 发出状态快照与错误。

`onSave` 永不并发执行。快速编辑或保存期间继续编辑时，只会排队最新内容。旧文档的在途请求即使较晚结束，也不能改写新文档的状态。外部 `v-model` 内容变化会重置保存基线，不会把外部内容再次保存回去。

## 手动 Flush 与重试

直接使用 Core 时，`useProEditor` 返回 `flushAutosave()` 和 `retryAutosave()`：

```ts
const editor = useProEditor(options)

await editor.flushAutosave()
await editor.retryAutosave()
```

`retryAutosave()` 重试最近一次失败且仍是最新版本的内容。

三套 Adapter 在“保存失败”状态直接显示“重试”操作,也通过组件实例公开 `flushAutosave()` 和 `retryAutosave()`。

## 页面退出

`saveOnUnmount` 只能 best effort 执行。导航、刷新或关闭标签页时，浏览器可能在 Promise 完成前终止请求；必须保证页面退出送达时，请在业务的 `onSave` 中针对退出场景使用 `navigator.sendBeacon()` 或等价方案。

Autosave 自身不读写浏览器存储。需要刷新、崩溃恢复时,可另外启用[本地草稿恢复](/guide/local-drafts)。它不提供离线请求队列、版本历史或冲突合并。
