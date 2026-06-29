import { describe, it, expect } from 'vitest'
import { createDefaultExtensions } from './extensions'

/**
 * createDefaultExtensions 的单元测试。
 *
 * 扩展包是所有命令(bold/heading/link/taskList/...)能工作的地基——
 * 漏配一个扩展,对应命令就会静默失效。这里验证关键扩展确实在场,
 * 防止重构时误删。
 */

describe('createDefaultExtensions', () => {
  it('返回非空数组', () => {
    const exts = createDefaultExtensions()
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  it('包含 StarterKit(提供 bold/italic/heading/list/link 等基础能力)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    // StarterKit 是个聚合扩展,其 name 为 'starterKit'
    expect(names).toContain('starterKit')
  })

  it('包含任务列表扩展(TaskList + TaskItem)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('taskList')
    expect(names).toContain('taskItem')
  })

  it('包含颜色与高亮(Color / Highlight / TextStyle)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('color')
    expect(names).toContain('highlight')
    expect(names).toContain('textStyle')
  })

  it('包含字体、字号与行高扩展(FontFamily / FontSize / LineHeight)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('fontFamily')
    expect(names).toContain('fontSize')
    expect(names).toContain('lineHeight')
  })

  it('包含文本对齐(textAlign)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('textAlign')
  })

  it('包含块级缩进扩展(blockIndent)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('blockIndent')
  })

  it('包含上标与下标(superscript / subscript)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('superscript')
    expect(names).toContain('subscript')
  })

  it('包含 lowlight 代码块扩展(codeBlock)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('codeBlock')
  })

  it('包含图片与表格(image / tableKit)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('image')
    expect(names).toContain('tableKit')
  })

  it('包含字数统计(characterCount)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('characterCount')
  })

  it('包含占位符(placeholder)', () => {
    const exts = createDefaultExtensions()
    const placeholder = exts.find((e: any) => e.name === 'placeholder')
    expect(placeholder).toBeTruthy()
  })

  it('placeholder 文案透传', () => {
    const exts = createDefaultExtensions('写点什么吧…')
    // Placeholder 扩展把文案存在 options.placeholder
    const placeholder: any = exts.find((e: any) => e.name === 'placeholder')
    expect(placeholder.options.placeholder).toBe('写点什么吧…')
  })

  it('不传 placeholder 时使用默认文案', () => {
    const exts = createDefaultExtensions()
    const placeholder: any = exts.find((e: any) => e.name === 'placeholder')
    expect(placeholder.options.placeholder).toBe('请输入内容...')
  })

  it('包含 Markdown 扩展(导入/导出 MD)', () => {
    const names = createDefaultExtensions().map((e: any) => e.name)
    expect(names).toContain('markdown')
  })
})
