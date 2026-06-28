import { createLowlight, common } from 'lowlight'

/**
 * 代码块语言列表。value 必须是 lowlight 已注册的语言名。
 * plain text 用 plaintext,保留 language-plaintext class,便于 UI 显示当前选择。
 */
export const CODE_BLOCK_LANGUAGES = [
  { label: 'Plain Text', value: 'plaintext' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'HTML / Vue', value: 'xml' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Bash', value: 'bash' },
  { label: 'Markdown', value: 'markdown' },
] as const

export type CodeBlockLanguage = (typeof CODE_BLOCK_LANGUAGES)[number]['value']

export const codeBlockLowlight = createLowlight(common)

export function codeBlockLanguageLabel(language?: string | null): string {
  return CODE_BLOCK_LANGUAGES.find((item) => item.value === language)?.label ?? 'Plain Text'
}
