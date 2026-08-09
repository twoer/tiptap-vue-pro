# Changelog

中文: [CHANGELOG.zh-CN.md](./CHANGELOG.zh-CN.md)

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
