# 工具栏

`toolbar` prop 用二维数组描述内置按钮分组。数组顺序就是渲染顺序。

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
  <ProEditorElementPlus v-model="content" :toolbar="toolbar">
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

| 分组 | 功能 |
| --- | --- |
| 历史 | 撤销、重做 |
| 段落与字体 | 正文 / H1-H6、字体、字号、行高 |
| 行内格式 | 加粗、斜体、下划线、删除线、行内代码、上标、下标 |
| 颜色与清理 | 文字颜色、背景高亮、清除格式 |
| 对齐与缩进 | 左 / 中 / 右 / 两端、减少缩进、增加缩进 |
| 列表与块 | 无序列表、有序列表、任务列表、引用、代码块语言选择 |
| 插入 | 链接、图片(上传 / 网络图片,按配置合并)、附件上传、表格、分割线样式 |
| 文档工具 | Markdown 导入 / 导出、打印 |
| 视图 | 预览、全屏 |

## 分割线样式

内置 `hr` 按钮会渲染为下拉菜单,可插入实线、粗线、虚线、点线。自定义工具栏也可以直接传入样式:

```ts
ctx.commands.hr('solid')
ctx.commands.hr('thick')
ctx.commands.hr('dashed')
ctx.commands.hr('dotted')
```

样式会保存在 HTML/JSON 中;Markdown 导出会按标准语法降级为普通 `---`。
