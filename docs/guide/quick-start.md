# 快速开始

Tiptap Vue Pro 是基于 Tiptap v3 + Vue 3 的富文本编辑器组件。日常业务项目建议直接安装与你的 UI 库匹配的 Adapter;需要自绘 UI 时再使用 Core。

## 安装

::: code-group

```bash [Element Plus]
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

```bash [Naive UI]
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

```bash [Ant Design Vue]
pnpm add tiptap-vue-pro-ant-design-vue ant-design-vue
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

:::

## 最小示例

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

Naive UI 和 Ant Design Vue 的写法只需要替换组件名、样式文件和包名。完整示例见 [完整示例](/guide/examples)。

## 图片上传

传入 `uploadImage` 后,工具栏上传、粘贴图片和拖拽图片都会走同一个上传函数。函数返回图片 URL 后会自动插入编辑器。

```vue
<script setup lang="ts">
async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
}
</script>

<template>
  <ProEditorElementPlus v-model="content" :upload-image="uploadImage" />
</template>
```

## 本地开发

```bash
pnpm install
pnpm dev
pnpm docs:dev
pnpm test
pnpm typecheck
pnpm build
```
