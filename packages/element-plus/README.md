# tiptap-vue-pro-element-plus

基于 Tiptap v3 + Vue 3 + Element Plus 的开箱即用富文本编辑器组件。

## 安装

```bash
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello world</p>')
</script>

<template>
  <ProEditorElementPlus v-model="content" />
</template>
```

完整文档和 Demo: https://github.com/twoer/tiptap-vue-pro
