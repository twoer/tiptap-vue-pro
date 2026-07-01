# Adapters

The project ships three ready-to-use adapters:

| Package | Component | UI library |
| --- | --- | --- |
| `tiptap-vue-pro-element-plus` | `ProEditorElementPlus` | Element Plus |
| `tiptap-vue-pro-naive` | `ProEditorNaive` | Naive UI |
| `tiptap-vue-pro-ant-design-vue` | `ProEditorAntDesignVue` | Ant Design Vue |

All three adapters keep their props, slots, and configuration objects equivalent. When switching UI libraries, the main changes are the component name, style entry, and UI library dependency.

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

## Boundaries

Shared editor behavior lives in `tiptap-vue-pro-core`. Dialogs, menus, messages, styles, and component rendering live in each adapter. This keeps the three UI experiences equivalent without leaking one UI library's component names or CSS variables into another adapter.

## Choosing One

| Your project | Recommended package |
| --- | --- |
| Already uses Element Plus | `tiptap-vue-pro-element-plus` |
| Already uses Naive UI | `tiptap-vue-pro-naive` |
| Already uses Ant Design Vue | `tiptap-vue-pro-ant-design-vue` |
| Wants fully custom toolbar and dialogs | `tiptap-vue-pro-core` |

If your organization uses multiple UI libraries, keep business-level `toolbar`, `toolbarOptions`, and `editorBehaviorOptions` as shared objects, and replace only the adapter component in each app.
