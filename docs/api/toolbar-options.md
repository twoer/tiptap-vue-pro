# ToolbarOptions

`ToolbarOptions` 控制工具栏菜单数据和动作参数。

```ts
interface ToolbarOptions {
  fontFamilies?: ToolbarFontFamilyOption[]
  fontSizes?: string[]
  lineHeights?: string[]
  colors?: string[]
  highlights?: string[]
  codeBlockLanguages?: ToolbarCodeBlockLanguageOption[]
  tableGrid?: ToolbarTableGridOptions
  markdown?: ToolbarMarkdownOptions
  print?: ToolbarPrintOptions
}
```

## 字体

```ts
const toolbarOptions: ToolbarOptions = {
  fontFamilies: [
    { label: '默认字体', value: '' },
    { label: '苹方', value: 'PingFang SC' },
    { label: '霞鹜文楷', value: '"LXGW WenKai"' },
  ],
  fontSizes: ['', '12px', '14px', '16px', '18px', '24px', '32px'],
  lineHeights: ['', '1', '1.5', '1.75', '2'],
}
```

## 色板

```ts
const toolbarOptions: ToolbarOptions = {
  colors: ['#111827', '#2563eb', '#16a34a', '#dc2626'],
  highlights: ['#fef3c7', '#dcfce7', '#dbeafe'],
}
```

## 代码块语言

```ts
const toolbarOptions: ToolbarOptions = {
  codeBlockLanguages: [
    { label: 'Plain Text', value: 'plaintext' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
}
```

## 表格、Markdown、打印

```ts
const toolbarOptions: ToolbarOptions = {
  tableGrid: { maxRows: 12, maxCols: 12 },
  markdown: {
    importAccept: '.md,.markdown,text/markdown,text/plain',
    exportFilename: () => `doc-${Date.now()}.md`,
  },
  print: {
    title: '文档打印',
    cleanupDelay: 500,
  },
}
```
