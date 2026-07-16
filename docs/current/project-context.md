# Project Context

Status: active

Tiptap Vue Pro is a Vue 3 rich text editor component library built on Tiptap v3
and ProseMirror. It is not an official Tiptap project.

## Product Shape

The repository ships one UI-free core package and three ready-to-use UI
adapters:

| Package | Role |
| --- | --- |
| `tiptap-vue-pro-core` | Headless editor behavior, Tiptap extensions, commands, upload helpers, diagnostics, and type contracts |
| `tiptap-vue-pro-element-plus` | Element Plus adapter and styles |
| `tiptap-vue-pro-naive` | Naive UI adapter and styles |
| `tiptap-vue-pro-ant-design-vue` | Ant Design Vue adapter and styles |
| `playground` | Local demo and release demo surface |
| `docs` | VitePress documentation site |

## Current Capability Baseline

- Toolbar formatting, headings, lists, alignment, color, highlight, links,
  images, tables, horizontal rules, Markdown import/export, print, preview, and
  fullscreen.
- Find/Replace with replace-current, replace-all, case-sensitive search, and
  pinned panel controls.
- Image upload, paste, drag/drop, upload-time crop, replacement, alignment,
  resizing, and captions.
- Video, audio, and file attachment insertion and rendering.
- Table insertion, row/column grips, range selection, movement, merge/split,
  header toggles, and table deletion.
- Developer diagnostics for core behavior and adapter UI flows.
- Three adapter packages are expected to stay behaviorally aligned.

## Runtime And Tooling

- Package manager: `pnpm@10.32.1`.
- Node engine: `>=18`.
- Root scripts provide workspace-level development, docs, build, typecheck,
  tests, and table browser regression checks.

## Source Documents

- Product README: `README.md`
- Adapter boundary rules: `AGENTS.md`
- Architecture docs: `docs/advanced/architecture.md`
- Feature gap and priority notes: `docs/feature-gap-analysis.md`
- Detailed feature plans: `docs/plans/*.md`
