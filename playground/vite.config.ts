import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * playground 的 Vite 配置。
 *
 * 关键:dev 模式下把 workspace 包解析到「源码」而非 dist 产物,
 * 这样既能热更新,又避免 dist 里 external 的依赖(如 @tiptap/vue-3)
 * 在 playground 里找不到的问题。
 *
 * 这里两个包都硬编码 alias,MVP 阶段够用;以后包多了再改动态扫描。
 */
export default defineConfig({
  // 部署到 GitHub Pages (https://twoer.github.io/tiptap-vue-pro/) 需要正确的 base。
  // 本地 dev 不受影响。
  base: '/tiptap-vue-pro/',
  plugins: [vue()],
  resolve: {
    alias: {
      'tiptap-vue-pro-core': fileURLToPath(
        new URL('../packages/core/src/index.ts', import.meta.url),
      ),
      'tiptap-vue-pro-element-plus': fileURLToPath(
        new URL('../packages/element-plus/src/index.ts', import.meta.url),
      ),
      'tiptap-vue-pro-naive': fileURLToPath(
        new URL('../packages/naive/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
