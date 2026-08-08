# AGENTS.md

## Project Rules

### UI Adapter Boundaries

Each package under `packages/*` is an adapter for one UI library. Keep adapter code honest to that library.

- `packages/element-plus` must use Element Plus components and Element Plus naming.
- `packages/naive` must use Naive UI components and Naive UI naming.
- `packages/ant-design-vue` must use Ant Design Vue components and Ant Design Vue naming.
- Do not copy another adapter's component names into a different adapter, even as a compatibility layer. For example, `ElDialog`, `ElButton`, or `.el-*` selectors must not appear in the Naive UI or Ant Design Vue adapter.
- Do not copy another adapter's theme variables into a different adapter. Adapter-local CSS variables should be named after the target adapter, for example `--tvp-ant-*` in the Ant Design Vue adapter.
- If a small wrapper is needed, name it after the target adapter, such as `AntModal`, `AntButton`, or `NaiveMessageBridge`, and implement it with that adapter's UI library.
- Shared editor behavior belongs in `packages/core`; UI rendering, dialogs, dropdowns, messages, and styling belong in the adapter package.
- Any UI element containing an icon and text (including buttons, menu items, dropdown options, and toolbar actions) must use an `inline-flex` or `flex` wrapper with `align-items: center` and a consistent 6px `gap`; before finishing, visually verify that the icon and text have clear horizontal spacing and are vertically centered across all three adapters. Do not use child margins or rely on the icon/text baseline for alignment.
- Element Plus general action dropdowns must use `popper-class="tvp-el-action-dropdown"` so menu items keep the shared 32px minimum height and 12px horizontal padding; use a feature-specific popper class only when the interaction intentionally needs a different density.
- Menu labels should avoid repeating context already conveyed by the trigger icon or parent menu. For example, under the Markdown trigger use `导入` and `导出`, not `导入 Markdown` and `导出 Markdown`.

Before finishing adapter work, run a boundary check:

```bash
rg -n "\\bEl(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Dialog|Input|Popover|ColorPicker|Checkbox|Divider)\\b|element-plus|\\.el-|--el-" packages/naive packages/ant-design-vue
rg -n "\\bN(Button|Tooltip|Dropdown|Input|Modal|ColorPicker|Checkbox|Divider|ConfigProvider|MessageProvider)\\b|naive-ui|\\.n-|--n-" packages/element-plus packages/ant-design-vue
rg -n "\\bAnt(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Modal|Input|Checkbox|Divider|Icon)\\b|ant-design-vue|\\.ant-|--ant-" packages/element-plus packages/naive
```

Intentional mentions in documentation or tests must be clearly explanatory, not implementation dependencies.

### Verification

For adapter changes, run at least:

```bash
pnpm --filter tiptap-vue-pro-core typecheck
pnpm --filter tiptap-vue-pro-<adapter> typecheck
pnpm --filter tiptap-vue-pro-<adapter> test
```

If the playground is touched, also run:

```bash
pnpm --filter playground build
```
