# tiptap-vue-pro-naive

基于 Tiptap v3 + Vue 3 + Naive UI 的开箱即用富文本编辑器组件。

## 安装

```bash
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import 'tiptap-vue-pro-naive/style.css'

const content = ref('<p>hello world</p>')
</script>

<template>
  <ProEditorNaive v-model="content" />
</template>
```

完整文档和 Demo: https://github.com/twoer/tiptap-vue-pro
