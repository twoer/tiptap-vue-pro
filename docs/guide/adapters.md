# 三套 Adapter

项目提供三个开箱即用 Adapter:

| 包 | 组件 | UI 库 |
| --- | --- | --- |
| `tiptap-vue-pro-element-plus` | `ProEditorElementPlus` | Element Plus |
| `tiptap-vue-pro-naive` | `ProEditorNaive` | Naive UI |
| `tiptap-vue-pro-ant-design-vue` | `ProEditorAntDesignVue` | Ant Design Vue |

三套 Adapter 的 props、slots、配置对象保持对等。业务里切换 UI 库时,主要替换组件名、样式入口和 UI 库依赖。

::: code-group

```vue [Element Plus]
<ProEditorElementPlus
  v-model="content"
  :toolbar="toolbar"
  :toolbar-options="toolbarOptions"
  :editor-behavior-options="editorBehaviorOptions"
/>
```

```vue [Naive UI]
<ProEditorNaive
  v-model="content"
  :toolbar="toolbar"
  :toolbar-options="toolbarOptions"
  :editor-behavior-options="editorBehaviorOptions"
/>
```

```vue [Ant Design Vue]
<ProEditorAntDesignVue
  v-model="content"
  :toolbar="toolbar"
  :toolbar-options="toolbarOptions"
  :editor-behavior-options="editorBehaviorOptions"
/>
```

:::

## 边界

共享编辑器行为放在 `tiptap-vue-pro-core`;弹窗、菜单、提示、样式和组件渲染放在各 Adapter。这样可以保持三套 UI 体验对等,同时不把某个 UI 库的组件名或 CSS 变量泄漏到另一个 Adapter。

## 怎么选择

| 你的项目 | 推荐 |
| --- | --- |
| 已经使用 Element Plus | `tiptap-vue-pro-element-plus` |
| 已经使用 Naive UI | `tiptap-vue-pro-naive` |
| 已经使用 Ant Design Vue | `tiptap-vue-pro-ant-design-vue` |
| 想完全自定义工具栏和弹窗 | `tiptap-vue-pro-core` |

如果团队内部同时有多套 UI 库,建议把业务层的 `toolbar`、`toolbarOptions`、`editorBehaviorOptions` 配置抽成共享对象,不同项目只替换 Adapter 组件。
