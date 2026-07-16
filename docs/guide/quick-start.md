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

## Slash Command

开箱组件默认启用 Slash Command。把光标放在可编辑段落中,输入 `/` 会打开快捷插入菜单;可以继续输入中文、英文或拼音别名筛选命令,例如 `/表`、`/table`、`/todo`、`/img`、`/code`。

默认菜单保持精简,包含标题、待办、无序列表、有序列表、表格、图片、分割线和代码块。`Enter` 执行当前项,`Esc` 关闭菜单并保留已经输入的 `/query` 文本。Slash Command 是编辑器交互能力,不会改变 Markdown 导入/导出的语义。

## 查找替换

开箱组件默认支持编辑器内查找替换。点击工具栏里的查找图标,或在光标位于编辑器内时按 `Ctrl/⌘ + F`,都可以打开面板;输入关键字后会高亮全部匹配,并显示当前命中序号和总数。面板支持上/下一个、大小写敏感、替换当前和替换全部。

只读或预览状态下仍可查找和跳转,但替换入口会隐藏。查找替换只作用于 ProseMirror 文档文本,不会搜索工具栏、弹窗等 UI 文案,也不会改变 Markdown 导入/导出的语义。

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
pnpm test:slash:e2e
pnpm test:find-replace:e2e
```
