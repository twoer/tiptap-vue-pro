# 本地草稿恢复

本地草稿是远端 Autosave 之外的可选防丢层。它适合处理刷新、关闭标签页或浏览器崩溃前远端保存尚未成功的情况。

```vue
<ProEditorElementPlus
  v-model="content"
  :autosave="{ key: articleId, onSave: saveArticle }"
  :draft="{ key: articleId, delay: 300, maxAge: 7 * 24 * 60 * 60 * 1000 }"
  @draft-found="handleDraftFound"
  @draft-error="reportDraftError"
/>
```

知识库、帮助文档和长文章通常会同时启用远端自动保存与本地草稿。完整接入示例见 [知识库编辑器](/guide/examples#知识库编辑器)。

`draft` 默认关闭,启用时必须提供稳定且非空的 `key`。默认实现将版本化 JSON envelope 写入：

```text
tiptap-vue-pro:draft:<encoded-document-key>
```

## 恢复规则

- 编辑产生的完整 HTML/JSON 会独立防抖写入本地。
- 重新进入或切换 key 时只检查草稿,不会自动覆盖 `modelValue`。
- 草稿与当前内容不同时显示“恢复 / 删除”。
- 恢复提示存在时会保留历史草稿并暂停本地覆盖,直到显式恢复或删除。
- 恢复会走正常编辑更新,同步 `v-model` 并触发远端 Autosave。
- 最新远端版本保存成功后,只删除 identity 匹配的本地草稿。
- 保存失败时保留草稿;继续编辑会用最新完整文档覆盖旧草稿。
- 损坏、错 key、未知版本和过期草稿不会被恢复。

## 自定义存储

`storage` 接受同步或异步实现：

```ts
interface LocalDraftStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}
```

Core 还导出 `createBrowserLocalDraftStorage(prefix?)`。它只在方法调用时访问浏览器 API,因此模块保持 SSR 可导入。

## 隐私

默认 `localStorage` 中的草稿**没有加密**。敏感内容应关闭 `draft`,或传入业务侧加密/受控存储。该功能不是离线请求队列、版本历史或冲突合并系统。
