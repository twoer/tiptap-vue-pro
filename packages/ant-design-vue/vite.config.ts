import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TiptapVueProAntDesignVue',
      fileName: 'index',
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        'vue',
        'ant-design-vue',
        '@tiptap/core',
        '@tiptap/pm',
        /^@tiptap\//,
        'tiptap-vue-pro-core',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'ant-design-vue': 'AntDesignVue',
          '@tiptap/core': 'TiptapCore',
          '@tiptap/pm': 'TiptapPM',
          '@tiptap/vue-3': 'TiptapVue3',
          '@tiptap/extension-bubble-menu': 'TiptapBubbleMenu',
          'tiptap-vue-pro-core': 'TiptapVueProCore',
        },
        // 单独导出一个 style.css
        assetFileNames: 'style.css',
      },
    },
  },
})
