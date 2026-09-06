#!/usr/bin/env node
/**
 * 适配器边界检查:把 AGENTS.md「UI Adapter Boundaries」中的三条 rg 规则固化为
 * 可执行脚本,供本地与 CI 使用。任何命中即失败。
 *
 * 规则来源(AGENTS.md):
 *  - naive / ant-design-vue 不得出现 Element Plus 组件、命名或选择器
 *  - element-plus / ant-design-vue 不得出现 Naive UI 组件、命名或选择器
 *  - element-plus / naive 不得出现 Ant Design Vue 组件、命名或选择器
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const rules = [
  {
    description:
      'naive / ant-design-vue 不得引用 Element Plus(组件、命名、选择器)',
    targets: ['packages/naive/src', 'packages/ant-design-vue/src'],
    pattern:
      /\bEl(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Dialog|Input|Popover|ColorPicker|Checkbox|Divider)\b|element-plus|\.el-|--el-/,
  },
  {
    description:
      'element-plus / ant-design-vue 不得引用 Naive UI(组件、命名、选择器)',
    targets: ['packages/element-plus/src', 'packages/ant-design-vue/src'],
    pattern:
      /\bN(Button|Tooltip|Dropdown|Input|Modal|ColorPicker|Checkbox|Divider|ConfigProvider|MessageProvider)\b|naive-ui|\.n-|--n-/,
  },
  {
    description:
      'element-plus / naive 不得引用 Ant Design Vue(组件、命名、选择器)',
    targets: ['packages/element-plus/src', 'packages/naive/src'],
    pattern:
      /\bAnt(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Modal|Input|Checkbox|Divider|Icon)\b|ant-design-vue|\.ant-|--ant-/,
  },
]

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.vue'])

function listSourceFiles(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...listSourceFiles(full))
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      files.push(full)
    }
  }
  return files
}

let violations = 0
for (const rule of rules) {
  const hits = []
  for (const target of rule.targets) {
    for (const file of listSourceFiles(target)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (rule.pattern.test(line)) {
          hits.push(`${file}:${index + 1}: ${line.trim()}`)
        }
      })
    }
  }
  if (hits.length > 0) {
    violations += hits.length
    console.error(`\n[FAIL] ${rule.description}`)
    for (const hit of hits) console.error(`  ${hit}`)
  } else {
    console.log(`[ok] ${rule.description}`)
  }
}

if (violations > 0) {
  console.error(`\nadapter boundary check failed: ${violations} violation(s)`)
  process.exit(1)
}
console.log('\nadapter boundary check passed')
