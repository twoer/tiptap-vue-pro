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
      ],
    },
  },
})
