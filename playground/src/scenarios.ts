export type ScenarioKey =
  | 'basic'
  | 'business-form'
  | 'autosave-drafts'
  | 'uploads'
  | 'readonly-preview'
  | 'markdown'

export interface ScenarioDefaults {
  readonly?: boolean
  autosaveEnabled?: boolean
  draftEnabled?: boolean
  compactToolbar?: boolean
  output?: 'html' | 'json'
}

export interface PlaygroundScenario {
  key: ScenarioKey
  zhTitle: string
  enTitle: string
  zhDescription: string
  enDescription: string
  docsPath: string
  defaults: ScenarioDefaults
  createContent: (uiName: string) => string
}

export const scenarioOrder: ScenarioKey[] = [
  'basic',
  'business-form',
  'autosave-drafts',
  'uploads',
  'readonly-preview',
  'markdown',
]

export const playgroundScenarios: Record<ScenarioKey, PlaygroundScenario> = {
  basic: {
    key: 'basic',
    zhTitle: '基础编辑器',
    enTitle: 'Basic Editor',
    zhDescription: '覆盖标题、文字格式、列表、任务、表格、图片和 Mermaid,适合快速扫一遍核心能力。',
    enDescription:
      'Covers headings, marks, lists, tasks, tables, images, and Mermaid for a quick capability tour.',
    docsPath: 'guide/quick-start',
    defaults: {
      readonly: false,
      autosaveEnabled: true,
      draftEnabled: true,
      compactToolbar: true,
      output: 'html',
    },
    createContent(uiName) {
      return (
        '<h2>你好,tiptap-vue-pro 👋</h2>' +
        `<p>这是一个基于 <strong>Tiptap v3</strong> + <em>${uiName}</em> 的富文本编辑器组件。</p>` +
        '<p><span style="color: #e0398b">文字颜色</span>、<mark data-color="#fff3b0">背景高亮</mark>、<u>下划线</u>、<s>删除线</s> 都开箱即用。</p>' +
        '<p style="text-align: center">← 这一行是居中对齐 →</p>' +
        '<ul><li>开箱即用的工具栏</li><li>图片上传 / 粘贴 / 拖拽</li><li>表格、代码块、列表、任务列表</li></ul>' +
        '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>试试顶部的开关切换演示</p></div></li>' +
        '<li data-checked="true"><label><input type="checkbox" checked=""><span></span></label><div><p>已完成项会有删除线</p></div></li></ul>' +
        '<blockquote>选中文字会浮现气泡菜单(加粗/斜体/链接...)。</blockquote>' +
        '<pre><code>const editor = useProEditor({ content })\n// 开箱即用的 Tiptap v3 封装</code></pre>' +
        '<h3>Mermaid 编辑与预览</h3>' +
        '<div data-type="mermaid-block" data-view-mode="split"><pre><code class="language-mermaid">flowchart LR\n  A[编辑代码] --&gt; B[实时预览]\n  B --&gt; C[保存视图]</code></pre></div>' +
        '<table><tbody>' +
        '<tr><th>模块</th><th>能力</th><th>状态</th><th>备注</th></tr>' +
        '<tr><td>表格</td><td>行列操作</td><td>OK</td><td>结构调整</td></tr>' +
        '<tr><td>表格</td><td>区域选择</td><td>OK</td><td>矩形选区</td></tr>' +
        '<tr><td>表格</td><td>合并拆分</td><td>OK</td><td>单元格编排</td></tr>' +
        '</tbody></table>' +
        '<h3>图片功能(对标飞书)</h3>' +
        '<p>点击下方图片选中 → 浮现工具条:拖拽四角调整大小、切换左/中/右对齐、编辑题注、替换、删除。</p>' +
        '<img src="https://avatars.githubusercontent.com/u/7254263" data-align="center" data-caption="示例图片:点击我试试调整大小与对齐" width="320">'
      )
    },
  },
  'business-form': {
    key: 'business-form',
    zhTitle: '后台富文本表单',
    enTitle: 'Admin Rich Text Form',
    zhDescription: '模拟标题、摘要、正文一起提交的后台编辑场景,帮助用户判断能不能直接搬进业务表单。',
    enDescription:
      'Simulates an admin form where title, summary, and editor body are submitted together.',
    docsPath: 'guide/recipes/business-editor-form',
    defaults: {
      readonly: false,
      autosaveEnabled: false,
      draftEnabled: true,
      compactToolbar: true,
      output: 'html',
    },
    createContent(uiName) {
      return (
        '<h2>产品更新公告</h2>' +
        `<p>这个示例展示 <strong>${uiName}</strong> adapter 如何嵌入后台表单。</p>` +
        '<p>正文可以包含图片、表格、列表、引用和代码块。标题、摘要、分类、发布状态等字段仍然建议放在业务表单里维护。</p>' +
        '<blockquote>提交时把普通字段和富文本正文一起组装成 payload。</blockquote>' +
        '<table><tbody><tr><th>字段</th><th>来源</th></tr><tr><td>标题</td><td>业务表单</td></tr><tr><td>正文</td><td>编辑器 v-model</td></tr></tbody></table>'
      )
    },
  },
  'autosave-drafts': {
    key: 'autosave-drafts',
    zhTitle: '自动保存 + 本地草稿',
    enTitle: 'Autosave + Local Drafts',
    zhDescription: '演示远端自动保存和本地草稿兜底,适合长文档、知识库和丢稿成本高的场景。',
    enDescription:
      'Demonstrates remote autosave plus local draft recovery for long-form editing workflows.',
    docsPath: 'guide/recipes/autosave-drafts',
    defaults: {
      readonly: false,
      autosaveEnabled: true,
      draftEnabled: true,
      compactToolbar: true,
      output: 'html',
    },
    createContent(uiName) {
      return (
        '<h2>知识库:快速开始</h2>' +
        `<p>当前使用 <strong>${uiName}</strong> adapter。输入内容后,Playground 会模拟远端自动保存。</p>` +
        '<ul><li>远端 autosave 是业务数据源</li><li>本地 draft 用来兜底刷新、关闭标签页或浏览器崩溃</li><li>可以打开「模拟失败」观察错误状态</li></ul>' +
        '<p>建议用稳定的业务 ID 作为 autosave 和 draft 的 key。</p>'
      )
    },
  },
  uploads: {
    key: 'uploads',
    zhTitle: '图片、视频和附件上传',
    enTitle: 'Image, Video, and Attachment Uploads',
    zhDescription: '验证工具栏上传、粘贴图片、拖拽图片、视频、音频和文件附件入口。',
    enDescription:
      'Verifies toolbar uploads, pasted images, dropped images, video, audio, and file attachments.',
    docsPath: 'guide/recipes/uploads',
    defaults: {
      readonly: false,
      autosaveEnabled: false,
      draftEnabled: false,
      compactToolbar: true,
      output: 'html',
    },
    createContent(uiName) {
      return (
        '<h2>上传能力检查</h2>' +
        `<p>当前使用 <strong>${uiName}</strong> adapter。可以试试工具栏上传、拖拽图片或粘贴图片。</p>` +
        '<p>Playground 使用 mock 上传。生产环境应该由后端、OSS、COS、S3 或 CDN 返回长期可访问 URL。</p>' +
        '<img src="https://avatars.githubusercontent.com/u/7254263" data-align="center" data-caption="示例图片:可替换、调整大小或添加题注" width="300">' +
        '<ul><li>图片:限制类型和大小</li><li>视频/音频:建议返回元信息</li><li>附件:建议展示文件名、大小和上传时间</li></ul>'
      )
    },
  },
  'readonly-preview': {
    key: 'readonly-preview',
    zhTitle: '只读预览',
    enTitle: 'Readonly Preview',
    zhDescription: '展示详情页、审批预览和发布前预览如何复用同一份编辑器内容。',
    enDescription:
      'Shows how detail pages, approval previews, and pre-publish previews reuse editor content.',
    docsPath: 'guide/recipes/readonly-preview',
    defaults: {
      readonly: true,
      autosaveEnabled: false,
      draftEnabled: false,
      compactToolbar: true,
      output: 'html',
    },
    createContent(uiName) {
      return (
        '<h2>发布说明</h2>' +
        `<p>这是一份通过 <strong>${uiName}</strong> adapter 渲染的只读预览内容。</p>` +
        '<p>用户可以查看排版、图片、表格和链接,但不能编辑正文。</p>' +
        '<blockquote>只读态是展示行为,真正的权限仍然应该由后端控制。</blockquote>' +
        '<table><tbody><tr><th>场景</th><th>建议</th></tr><tr><td>详情页</td><td>复用内容渲染</td></tr><tr><td>审批页</td><td>关闭编辑能力</td></tr></tbody></table>'
      )
    },
  },
  markdown: {
    key: 'markdown',
    zhTitle: 'Markdown 导入导出',
    enTitle: 'Markdown Import / Export',
    zhDescription: '用于验证 Markdown 菜单、代码块、引用、列表和内容导出的配合效果。',
    enDescription:
      'Validates Markdown menu behavior with code blocks, quotes, lists, and exported content.',
    docsPath: 'guide/markdown',
    defaults: {
      readonly: false,
      autosaveEnabled: false,
      draftEnabled: true,
      compactToolbar: true,
      output: 'html',
    },
    createContent(uiName) {
      return (
        '<h2>Markdown 工作流</h2>' +
        `<p>当前使用 <strong>${uiName}</strong> adapter。可以从工具栏 Markdown 菜单导入或导出内容。</p>` +
        '<blockquote>适合从 Markdown 初稿迁移到富文本编辑,或把编辑器内容导出给其他系统。</blockquote>' +
        '<pre><code>## Markdown 初稿\n\n- 支持列表\n- 支持代码块\n- 支持引用</code></pre>' +
        '<ul><li>导入后可继续用富文本工具栏编辑</li><li>导出时注意业务自定义节点的降级策略</li></ul>'
      )
    },
  },
}

export function isScenarioKey(value: string): value is ScenarioKey {
  return value in playgroundScenarios
}
