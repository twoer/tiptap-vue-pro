# ToolbarOptions

`ToolbarOptions` controls toolbar menu data and action parameters.

```ts
interface ToolbarOptions {
  fontFamilies?: ToolbarFontFamilyOption[]
  fontSizes?: string[]
  lineHeights?: string[]
  colors?: string[]
  highlights?: string[]
  codeBlockLanguages?: ToolbarCodeBlockLanguageOption[]
  horizontalRules?: ToolbarHorizontalRuleOption[]
  tableGrid?: ToolbarTableGridOptions
  markdown?: ToolbarMarkdownOptions
  print?: ToolbarPrintOptions
}
```

## Fonts

```ts
const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: 'Default', value: '' },
    { label: 'PingFang', value: 'PingFang SC' },
    { label: 'LXGW WenKai', value: '"LXGW WenKai"' },
  ],
  fontSizes: ['', '12px', '14px', '16px', '18px', '24px', '32px'],
  lineHeights: ['', '1', '1.5', '1.75', '2'],
}
```

## Palettes

```ts
const toolbarOptions: ToolbarOptions = {
  colors: ['#111827', '#2563eb', '#16a34a', '#dc2626'],
  highlights: ['#fef3c7', '#dcfce7', '#dbeafe'],
}
```

## Code Block Languages

```ts
const toolbarOptions: ToolbarOptions = {
  codeBlockLanguages: [
    { label: 'Plain Text', value: 'plaintext' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
}
```

## Divider Styles

`horizontalRules` controls which styles appear in the Divider dropdown. Built-in styles are `solid`, `thick`, `dashed`, and `dotted`.

```ts
const toolbarOptions: ToolbarOptions = {
  horizontalRules: [
    { label: 'Solid', value: 'solid' },
    { label: 'Thick', value: 'thick' },
    { label: 'Dashed', value: 'dashed' },
    { label: 'Dotted', value: 'dotted' },
  ],
}
```

Divider styles are preserved in HTML/JSON, for example `<hr data-hr-variant="dashed">`. Standard Markdown has no divider style syntax, so Markdown export falls back to a plain `---`.

## Table, Markdown, and Print

```ts
const toolbarOptions: ToolbarOptions = {
  tableGrid: { maxRows: 12, maxCols: 12 },
  markdown: {
    importAccept: '.md,.markdown,text/markdown,text/plain',
    exportFilename: () => `doc-${Date.now()}.md`,
  },
  print: {
    title: 'Print document',
    cleanupDelay: 500,
  },
}
```
