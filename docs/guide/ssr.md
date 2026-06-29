# Nuxt / SSR

Core 默认以 `immediatelyRender: false` 创建编辑器,避免 SSR 阶段立即渲染 Tiptap。Nuxt 项目建议把开箱组件包在 `<ClientOnly>` 中:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello nuxt</p>')
</script>

<template>
  <ClientOnly>
    <ProEditorElementPlus v-model="content" />
  </ClientOnly>
</template>
```

如果只使用 `tiptap-vue-pro-core`,也建议保留默认的 `immediatelyRender: false`。只有在明确知道运行环境没有 SSR 约束时,才需要主动覆盖它。
