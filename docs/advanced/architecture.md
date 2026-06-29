# 整体架构

项目采用 Core + Adapter + Playground 的结构。Core 只处理编辑器能力和类型契约,Adapter 只处理 UI 库接入。

```mermaid
flowchart LR
  User["业务项目"] --> Adapter["UI Adapter"]
  Adapter --> Core["tiptap-vue-pro-core"]
  Core --> Tiptap["Tiptap v3"]
  Tiptap --> PM["ProseMirror"]

  Adapter --> EP["Element Plus"]
  Adapter --> Naive["Naive UI"]
  Adapter --> Ant["Ant Design Vue"]
```

## 目录职责

| 目录 | 说明 |
| --- | --- |
| `packages/core` | `useProEditor`、默认扩展、命令聚合、Markdown、图片上传调度、类型契约 |
| `packages/element-plus` | Element Plus 组件、工具栏、弹窗、气泡菜单、样式 |
| `packages/naive` | Naive UI 组件、工具栏、弹窗、气泡菜单、样式 |
| `packages/ant-design-vue` | Ant Design Vue 组件、工具栏、弹窗、气泡菜单、样式 |
| `playground` | 本地调试和在线 Demo |
| `docs` | VitePress 文档站 |

## 工具栏链路

```mermaid
flowchart TD
  ToolbarProp["toolbar"] --> Normalize["normalizeToolbarConfig"]
  Options["toolbarOptions"] --> ResolveOptions["resolveToolbarOptions"]
  Behavior["editorBehaviorOptions"] --> ResolveBehavior["resolveEditorBehaviorOptions"]
  Normalize --> AdapterToolbar["Adapter Toolbar"]
  ResolveOptions --> AdapterToolbar
  ResolveBehavior --> AdapterToolbar
  AdapterToolbar --> Registry["COMMAND_REGISTRY"]
  Registry --> Commands["ctx.commands"]
  Commands --> Editor["Tiptap Editor"]
```

## 扩展链路

```mermaid
flowchart TD
  Config["EditorExtensionConfig"] --> Registry["createEditorExtensions"]
  Registry --> Defaults["createDefaultExtensions"]
  Defaults --> Extensions["Tiptap Extensions"]
  Extensions --> Editor["useProEditor"]
```

## Adapter 边界

Adapter 之间不能互相引用 UI 组件或样式变量。Element Plus 代码只使用 Element Plus,Naive UI 代码只使用 Naive UI,Ant Design Vue 代码只使用 Ant Design Vue。共享行为统一沉到 Core。
