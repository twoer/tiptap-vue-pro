# tiptap-vue-pro

> 现代化 Vue3 富文本编辑器组件,基于 Tiptap v3(非官方社区项目)

⚠️ **本项目与 [Tiptap](https://tiptap.dev) 官方无关**,是基于 Tiptap v3 + Vue3 的社区封装。Tiptap 核心遵循 MIT 协议。

## 为什么做这个

在 Vue3 项目里接入 Tiptap,你需要自己处理工具栏状态、图片上传/粘贴/拖拽、链接弹窗、表格、气泡菜单、颜色……这些事不难,但琐碎且重复。

本项目把这些封装好,核心逻辑写一遍,同时提供 **Element Plus** 和 **Naive UI** 两个对等的适配——你用哪个 UI 库,就装哪个包,API 完全一致:

```vue
<!-- Element Plus -->
<template>
  <ProEditorElementPlus
    v-model="content"
    output="html"
    placeholder="请输入内容..."
    :upload-image="uploadImage"
  />
</template>

<!-- Naive UI(把 ElementPlus 换成 Naive 即可,props 完全相同) -->
<template>
  <ProEditorNaive
    v-model="content"
    output="html"
    placeholder="请输入内容..."
    :upload-image="uploadImage"
  />
</template>
```

## 特性

> 🌐 **在线 Demo**:<https://twoer.github.io/tiptap-vue-pro/>（push 到 main 自动部署）

- ✅ 基于 Tiptap **v3**(stable)
- ✅ Vue 3 + TypeScript
- ✅ `v-model` 双向绑定,HTML / JSON 输出
- ✅ 完整工具栏:标题、加粗/斜体/删除线/**下划线**、行内代码、上标/下标、引用、代码块语言选择、分割线
- ✅ **文字颜色 / 背景高亮**(预设色板)
- ✅ **文本对齐**(左/中/右/两端)
- ✅ **清除格式**(一键去除所有样式)
- ✅ **气泡菜单**(选中文字浮现快捷工具条)
- ✅ **任务列表**(TaskList,勾选待办)
- ✅ **暗色模式**(组件级独立切换)
- ✅ 有序列表、无序列表
- ✅ 链接编辑、表格插入(网格选择器)
- ✅ 图片上传(上传 / 粘贴 / 拖拽)
- ✅ **Markdown 导入 / 导出**(工具栏一键 `.md` 文件读写)
- ✅ 字数统计、placeholder、只读模式
- ✅ **Element Plus 适配**、**Naive UI 适配**(双 UI 库对等)

## 安装

本项目发布为 3 个包:

- `tiptap-vue-pro-core`:UI 无关核心层,适合高级用户自己写工具栏和 UI
- `tiptap-vue-pro-element-plus`:Element Plus 开箱即用组件
- `tiptap-vue-pro-naive`:Naive UI 开箱即用组件

日常业务项目推荐安装对应 UI adapter;只安装 core 也能用,但需要你自己渲染 `EditorContent`、工具栏、弹窗和菜单。

```bash
# Element Plus 项目
pnpm add tiptap-vue-pro-element-plus element-plus
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3

# Naive UI 项目
pnpm add tiptap-vue-pro-naive naive-ui
pnpm add @tiptap/core @tiptap/pm @tiptap/vue-3
```

Headless / 自定义 UI 用法:

```bash
pnpm add tiptap-vue-pro-core @tiptap/core @tiptap/pm @tiptap/vue-3
```

## 快速开始

### Element Plus

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

### Naive UI

Naive UI 版用法完全对称(把 `ElementPlus` 换成 `Naive` 即可,props 一致):

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import 'tiptap-vue-pro-naive/style.css'

const content = ref('<p>hello world</p>')
</script>

<template>
  <ProEditorNaive
    v-model="content"
    :upload-image="uploadImage"
  />
</template>
```

> 两个适配 props/事件完全对等,内容互通——可随时切换。在线 Demo 顶部提供 UI 库切换,方便对比。

### 只使用 Core(自定义 UI)

`tiptap-vue-pro-core` 不包含现成 UI 组件,只提供 `useProEditor()`、默认扩展、命令聚合和类型契约:

```vue
<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor } from 'tiptap-vue-pro-core'

const ctx = useProEditor({
  content: '<p>hello core</p>',
})
</script>

<template>
  <button @click="ctx.commands.bold()">Bold</button>
  <button @click="ctx.commands.setImage('https://example.com/a.png')">Image</button>
  <EditorContent :editor="ctx.editor.value" />
</template>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string \| object` | `''` | v-model 绑定值 |
| `output` | `'html' \| 'json'` | `'html'` | 输出格式 |
| `placeholder` | `string` | `'请输入内容...'` | 占位文案 |
| `uploadImage` | `(file: File) => Promise<string \| null>` | — | 图片上传函数,传入后支持上传/粘贴/拖拽 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `dark` | `boolean` | `false` | 暗色模式(组件级独立切换,不依赖全局 class) |
| `extensions` | `Extensions` | 默认扩展包 | 自定义 Tiptap 扩展(覆盖默认) |

## 工具栏能力一览

| 分组 | 功能 |
| --- | --- |
| 撤销/重做 | 撤销、重做 |
| 标题 | 正文 / H1-H6 |
| 格式化 | 加粗、斜体、删除线、**下划线**、行内代码、上标、下标 |
| 颜色 | **文字颜色**(12 预设色)、**背景高亮**(8 预设色) |
| 对齐 | **左 / 中 / 右 / 两端** |
| 列表 | 无序列表、有序列表、引用、代码块语言选择、分割线 |
| 媒体 | 链接、图片上传、表格(网格选择行列) |
| 清理 | **清除格式** |
| Markdown | **导入 `.md` / 导出 `.md`** |
| 气泡菜单 | 选中文字浮现:加粗/斜体/下划线/删除线/链接/清除格式 |

## 架构

项目采用三层架构,UI 无关:

```
packages/
  core/              # UI 无关核心层:封装 Tiptap v3
                    #   useProEditor() composable + 命令聚合 + 图片上传逻辑 + notify 注入点
  element-plus/      # Element Plus 适配:ProEditorElementPlus 组件 + 工具栏 + 气泡菜单
  naive/             # Naive UI 适配:ProEditorNaive 组件 + 工具栏 + 气泡菜单
playground/          # 本地调试 + Demo(可切换 EP / Naive 对比)
```

- **Core** 不依赖任何 UI 库,只导出 composable 和类型,两个 adapter 对等使用
- **Adapter** 把 Core 的命令/状态接成具体 UI 库的组件

这套设计让"同时支持 Element Plus 和 Naive UI"成为可能——Core 写一遍,每个 UI 库只写一层"皮"。

## 本地开发

```bash
pnpm install        # 安装依赖
pnpm build          # 构建所有 packages
pnpm dev            # 启动 playground(http://localhost:5173)
pnpm test           # 运行单元/集成测试(Vitest)
pnpm typecheck      # 全量类型检查
```

要求:Node ≥ 18,pnpm ≥ 10。

## 测试

core 层用 [Vitest](https://vitest.dev) + `@vue/test-utils` 覆盖,挂载**真实 Tiptap 编辑器**(非 mock)验证每个命令的产出,确保功能可用而非纸面声明:

- `handleImageUpload.test.ts` — 图片文件判定、粘贴/拖拽批量上传调度(含失败不中断)
- `extensions.test.ts` — 默认扩展包完整性(漏配扩展会让命令静默失效)
- `useProEditor.test.ts` — 所有命令产出真实 HTML(bold/heading/link/taskList/color/align…),v-model 双向绑定,JSON 模式去重,字数统计,Markdown 导入导出,只读切换

Element Plus / Naive UI adapter 层也有组件级测试,覆盖网络图片、链接弹窗、图片工具条、预览/只读状态等高风险交互,确保两个 UI adapter 行为对等。

```bash
pnpm test           # 单次运行
pnpm -F tiptap-vue-pro-core test:watch   # watch 模式
pnpm -F tiptap-vue-pro-element-plus test:watch
pnpm -F tiptap-vue-pro-naive test:watch
```



> 🚀 **在线 Demo**:`playground/` 会在 push 到 main 时通过 GitHub Actions 自动构建并部署到
> <https://twoer.github.io/tiptap-vue-pro/>(见 `.github/workflows/deploy.yml`)。
> 首次使用需在仓库 Settings → Pages → Source 选择「GitHub Actions」。

## 功能路线

### 已完成 ✅

- [x] 基础工具栏 + 格式化(加粗/斜体/删除线/下划线/行内代码/上标/下标)
- [x] 文字颜色 / 背景高亮(预设色板)
- [x] 文本对齐(左/中/右/两端)
- [x] 清除格式
- [x] 气泡菜单(BubbleMenu)
- [x] 图片上传(上传/粘贴/拖拽)
- [x] 链接、表格(网格选择器)、代码块语言选择 + 语法高亮
- [x] **任务列表**(TaskList)
- [x] **暗色模式**(组件级)
- [x] **链接编辑器换为 Dialog**
- [x] **Markdown 导入 / 导出**(工具栏按钮,基于官方 `@tiptap/markdown`)
- [x] Element Plus 适配
- [x] **Naive UI 适配**(与 EP 功能对等:工具栏/气泡菜单/暗色/全屏/预览/打印/Markdown)
- [x] 图片尺寸调整 / 对齐 / 题注 / 替换 / 删除
- [x] 表格高级操作(行列抓手、增删行列、移动、合并拆分、表头切换)
- [x] Adapter 组件级测试(Element Plus / Naive UI 对等)
- [x] 在线 Demo(GitHub Pages 自动部署,可切换 EP / Naive)

### 进行中 / 计划 🚧

- [ ] 视频嵌入
- [ ] Slash command(/)
- [ ] Mention / 文件附件
- [ ] Nuxt 支持

## License

[MIT](./LICENSE)

## 致谢

- [Tiptap](https://tiptap.dev) — 强大的 headless 富文本编辑器框架
- [ProseMirror](https://prosemirror.net) — Tiptap 的底层引擎
- [Element Plus](https://element-plus.org) — Vue3 组件库
