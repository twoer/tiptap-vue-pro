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
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TiptapVueProElementPlus',
      fileName: 'index',
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        '@tiptap/core',
        '@tiptap/pm',
        /^@tiptap\//,
        'tiptap-vue-pro-core',
      ],
      output: {
        // 单独导出一个 style.css
        assetFileNames: 'style.css',
      },
    },
  },
})
