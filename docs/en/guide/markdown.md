# Markdown

Markdown import/export is exposed through the toolbar menu and Core commands.

| Entry | Behavior |
| --- | --- |
| Toolbar Markdown menu | Import from a selected `.md` file or export the current content |
| `ctx.importMarkdown(md)` | Import Markdown content directly |
| `ctx.getMarkdown()` | Export the current content as Markdown |

`toolbarOptions.markdown` controls file picker accept rules and export filename:

```ts
const toolbarOptions: ToolbarOptions = {
  markdown: {
    importAccept: '.md,.markdown,text/markdown,text/plain',
    exportFilename: () => `doc-${Date.now()}.md`,
  },
}
```

Markdown is a lossy format. Some HTML styling and layout features, such as font family, font size, line height, indent, table column widths, and custom attachment card metadata, may not round-trip perfectly. Use HTML or JSON output when you need complete fidelity.
