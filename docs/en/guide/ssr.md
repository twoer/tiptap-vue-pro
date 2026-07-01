# Nuxt / SSR

Core creates the editor with `immediatelyRender: false` by default, preventing Tiptap from rendering immediately during SSR. In Nuxt apps, wrap ready-made components with `<ClientOnly>`:

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

If you only use `tiptap-vue-pro-core`, keep the default `immediatelyRender: false`. Override it only when you are certain the runtime has no SSR constraints.
