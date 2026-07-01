# Why Use It

Using Tiptap directly is not hard. The hard part is turning an editor into something business users can rely on:

- The toolbar needs to understand selection state, disabled state, and active state.
- Links, images, tables, Markdown, and attachments all need dialogs, menus, file pickers, and feedback.
- Images need more than URL insertion: upload, paste, drag/drop, replacement, sizing, alignment, and captions all matter.
- If your team uses multiple UI libraries, the same editor behavior should stay consistent across them.

Tiptap Vue Pro packages this repeated work into Core and Adapters:

| Layer | Responsibility |
| --- | --- |
| `tiptap-vue-pro-core` | Tiptap extensions, command aggregation, Markdown, image upload scheduling, behavior options |
| UI Adapter | Toolbar, dialogs, dropdowns, messages, bubble menus, styles |
| Playground | Feature comparison, manual QA, online demo |

## Good Fit

- Vue 3 back offices, CMS systems, knowledge bases, and operation consoles that need rich text input.
- Business systems already using Element Plus, Naive UI, or Ant Design Vue.
- Component libraries or internal platforms that need one editor behavior model across multiple UI stacks.
- Advanced use cases where you want custom UI on top of reusable Tiptap commands, extensions, Markdown, and upload logic.

## Not a Good Fit

- Apps that only need a lightweight textarea or Markdown editor.
- Products that need Google Docs-level collaboration, comments, review, and revision history.
- Editors that intentionally avoid the Tiptap / ProseMirror data model.

## Boundary With Tiptap

Tiptap remains the underlying editor engine. This project provides Vue component packaging and product-oriented defaults. You can still use Tiptap extensions, ProseMirror plugins, and JSON/HTML output.
