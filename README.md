# tiptap-vue-pro

> 现代化 Vue3 富文本编辑器组件,基于 Tiptap v3(非官方社区项目)

⚠️ **本项目与 [Tiptap](https://tiptap.dev) 官方无关**,是基于 Tiptap v3 + Vue3 的社区封装。Tiptap 核心遵循 MIT 协议。

## 为什么做这个

在 Vue3 项目里接入 Tiptap,你需要自己处理工具栏状态、图片上传/粘贴/拖拽、链接弹窗、表格、气泡菜单、颜色……这些事不难,但琐碎且重复。

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

> 🌐 **在线 Demo**:<https://twoer.github.io/tiptap-vue-pro/>（push 到 main 自动部署）

- ✅ 基于 Tiptap **v3**(stable)
- ✅ Vue 3 + TypeScript
- ✅ `v-model` 双向绑定,HTML / JSON 输出
- ✅ 完整工具栏:标题、加粗/斜体/删除线/**下划线**、引用、代码块、分割线
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
| `uploadImage` | `(file: File) => Promise<string \| null>` | — | 图片上传函数,传入后支持上传/粘贴/拖拽 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `dark` | `boolean` | `false` | 暗色模式(组件级独立切换,不依赖全局 class) |
| `extensions` | `Extensions` | 默认扩展包 | 自定义 Tiptap 扩展(覆盖默认) |

## 工具栏能力一览

| 分组 | 功能 |
| --- | --- |
| 撤销/重做 | 撤销、重做 |
| 标题 | 正文 / H1-H4 |
| 格式化 | 加粗、斜体、删除线、**下划线** |
| 颜色 | **文字颜色**(12 预设色)、**背景高亮**(8 预设色) |
| 对齐 | **左 / 中 / 右 / 两端** |
| 列表 | 无序列表、有序列表、引用、代码块、分割线 |
| 媒体 | 链接、图片上传、表格(网格选择行列) |
| 清理 | **清除格式** |
| Markdown | **导入 `.md` / 导出 `.md`** |
| 气泡菜单 | 选中文字浮现:加粗/斜体/下划线/删除线/链接/清除格式 |

## 架构

项目采用三层架构,UI 无关:

```
packages/
  core/              # UI 无关核心层:封装 Tiptap v3
                    #   useProEditor() composable + 命令聚合 + 图片上传逻辑
  element-plus/      # Element Plus 适配:ProEditorElementPlus 组件 + 工具栏 + 气泡菜单
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
pnpm test           # 运行单元/集成测试(Vitest)
pnpm typecheck      # 全量类型检查
```

要求:Node ≥ 18,pnpm ≥ 9。

## 测试

core 层用 [Vitest](https://vitest.dev) + `@vue/test-utils` 覆盖,挂载**真实 Tiptap 编辑器**(非 mock)验证每个命令的产出,确保功能可用而非纸面声明:

- `handleImageUpload.test.ts` — 图片文件判定、粘贴/拖拽批量上传调度(含失败不中断)
- `extensions.test.ts` — 默认扩展包完整性(漏配扩展会让命令静默失效)
- `useProEditor.test.ts` — 所有命令产出真实 HTML(bold/heading/link/taskList/color/align…),v-model 双向绑定,JSON 模式去重,字数统计,Markdown 导入导出,只读切换

```bash
pnpm test           # 单次运行
pnpm -F tiptap-vue-pro-core test:watch   # watch 模式
```

> 注:element-plus 适配层(工具栏/弹窗等 UI 组件)的组件级测试尚未覆盖;core 层逻辑已全测。



> 🚀 **在线 Demo**:`playground/` 会在 push 到 main 时通过 GitHub Actions 自动构建并部署到
> <https://twoer.github.io/tiptap-vue-pro/>(见 `.github/workflows/deploy.yml`)。
> 首次使用需在仓库 Settings → Pages → Source 选择「GitHub Actions」。

## 功能路线

### 已完成 ✅

- [x] 基础工具栏 + 格式化(加粗/斜体/删除线/下划线)
- [x] 文字颜色 / 背景高亮(预设色板)
- [x] 文本对齐(左/中/右/两端)
- [x] 清除格式
- [x] 气泡菜单(BubbleMenu)
- [x] 图片上传(上传/粘贴/拖拽)
- [x] 链接、表格(网格选择器)、代码块
- [x] **任务列表**(TaskList)
- [x] **暗色模式**(组件级)
- [x] **链接编辑器换为 Dialog**
- [x] **Markdown 导入 / 导出**(工具栏按钮,基于官方 `@tiptap/markdown`)
- [x] Element Plus 适配
- [x] 在线 Demo(GitHub Pages 自动部署)

### 进行中 / 计划 🚧

- [ ] 图片尺寸调整 / 对齐
- [ ] 视频嵌入
- [ ] Slash command(/)
- [ ] Mention / 文件附件
- [ ] Naive UI 适配
- [ ] Nuxt 支持

## License

[MIT](./LICENSE)

## 致谢

- [Tiptap](https://tiptap.dev) — 强大的 headless 富文本编辑器框架
- [ProseMirror](https://prosemirror.net) — Tiptap 的底层引擎
- [Element Plus](https://element-plus.org) — Vue3 组件库
