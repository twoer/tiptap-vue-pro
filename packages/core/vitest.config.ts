import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * 单元/集成测试配置。
 *
 * 与 lib 构建的 vite.config.ts 故意分离:构建只打包 src/index.ts,
 * 测试需要 happy-dom 环境 + vue 插件 + 能解析 .vue(虽然 core 无 .vue,
 * 但 useProEditor 集成测试会挂载一个内联 helper 组件)。
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
})
