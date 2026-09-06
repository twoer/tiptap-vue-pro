import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

/**
 * 根 flat config:packages/*、playground、scripts、docs 配置统一覆盖。
 * 原则:正确性/边界类规则 error;类型卫生类(no-explicit-any 等)存量以 warn
 * 起步逐步清零;纯排版类 vue 规则关闭(交给 review,不与现有格式冲突)。
 */
export default defineConfigWithVueTs(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.worktrees/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
    ],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    rules: {
      // 类型卫生:存量 warn,清零后升 error
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      // 未使用变量跟随 tsconfig noUnused* 的既有口径,允许 _ 前缀
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // declare module '*.vue' {} 等 shim 是标准写法,放行空对象类型字面量
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'never', allowObjectTypes: 'always' },
      ],
      // 单文件组件按文件组织,不强制多词名
      'vue/multi-word-component-names': 'off',
    },
  },
  // 关闭 vue 推荐集里的纯排版规则:现有模板为长行风格,统一交给评审而非 lint
  {
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attributes-order': 'off',
      'vue/attribute-hyphenation': 'off',
      // 类型式 defineProps 不需要运行时默认值,该规则对 TS 组件是噪音
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'off',
    },
  },
  // Node 脚本(scripts/*、根配置)按 ESM CommonJS 兼容环境处理
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs', 'docs/.vitepress/config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
