# Verification

Status: active

Choose the smallest lane that covers the changed surface. Record skipped checks
in handoff or final notes when they would normally apply.

## Baseline Commands

```bash
pnpm typecheck
pnpm test
pnpm build
```

Use the full baseline before release-level handoff or after broad cross-package
changes.

## Focused Package Checks

Core changes:

```bash
pnpm --filter tiptap-vue-pro-core typecheck
pnpm --filter tiptap-vue-pro-core test
```

Adapter changes:

```bash
pnpm --filter tiptap-vue-pro-core typecheck
pnpm --filter tiptap-vue-pro-<adapter> typecheck
pnpm --filter tiptap-vue-pro-<adapter> test
```

Replace `<adapter>` with `element-plus`, `naive`, or `ant-design-vue`.

Playground changes:

```bash
pnpm --filter playground build
```

Docs changes:

```bash
pnpm docs:build:site
```

Table browser regression:

```bash
pnpm test:table:e2e
```

Find/Replace browser regression:

```bash
pnpm test:find-replace:e2e
```

Image crop browser regression:

```bash
pnpm test:image-crop:e2e
```

## Adapter Boundary Check

Run this before finishing adapter work:

```bash
rg -n "\\bEl(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Dialog|Input|Popover|ColorPicker|Checkbox|Divider)\\b|element-plus|\\.el-|--el-" packages/naive packages/ant-design-vue
rg -n "\\bN(Button|Tooltip|Dropdown|Input|Modal|ColorPicker|Checkbox|Divider|ConfigProvider|MessageProvider)\\b|naive-ui|\\.n-|--n-" packages/element-plus packages/ant-design-vue
rg -n "\\bAnt(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Modal|Input|Checkbox|Divider|Icon)\\b|ant-design-vue|\\.ant-|--ant-" packages/element-plus packages/naive
```

Intentional mentions in docs or tests must be explanatory, not implementation
dependencies.

## Documentation Sanity Checks

```bash
rg -n "T[O]DO|F[I]XME|[P]rompt|[C]laude|本地路[径]|/U[s]ers/" docs/current README.md README.en-US.md
git diff --check
```

Use these before handing off documentation or external-facing writing.
