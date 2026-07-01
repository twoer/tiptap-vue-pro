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

Markdown cannot represent every HTML styling detail. Font family, font size, line height, indent, alignment details, and rich attachment metadata may be simplified or lost. Use HTML / JSON output when fidelity matters.

## What is the difference between `toolbar` and `toolbarOptions`?

`toolbar` controls which buttons exist, how they are grouped, and their order. `toolbarOptions` controls the data behind those buttons, such as font lists, color palettes, divider styles, and Markdown export filename.
