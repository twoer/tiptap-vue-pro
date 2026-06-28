import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * Element Plus adapter 组件测试配置。
 *
 * adapter 测试直接 alias 到 core 源码,与 playground 的开发模式一致,
 * 避免测试依赖未构建的 dist 产物。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'tiptap-vue-pro-core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
})
