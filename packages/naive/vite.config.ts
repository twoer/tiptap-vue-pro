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
      name: 'TiptapVueProNaive',
      fileName: 'index',
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        'vue',
        'naive-ui',
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
