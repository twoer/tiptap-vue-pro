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
  horizontalRules?: ToolbarHorizontalRuleOption[]
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

默认菜单包含 17 种语言:Plain Text、JavaScript、TypeScript、HTML / Vue、CSS、JSON、Python、Java、C、C++、C#、Go、Rust、Bash、SQL、YAML 和 Markdown。工具栏菜单与代码块上下文菜单共用这份配置。

传入 `codeBlockLanguages` 会替换默认列表。`value` 必须是当前 lowlight 实例已经注册的语言名;已知语言会显示对应图标,没有内置图标时使用通用代码图标。

```ts
const toolbarOptions: ToolbarOptions = {
  codeBlockLanguages: [
    { label: 'Plain Text', value: 'plaintext' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
  ],
}
```

## 分割线样式

`horizontalRules` 控制工具栏中「分割线」下拉菜单显示哪些样式。内置样式为 `solid`、`thick`、`dashed`、`dotted`。

```ts
const toolbarOptions: ToolbarOptions = {
  horizontalRules: [
    { label: '实线', value: 'solid' },
    { label: '粗线', value: 'thick' },
    { label: '虚线', value: 'dashed' },
    { label: '点线', value: 'dotted' },
  ],
}
```

分割线样式会写入 HTML/JSON,例如 `<hr data-hr-variant="dashed">`。Markdown 标准语法不包含分割线样式,导出 Markdown 时会降级为普通 `---`。

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
