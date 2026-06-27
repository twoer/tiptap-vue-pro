# tiptap-vue-pro

> 现代化 Vue3 富文本编辑器组件,基于 Tiptap v3(非官方社区项目)

⚠️ **本项目与 [Tiptap](https://tiptap.dev) 官方无关**,是基于 Tiptap v3 + Vue3 的社区封装。Tiptap 核心遵循 MIT 协议。

## 为什么做这个

在 Vue3 项目里接入 Tiptap,你需要自己处理工具栏状态、图片上传/粘贴/拖拽、链接弹窗、表格、暗色模式……这些事不难,但琐碎且重复。

`tiptap-vue-pro` 把这些封装好,让你 1 分钟接入:

```vue
<template>
  <ProEditorElementPlus
    v-model="content"
    output="html"
    placeholder="请输入内容..."
    :upload-image="uploadImage"
  />
</template>
```

## 特性

- ✅ 基于 Tiptap **v3**(stable)
- ✅ Vue 3 + TypeScript
- ✅ `v-model` 双向绑定,HTML / JSON 输出
- ✅ 开箱即用的工具栏(标题、粗体、斜体、列表、引用、代码块、链接、表格、分割线)
- ✅ 图片上传(上传 / 粘贴 / 拖拽)
- ✅ 字数统计、placeholder、只读模式
- ✅ Element Plus 适配(Naive UI 适配开发中)

## 安装

```bash
# Element Plus 项目
pnpm add tiptap-vue-pro-element-plus element-plus

# peer 依赖
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import 'element-plus/dist/index.css'

const content = ref('<p>hello world</p>')

// 图片上传:实现你的上传逻辑,返回图片 url
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const { url } = await res.json()
  return url
}
</script>

<template>
  <ProEditorElementPlus
    v-model="content"
    :upload-image="uploadImage"
  />
</template>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string \| object` | `''` | v-model 绑定值 |
| `output` | `'html' \| 'json'` | `'html'` | 输出格式 |
| `placeholder` | `string` | `'请输入内容...'` | 占位文案 |
| `uploadImage` | `(file: File) => Promise<string \| null>` | — | 图片上传函数,传入后支持粘贴/拖拽上传 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `extensions` | `Extensions` | 默认扩展包 | 自定义 Tiptap 扩展(覆盖默认) |

## 架构

项目采用三层架构,UI 无关:

```
packages/
  core/              # UI 无关核心层:封装 Tiptap v3
                    #   useProEditor() composable + 命令聚合 + 图片上传逻辑
  element-plus/      # Element Plus 适配:ProEditorElementPlus 组件
  naive/             # (计划中)Naive UI 适配
playground/          # 本地调试 + Demo
```

- **Core** 不依赖任何 UI 库,只导出 composable 和类型,两个 adapter 对等使用
- **Adapter** 把 Core 的命令/状态接成具体 UI 库的组件

这套设计让"同时支持 Element Plus 和 Naive UI"成为可能——Core 写一遍,每个 UI 库只写一层"皮"。

## 本地开发

```bash
pnpm install        # 安装依赖
pnpm build          # 构建所有 packages
pnpm dev            # 启动 playground(http://localhost:5173)
```

要求:Node ≥ 18,pnpm ≥ 9。

## 功能路线

- [x] 基础工具栏 + 格式化
- [x] 图片上传(上传/粘贴/拖拽)
- [x] 链接、表格、代码块
- [x] Element Plus 适配
- [ ] Naive UI 适配
- [ ] 任务列表(TaskList,v3 接入细化中)
- [ ] 暗色模式
- [ ] Markdown 导入导出
- [ ] Slash command
- [ ] Mention / 文件附件

## License

[MIT](./LICENSE)

## 致谢

- [Tiptap](https://tiptap.dev) — 强大的 headless 富文本编辑器框架
- [ProseMirror](https://prosemirror.net) — Tiptap 的底层引擎
- [Element Plus](https://element-plus.org) — Vue3 组件库
