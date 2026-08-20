# 工具栏

`toolbar` prop 用二维数组描述内置按钮分组。数组顺序就是渲染顺序。

`toolbarLayout` 控制呈现密度。默认 `classic` 保持历史版本的全部展开布局;设置为 `compact` 后,常用格式保留在主工具栏,低频操作进入“更多格式”“列表与缩进”“插入”“更多”菜单。命令能力和 `toolbar` 配置不会丢失。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus'
import { ProEditorElementPlus, type ToolbarConfig } from 'tiptap-vue-pro-element-plus'

const content = ref('<p>hello world</p>')
const toolbar: ToolbarConfig = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['link', 'image'],
]
</script>

<template>
  <ProEditorElementPlus v-model="content" :toolbar="toolbar" toolbar-layout="compact">
    <template #toolbar-after="{ ctx }">
      <ElButton text @click="ctx.commands.hr('dashed')">虚线</ElButton>
    </template>
  </ProEditorElementPlus>
</template>
```

传 `:toolbar="false"` 可以隐藏所有内置按钮。需要完全自绘时使用 `toolbar` slot:

```vue
<ProEditorElementPlus v-model="content">
  <template #toolbar="{ ctx }">
    <div class="my-toolbar">
      <button @click="ctx.commands.bold()">Bold</button>
      <button @click="ctx.commands.setImage('https://example.com/a.png')">Image</button>
    </div>
  </template>
</ProEditorElementPlus>
```

## 插槽

| 插槽 | 说明 |
| --- | --- |
| `toolbar` | 完全替换内置工具栏 |
| `toolbar-before` | 插入到内置工具栏按钮前 |
| `toolbar-after` | 插入到内置工具栏按钮后 |

## 内置按钮

compact 布局仍让代码块语言和表格网格选择器保持独立入口;图片上传/网络图片、视频/文件、四种分割线以及 Markdown 导入/导出会在对应菜单中展开。桌面端只在操作组边界换行,移动端保持单行横向滚动。

| 分组 | 功能 |
| --- | --- |
| 历史 | 撤销、重做 |
| 段落与字体 | 正文 / H1-H6、字体、字号、行高 |
| 行内格式 | 加粗、斜体、下划线、删除线、行内代码、上标、下标 |
| 颜色与清理 | 文字颜色、背景高亮、清除格式 |
| 对齐与缩进 | 左 / 中 / 右 / 两端、减少缩进、增加缩进 |
| 列表与块 | 无序列表、有序列表、任务列表、引用、代码块语言选择与语法高亮 |
| 插入 | 链接、图片(上传 / 网络图片,按配置合并)、附件上传、表格、分割线样式 |
| 文档工具 | Markdown 导入 / 导出、打印 |
| 视图 | 预览、全屏 |

## 代码块

工具栏中的代码按钮会打开语言菜单,用于插入代码块或切换当前代码块的语言。光标进入代码块后,代码块上方还会显示上下文工具栏,可以直接切换语言或复制完整代码内容。Element Plus、Naive UI 和 Ant Design Vue 三套 Adapter 的行为一致。

默认提供 17 个选项:Plain Text、JavaScript、TypeScript、HTML / Vue、CSS、JSON、Python、Java、C、C++、C#、Go、Rust、Bash、SQL、YAML 和 Markdown。菜单和当前语言标签会显示对应语言图标;自定义语言没有内置图标时会回退为通用代码图标。

语言菜单可以通过 [`toolbarOptions.codeBlockLanguages`](/api/toolbar-options#代码块语言) 替换。

## 分割线样式

内置 `hr` 按钮会渲染为下拉菜单,可插入实线、粗线、虚线、点线。自定义工具栏也可以直接传入样式:

```ts
ctx.commands.hr('solid')
ctx.commands.hr('thick')
ctx.commands.hr('dashed')
ctx.commands.hr('dotted')
```

样式会保存在 HTML/JSON 中;Markdown 导出会按标准语法降级为普通 `---`。
