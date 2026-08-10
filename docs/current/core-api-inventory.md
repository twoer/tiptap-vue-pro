# Core API Inventory

Status: active

## Purpose

This inventory records who is expected to consume each public domain exported
from `packages/core/src/index.ts`. It documents the current `0.2.x`
compatibility surface without creating a new package or subpath boundary.

Every symbol currently exported from `packages/core/src/index.ts` remains part
of the compatibility surface during `0.2.x`. A symbol may be useful to both
application consumers and adapter implementations.

## Consumer Public API

| Domain | Source modules | Intended consumers | Compatibility |
| --- | --- | --- | --- |
| Editor lifecycle and context | `useProEditor.ts`, `types.ts` | Applications and adapters creating editor instances | Public during `0.2.x`; keep existing options, commands, and return contracts compatible |
| Locale and diagnostics | `locale.ts`, `debug.ts` | Applications configuring language or diagnostics; adapters rendering shared messages | Public during `0.2.x`; additions should remain optional |
| Behavior options | `editorBehaviorOptions.ts` | Applications configuring links, tables, images, media, and files | Public during `0.2.x`; preserve defaults and accepted option shapes |
| Extension registry | `extensions.ts`, `extensionRegistry.ts`, exported modules under `extensions/` | Applications extending the editor and adapters installing shared extensions | Public during `0.2.x`; avoid changing default behavior without release notes and tests |
| Markdown import and export | `markdown.ts`, `toolbarActions.ts` | Applications and document toolbar implementations | Public during `0.2.x`; preserve serialization and command contracts |
| Autosave and local drafts | `autosave.ts`, `localDraft.ts` | Applications integrating remote persistence and browser draft recovery | Public during `0.2.x`; storage envelopes and failure states require compatibility review |
| Toolbar configuration and commands | `toolbar.ts`, `toolbarConfigData.ts`, `commandRegistry.ts` | Applications customizing toolbars and all three adapters | Public during `0.2.x`; command keys and configuration normalization are compatibility-sensitive |
| Slash command and find/replace | `slashCommand.ts`, `findReplace.ts`, exported extension modules | Applications customizing commands and adapters rendering interaction surfaces | Public during `0.2.x`; preserve IDs, state contracts, and execution behavior |
| Mermaid blocks | `mermaid.ts`, `mermaidRenderer.ts`, `extensions/mermaidBlock.ts` | Applications configuring Mermaid and adapters mounting block views | Public during `0.2.x`; persisted attributes and view modes are compatibility-sensitive |
| Upload, crop, and media | `handleAssetUpload.ts`, `handleImageUpload.ts`, `imageCrop.ts`, exported media extensions | Applications providing upload services and adapter media controls | Public during `0.2.x`; preserve callback and asset metadata contracts |

## Adapter Integration API

Adapter integration exports remain available from the root entry for now. This
section records intent; it does not create `tiptap-vue-pro-core/adapter` or
require adapter import migrations.

| Domain | Source modules | Intended consumers | Compatibility |
| --- | --- | --- | --- |
| Toolbar domain controllers | `toolbarDocumentActions.ts`, `toolbarLinkController.ts`, `toolbarImageUrlController.ts`, `toolbarResourceInputs.ts` | Element Plus, Naive UI, and Ant Design Vue adapters | Root-exported and compatible during `0.2.x`; all adapters should consume equivalent controller behavior |
| Adapter panel state | `findReplacePanel.ts` | Adapter find/replace panels | Root-exported and compatible during `0.2.x`; UI rendering remains adapter-local |
| Selection helpers | `codeBlockSelection.ts`, `linkRange.ts`, `fileAttachmentSelection.ts`, `mediaSelection.ts`, `horizontalRuleSelection.ts` | Adapter toolbars, bubble menus, and inspectors | Root-exported and compatible during `0.2.x`; return shapes drive adapter state |
| Editor integration hooks | `editorEventBridge.ts`, `editorPluginRegistration.ts`, `imageDropPaste.ts` | Adapter component lifecycle and event wiring | Root-exported and compatible during `0.2.x`; keep browser lifecycle cleanup deterministic |
| NodeView controllers | `mermaidCodeEditor.ts`, `mermaidNodeView.ts` | Adapter Mermaid block components | Root-exported and compatible during `0.2.x`; framework-specific UI stays outside core |
| Shared option data | `codeBlock.ts`, `codeBlockLanguageIcon.ts`, `toolbarConfigData.ts` | Applications and adapter menus | Root-exported and compatible during `0.2.x`; IDs and values are persisted or configured externally |

## Internal Implementation

Source modules not exported by `packages/core/src/index.ts` are internal and may
change without a public API guarantee. Current examples include
`markdownManager.ts`, `extensions/blockIndent.ts`,
`extensions/imageNodeView.ts`, `extensions/mediaNodeView.ts`, and
`extensions/rangeSelection.ts`.

An emitted declaration file under `dist/` does not by itself make a source
module public. The package export map exposes only the root entry.

## Compatibility Rules

- Do not remove, rename, or narrow an existing root export during `0.2.x`.
- Add optional fields instead of making existing consumer configuration
  mandatory.
- Keep shared behavior in core and UI-library components, messages, dialogs,
  dropdowns, and styling in their adapter packages.
- Treat persisted document attributes, local draft envelopes, command IDs, and
  toolbar keys as compatibility-sensitive data.
- A future subpath or package split must solve a demonstrated consumer or
  maintenance problem and include a migration path.

## Adding New Exports

Before adding a root export:

1. Decide whether its intended consumer is an application, an adapter, or both.
2. Confirm the implementation belongs in UI-free core rather than an adapter.
3. Add focused runtime and type tests for the public contract.
4. Update this inventory and release documentation.
5. Run the packed-package smoke test so the published entry remains consumable.
