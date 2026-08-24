# 只读预览和详情页

这个 recipe 适合内容详情页、审批预览、发布前预览和只读知识库。推荐做法是复用同一份 HTML 或 JSON 内容,编辑页传 `readonly=false`,详情页传 `readonly=true`。

[在线体验这个场景](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=readonly-preview)

## 最小接入

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const readonly = ref(true)
const content = ref(`
  <h2>发布说明</h2>
  <p>这是一份只读预览内容。用户可以查看排版、图片、表格和链接,但不能编辑正文。</p>
  <blockquote>详情页和编辑页复用同一份内容,可以减少展示差异。</blockquote>
`)
</script>

<template>
  <section>
    <button type="button" @click="readonly = !readonly">
      {{ readonly ? '切换到编辑态' : '切换到只读态' }}
    </button>

    <ProEditorElementPlus
      v-model="content"
      :readonly="readonly"
      :show-word-count="!readonly"
      toolbar-layout="compact"
    />
  </section>
</template>
```

## 什么时候用 readonly

- 详情页需要保持和编辑页一致的渲染效果。
- 审批流需要预览将要发布的内容。
- 只读知识库仍希望保留编辑器的链接、图片、表格和 Mermaid 渲染能力。

## 常见坑

- 如果内容来自不可信用户,入库或展示前仍应按业务安全要求做 HTML 清洗。
- 只读态适合展示,不等于权限控制;真正的编辑权限仍应由后端校验。
- 如果详情页追求极致轻量,可以考虑服务端渲染静态 HTML,不一定要挂载完整编辑器。
