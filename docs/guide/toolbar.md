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
      <ElButton text @click="ctx.commands.hr()">分割线</ElButton>
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
| 撤销/重做 | 撤销、重做 |
| 标题 | 正文 / H1-H6 |
| 格式化 | 加粗、斜体、删除线、下划线、行内代码、上标、下标 |
| 排版 | 字体、字号、行高、减少缩进、增加缩进 |
| 颜色 | 文字颜色、背景高亮 |
| 对齐 | 左 / 中 / 右 / 两端 |
| 列表 | 无序列表、有序列表、任务列表、引用、代码块语言选择、分割线 |
| 媒体 | 链接、图片上传、表格 |
| 清理 | 清除格式 |
| Markdown | 导入 `.md` / 导出 `.md` |
| 视图 | 预览、全屏、打印 |
