import { defineConfig } from 'vitepress'

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
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/quick-start' },
      { text: 'API', link: '/api/props' },
      { text: '高级', link: '/advanced/extension-registry' },
      { text: '在线体验', link: '/guide/live-demo' },
      { text: 'GitHub', link: 'https://github.com/twoer/tiptap-vue-pro' },
    ],
    sidebar: [
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
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/twoer/tiptap-vue-pro' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: '基于 Tiptap v3 + Vue 3 的社区封装。',
      copyright: 'Released under the MIT License.',
    },
  },
})
