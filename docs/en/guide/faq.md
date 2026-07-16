# FAQ

## Is this an official Tiptap project?

No. This project is a community package built on Tiptap v3 + Vue 3. Tiptap core still follows its own license and ecosystem conventions.

## Why wrap it with `<ClientOnly>` in Nuxt?

Tiptap depends on browser-side editing APIs. Core already defaults to `immediatelyRender: false`, but ready-made UI components still depend on client-side UI library behavior. `<ClientOnly>` keeps SSR output predictable.

## Why is image upload not triggered?

Check these points:

1. Whether `uploadImage` is passed to the component.
2. Whether the selected file is an image.
3. If file type is restricted, whether `editorBehaviorOptions.image.accept` includes the current file MIME type or extension.
4. If file size is restricted, whether the image exceeds `editorBehaviorOptions.image.maxSize`.

## Why does Markdown export lose styles?

Markdown cannot represent every HTML styling detail. Font family, font size, line height, indent, table column widths, alignment details, and rich attachment metadata may be simplified or lost. Use HTML / JSON output when fidelity matters.

## Does Slash Command affect Markdown import/export?

No. Slash Command only turns `/query` into normal editor commands while editing, such as inserting a table, task list, or code block. The document still contains regular Tiptap nodes, so Markdown import/export keeps using the existing node semantics.

## Does find/replace affect Markdown import/export?

No. Find/replace only creates temporary match decorations and normal replacement transactions inside the editor. It does not write extra nodes or marks, and decorations are cleared when the panel closes. Markdown import/export keeps using the existing document semantics.

## What is the difference between `toolbar` and `toolbarOptions`?

`toolbar` controls which buttons exist, how they are grouped, and their order. `toolbarOptions` controls the data behind those buttons, such as font lists, color palettes, divider styles, and Markdown export filename.

## Are the three adapters really equivalent?

Shared editing behavior lives in Core, while adapters only render with their own UI library. Element Plus, Naive UI, and Ant Design Vue each keep component tests for high-risk interactions, including Slash Command and find/replace. Table column width dragging, table grips, merge bubbles, and table menu density are covered by `pnpm test:table:e2e`; Slash Command keyboard, click, Escape, and adapter switching are covered by `pnpm test:slash:e2e`; find/replace panel, matching, replacement, and adapter switching are covered by `pnpm test:find-replace:e2e`.
