import { defineConfig } from 'vitepress'

const socialLinks = [
  { icon: 'github', link: 'https://github.com/twoer/tiptap-vue-pro' },
] as const

const zhNav = [
  { text: '指南', link: '/guide/quick-start' },
  { text: 'API', link: '/api/props' },
  { text: '高级', link: '/advanced/extension-registry' },
  { text: '在线体验', link: '/guide/live-demo' },
  { text: 'GitHub', link: 'https://github.com/twoer/tiptap-vue-pro' },
]

const enNav = [
  { text: 'Guide', link: '/en/guide/quick-start' },
  { text: 'API', link: '/en/api/props' },
  { text: 'Advanced', link: '/en/advanced/extension-registry' },
  { text: 'Live Demo', link: '/en/guide/live-demo' },
  { text: 'GitHub', link: 'https://github.com/twoer/tiptap-vue-pro' },
]

const zhSidebar = [
  {
    text: '指南',
    items: [
      { text: '为什么用它', link: '/guide/why' },
      { text: '快速开始', link: '/guide/quick-start' },
      { text: '三套 Adapter', link: '/guide/adapters' },
      { text: '完整示例', link: '/guide/examples' },
      { text: '在线体验', link: '/guide/live-demo' },
      { text: '配置菜单和默认行为', link: '/guide/configuration' },
      { text: '工具栏', link: '/guide/toolbar' },
      { text: '图片上传', link: '/guide/image-upload' },
      { text: '视频、音频和文件上传', link: '/guide/media-upload' },
      { text: 'Markdown', link: '/guide/markdown' },
      { text: 'Nuxt / SSR', link: '/guide/ssr' },
      { text: 'FAQ', link: '/guide/faq' },
    ],
  },
  {
    text: 'API',
    items: [
      { text: 'Props', link: '/api/props' },
      { text: 'ToolbarConfig', link: '/api/toolbar-config' },
      { text: 'ToolbarOptions', link: '/api/toolbar-options' },
      { text: 'EditorBehaviorOptions', link: '/api/editor-behavior-options' },
      { text: 'Context 与 Commands', link: '/api/context-commands' },
    ],
  },
  {
    text: '高级',
    items: [
      { text: '整体架构', link: '/advanced/architecture' },
      { text: '扩展注册表', link: '/advanced/extension-registry' },
      { text: '命令注册表', link: '/advanced/command-registry' },
      { text: '开发者诊断', link: '/advanced/developer-diagnostics' },
    ],
  },
]

const enSidebar = [
  {
    text: 'Guide',
    items: [
      { text: 'Why Use It', link: '/en/guide/why' },
      { text: 'Quick Start', link: '/en/guide/quick-start' },
      { text: 'Adapters', link: '/en/guide/adapters' },
      { text: 'Examples', link: '/en/guide/examples' },
      { text: 'Live Demo', link: '/en/guide/live-demo' },
      { text: 'Configuration', link: '/en/guide/configuration' },
      { text: 'Toolbar', link: '/en/guide/toolbar' },
      { text: 'Image Upload', link: '/en/guide/image-upload' },
      { text: 'Video, Audio, and File Upload', link: '/en/guide/media-upload' },
      { text: 'Markdown', link: '/en/guide/markdown' },
      { text: 'Nuxt / SSR', link: '/en/guide/ssr' },
      { text: 'FAQ', link: '/en/guide/faq' },
    ],
  },
  {
    text: 'API',
    items: [
      { text: 'Props', link: '/en/api/props' },
      { text: 'ToolbarConfig', link: '/en/api/toolbar-config' },
      { text: 'ToolbarOptions', link: '/en/api/toolbar-options' },
      { text: 'EditorBehaviorOptions', link: '/en/api/editor-behavior-options' },
      { text: 'Context and Commands', link: '/en/api/context-commands' },
    ],
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Architecture', link: '/en/advanced/architecture' },
      { text: 'Extension Registry', link: '/en/advanced/extension-registry' },
      { text: 'Command Registry', link: '/en/advanced/command-registry' },
      { text: 'Developer Diagnostics', link: '/en/advanced/developer-diagnostics' },
    ],
  },
]

export default defineConfig({
  title: 'Tiptap Vue Pro',
  description: '基于 Tiptap v3 + Vue 3 的富文本编辑器组件',
  base: '/tiptap-vue-pro/',
  srcExclude: ['feature-gap-analysis.md', 'plans/**'],
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence

      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const language = token.info.trim().split(/\s+/)[0]

        if (language === 'mermaid') {
          return `<MermaidDiagram graph="${encodeURIComponent(token.content)}" />`
        }

        return defaultFence
          ? defaultFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }
    },
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
    },
    en: {
      label: 'English',
      lang: 'en-US',
      title: 'Tiptap Vue Pro',
      description: 'A rich text editor component package built on Tiptap v3 + Vue 3.',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        socialLinks,
        search: {
          provider: 'local',
        },
        footer: {
          message: 'A community package built on Tiptap v3 + Vue 3.',
          copyright: 'Released under the MIT License.',
        },
      },
    },
  },
  themeConfig: {
    nav: zhNav,
    sidebar: zhSidebar,
    socialLinks,
    search: {
      provider: 'local',
    },
    footer: {
      message: '基于 Tiptap v3 + Vue 3 的社区封装。',
      copyright: 'Released under the MIT License.',
    },
  },
})
