# 更新日志

English: [CHANGELOG.md](./CHANGELOG.md)

## 0.2.1 - 2026-08-20

### 新增

- 新增可选紧凑工具栏布局,通过 `toolbarLayout="compact"` 将低频操作收纳到“更多格式”“列表与缩进”“插入”和“更多”菜单中。
- 三套 Adapter 对等支持紧凑工具栏,并保留经典布局作为默认行为。
- 新增发布包兼容性检查,验证 ESM、CommonJS、TypeScript、SSR 和打包产物导出。

## 0.2.0 - 2026-08-10

### 新增

- 新增可选 Autosave,支持防抖、串行请求、latest-content-wins、显式重试、状态事件和卸载时 best-effort flush。
- 新增版本化本地草稿恢复,支持过期校验、SSR 安全浏览器存储、显式恢复/删除及异步过期结果保护。
- Element Plus、Naive UI 和 Ant Design Vue 三套 Adapter 新增对等的 Autosave 与草稿恢复 UI,覆盖响应式和暗色模式。
- 新增中英文 Autosave/本地草稿指南,并补充重试、恢复、持久化和移动端布局的浏览器端到端测试。

### 调整

- 将图片 URL 工具栏状态抽取到共享 headless core controller,同时保持各 Adapter 使用原生 UI 组件。
- 防止较旧的远端保存成功后误删较新的本地草稿,并在用户显式恢复或删除前保留已发现的历史草稿。

## 0.1.9 - 2026-08-09

### 新增

- Element Plus、Naive UI 和 Ant Design Vue 三套 Adapter 新增独立 Mermaid 块,支持代码、图表和分屏三种视图。
- Mermaid 渲染支持语法校验、过期结果保护、严格安全模式、按需加载和移动端响应式布局。
- core 新增图片裁剪、资源输入、链接编辑、Markdown/打印动作及 Find/Replace 状态等 headless controller。

### 调整

- 统一三套 Adapter 的 Mermaid 视图按钮和预览编辑操作,包括按钮尺寸、图标居中、间距、暗色模式和响应式布局。
- 在保持三套 UI 原生组件与样式边界的前提下,减少 895 行重复 Toolbar 脚本逻辑。
- CI 新增包构建、类型检查、单元测试和文档部署质量门禁。
- 补充粘贴、拖拽和图片裁剪流程的上传诊断。

### 修复

- 修复编辑器内容区高度表现。
- 修复滚动时媒体气泡菜单未跟随选中节点的问题。

## 0.1.8 - 2026-08-08

### 新增

- Element Plus、Naive UI 和 Ant Design Vue 三套 Adapter 新增代码块上下文工具栏,支持切换语言和一键复制代码。
- 默认语法高亮菜单扩展为 17 种语言:Plain Text、JavaScript、TypeScript、HTML / Vue、CSS、JSON、Python、Java、C、C++、C#、Go、Rust、Bash、SQL、YAML 和 Markdown。
- 工具栏与上下文语言菜单新增易识别的语言图标,自定义语言没有内置图标时使用通用代码图标。

### 调整

- 统一三套 Adapter 的代码菜单间距、行高、图标尺寸和暗色模式状态。
- 补充 core 包分发语言图标所需的第三方授权说明。
