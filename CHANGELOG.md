# Changelog

中文: [CHANGELOG.zh-CN.md](./CHANGELOG.zh-CN.md)

## 0.2.6 - 2026-09-06

### Added

- **Math formulas (KaTeX)**: new `mathInline` / `mathBlock` nodes with `$...$` and `$$...$$` input rules, slash `/公式`, and a toolbar ∑ entry. Selecting a formula opens a bubble menu plus an edit dialog with live preview, block/inline kind switching, and a collapsible syntax cheatsheet; the insert flow opens the dialog first so nothing lands in the document until confirmed. Block formulas round-trip through Markdown as `$$` blocks; inline formulas export as `$latex$` source. Print copies inline formulas as native MathML (self-contained, no KaTeX CSS/fonts needed) and adapters ship a `./katex.css` style entry with fonts.
- **Print / PDF export pipeline**: the single 打印 (print) button now explicitly serves PDF export too (browsers expose no silent PDF API; the print dialog is the export channel). Mermaid source blocks are rendered to SVG before printing via the new `inlineMermaidSvg()` (`printEditorContent` is now async; failed renders keep the source as fallback). Print styles gained `@page` A4 size and margins, background preservation, keep-together rules for headings/table rows/code blocks/blockquotes, and task-list checkbox layout. The compact "more" menu print button, previously a no-op, now routes to the print handler.

### Fixed

- **Table row/column grips**: grips are positioned with viewport coordinates on `position: fixed`, but an ancestor with `transform` / `filter` / `contain: layout paint` / `will-change: transform` becomes the containing block for fixed descendants per the CSS spec — silently replacing the coordinate origin and shifting all grips by that ancestor's page offset. The overlay engine now detects the nearest fixed containing block (`findFixedContainingBlock`) and converts viewport coordinates accordingly, so grips stay aligned under any host layout. Covered by a new grip-alignment e2e smoke (`pnpm test:table-grip:e2e`) whose second phase re-injects `contain` to guard the conversion.
- **Print hardening**: the `print.title` option is HTML-escaped before being embedded into the print iframe `srcdoc` (prevents injection from dynamic titles such as document names), and `print()` failures inside the iframe `onload` no longer throw uncaught errors in headless environments.

## 0.2.5 - 2026-09-06

### Fixed

- **ant-design-vue**: the adapter previously shipped Element Plus colors; it now uses the real antd palette (primary `#1677ff` everywhere, antd grays and dark-mode tokens). Dropdown items with `divided` now render a real menu divider instead of turning red, and an undefined `--tvp-ant-primary-color` variable (typo of `--tvp-ant-color-primary`) is fixed.
- **i18n**: the slash command menu and the element-plus/ant toolbar dropdowns now render through the editor locale for `en-US` (Chinese text unchanged); the image caption placeholder follows the editor locale. The serialized attachment `Download` title intentionally stays locale-independent (it is part of the document HTML).
- **core**: an internal v-model sync flag could get stuck after an unchanged content emit and silently swallow the next external content update; printing now uses `iframe.srcdoc` instead of the deprecated `document.write`, with idempotent cleanup that can no longer leak iframes.

### Changed

- Performance: debug instrumentation no longer allocates per keystroke — shared frozen option shapes, a 1s TTL cache for the localStorage table-grip debug toggle (new `refreshDebugOptionsCache()`), and a single logger instance.
- Internal: `useProEditor.ts` reorganized into `tableController` / `mediaInsertion` / `findReplaceCommands` (public API unchanged) and ~1,700 lines of cross-adapter duplication moved into core headless modules; uniform toolbar buttons are driven from a core registry.

### Added

- New headless exports: `useTableGripOverlay`, `isSupportedLinkUrl`, `shouldShowTextBubbleMenu`, `clampFloatingMenuLeft`/`getViewportWidth`, `refreshDebugOptionsCache`, and `TOOLBAR_SIMPLE_BUTTON_DEFS`/`buildSimpleToolbarButtons`.
- Tooling: eslint with a CI error gate, adapter-boundary checks in CI, changesets (fixed-group versioning), and self-contained Playwright e2e with a table smoke job in CI (8/8 scripts green across all three adapters).

## 0.2.2 - 2026-08-20

### Fixed

- Pinned Tiptap runtime dependencies to the compatible `3.27.1` release so fresh npm installations do not mix incompatible Tiptap versions.

## 0.2.1 - 2026-08-20

### Added

- Added an optional compact toolbar layout via `toolbarLayout="compact"`, moving lower-frequency actions into More formatting, Lists and indent, Insert, and More menus.
- Added compact toolbar parity across all three adapters while preserving the classic layout as the default.
- Added package compatibility checks covering ESM, CommonJS, TypeScript, SSR, and packed export artifacts.

## 0.2.0 - 2026-08-10

### Added

- Added opt-in Autosave with debouncing, serialized requests, latest-content-wins behavior, explicit retry, status events, and best-effort unmount flushing.
- Added versioned local draft recovery with expiry validation, SSR-safe browser storage, explicit Restore/Delete actions, and protection against stale async results.
- Added equivalent Autosave and draft recovery UI to the Element Plus, Naive UI, and Ant Design Vue adapters, including responsive and dark-mode states.
- Added Chinese and English Autosave/local draft guides plus end-to-end browser coverage for retry, recovery, persistence, and mobile layout.

### Changed

- Moved image URL toolbar state into a shared headless core controller while preserving each adapter's native UI components.
- Prevented successful older saves from deleting a newer local draft and preserved discovered historical drafts until users explicitly restore or delete them.

## 0.1.9 - 2026-08-09

### Added

- Added standalone Mermaid blocks to the Element Plus, Naive UI, and Ant Design Vue adapters, with code, diagram, and split views.
- Added safe lazy Mermaid rendering with syntax validation, stale-render protection, strict security mode, and responsive mobile behavior.
- Added shared headless controllers for image cropping, resource inputs, link editing, Markdown actions, printing, and Find/Replace state.

### Changed

- Aligned Mermaid view controls and preview editing actions across all three adapters, including button sizing, icon centering, spacing, dark mode, and responsive layouts.
- Reduced duplicated Toolbar script logic across the three adapters by 895 lines while keeping each adapter's native UI components and styling boundaries.
- Added CI quality gates for package builds, typechecking, unit tests, and documentation deployment.
- Expanded upload diagnostics for paste, drop, and image crop flows.

### Fixed

- Fixed editor content-area height behavior.
- Fixed media bubble menus failing to follow the selected node while scrolling.

## 0.1.8 - 2026-08-08

### Added

- Added contextual code block toolbars to the Element Plus, Naive UI, and Ant Design Vue adapters, with language switching and one-click code copying.
- Expanded the default syntax-highlighting menu to 17 languages: Plain Text, JavaScript, TypeScript, HTML / Vue, CSS, JSON, Python, Java, C, C++, C#, Go, Rust, Bash, SQL, YAML, and Markdown.
- Added recognizable language icons to toolbar and contextual language menus, with a generic fallback for custom entries.

### Changed

- Aligned code menu spacing, row height, icon sizing, and dark-mode states across all three adapters.
- Added third-party attribution for the language icon artwork distributed by the core package.
