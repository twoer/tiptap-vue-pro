# Work Map

Status: active

Use this map to keep changes inside the right ownership boundary.

## Ownership

| Area | Owns | Should Not Own |
| --- | --- | --- |
| `packages/core` | Editor behavior, commands, Tiptap extensions, shared types, Markdown, uploads, diagnostics, and UI-free helpers | UI library components, adapter popovers, dropdowns, dialogs, toasts, or library-specific styles |
| `packages/element-plus` | Element Plus rendering, messages, dialogs, dropdowns, toolbar UI, adapter CSS | Naive UI or Ant Design Vue component names, selectors, or variables |
| `packages/naive` | Naive UI rendering, messages, dialogs, dropdowns, toolbar UI, adapter CSS | Element Plus or Ant Design Vue component names, selectors, or variables |
| `packages/ant-design-vue` | Ant Design Vue rendering, messages, modals, dropdowns, toolbar UI, adapter CSS | Element Plus or Naive UI component names, selectors, or variables |
| `playground` | Local verification surface and online demo wiring | Shared editor behavior that belongs in core |
| `docs` | User-facing docs, API docs, examples, and project planning artifacts | Source of runtime behavior |

## Adapter Boundary Rules

- Shared editor behavior belongs in `packages/core`.
- UI rendering, dialogs, dropdowns, messages, upload inputs, and visual styling
  belong in the adapter package.
- Adapter code must use the target UI library's components and naming.
- Adapter-local CSS variables should be named for the adapter, for example
  `--tvp-ant-*` in the Ant Design Vue adapter.
- Menu items with icon and text use a consistent 6px gap across adapters.
- Menu labels should avoid repeating context already shown by the trigger or
  parent menu.

## Common Change Routes

| Change Type | Usual Route |
| --- | --- |
| New editor command or document behavior | `packages/core` first, then adapter UI if users need controls |
| Adapter-only UI behavior | Target adapter package only, mirrored to other adapters if behavior must stay equivalent |
| Cross-adapter toolbar/menu feature | Core command or metadata, then all three adapters, then docs and playground |
| New public prop | Core type contract if shared, adapter prop passthrough, package docs, root docs |
| Browser-visible behavior | Code plus playground or browser regression coverage |
| Public documentation | Chinese docs in `docs/`, English docs in `docs/en/`, README files when package-level usage changes |
