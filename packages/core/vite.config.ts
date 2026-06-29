import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      exclude: ['src/**/*.test.ts', 'src/test/**'],
      // Tiptap 的类型来自 peer 依赖,不打包进 d.ts
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TiptapVueProCore',
      fileName: 'index',
    },
    rollupOptions: {
      // peer 依赖不打包进产物
      external: [
        'vue',
        '@tiptap/core',
        '@tiptap/pm',
        '@tiptap/vue-3',
        /^@tiptap\//,
        'lowlight',
      ],
      output: {
        globals: (id) => {
          const globals: Record<string, string> = {
            vue: 'Vue',
            '@tiptap/core': 'TiptapCore',
            '@tiptap/pm': 'TiptapPM',
            '@tiptap/vue-3': 'TiptapVue3',
            '@tiptap/pm/tables': 'TiptapPMTables',
            '@tiptap/starter-kit': 'TiptapStarterKit',
            '@tiptap/extension-character-count': 'TiptapCharacterCount',
            '@tiptap/extension-code-block-lowlight': 'TiptapCodeBlockLowlight',
            '@tiptap/extension-placeholder': 'TiptapPlaceholder',
            '@tiptap/extension-table': 'TiptapTable',
            '@tiptap/extension-image': 'TiptapImage',
            '@tiptap/extension-text-style': 'TiptapTextStyle',
            '@tiptap/extension-color': 'TiptapColor',
            '@tiptap/extension-highlight': 'TiptapHighlight',
            '@tiptap/extension-text-align': 'TiptapTextAlign',
            '@tiptap/extension-subscript': 'TiptapSubscript',
            '@tiptap/extension-superscript': 'TiptapSuperscript',
            '@tiptap/extension-list': 'TiptapList',
            '@tiptap/markdown': 'TiptapMarkdown',
            lowlight: 'lowlight',
          }
          return globals[id] ?? 'Tiptap'
        },
      },
    },
  },
})
