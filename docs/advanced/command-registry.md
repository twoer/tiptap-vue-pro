# 命令注册表

命令注册表把内置工具栏按钮和 Core 命令连接起来。它主要服务于自定义工具栏、审计按钮能力和保持三套 Adapter 行为对等。

```ts
import {
  getCommandLabel,
  isToolbarCommandActive,
  runToolbarCommand,
  type ToolbarBuiltinKey,
} from 'tiptap-vue-pro-core'

const id: ToolbarBuiltinKey = 'bold'

console.log(getCommandLabel(id))
runToolbarCommand(ctx, id)
console.log(isToolbarCommandActive(ctx, id))
```

## 常见用途

| 用途 | API |
| --- | --- |
| 读取按钮文案 | `getCommandLabel(id)` |
| 执行内置命令 | `runToolbarCommand(ctx, id, payload)` |
| 判断按钮激活态 | `isToolbarCommandActive(ctx, id, payload)` |
| 获取 heading 当前层级 | `getActiveHeadingLevel(ctx)` |
| 获取当前对齐方式 | `getActiveTextAlign(ctx)` |

部分按钮是复合 UI,例如链接弹窗、图片上传、表格网格、Markdown 导入导出、打印、预览、全屏。这些按钮没有简单的 `execute`,由 Adapter 负责渲染对应交互。

## 和自绘工具栏的关系

如果你只是想复用内置命令,可以直接调用 `ctx.commands`。如果你想根据按钮 id 动态渲染一套工具栏,再使用命令注册表读取文案、激活态和执行函数。
