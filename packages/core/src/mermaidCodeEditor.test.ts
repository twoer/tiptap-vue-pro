import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMermaidCodeEditorController } from './mermaidCodeEditor'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Mermaid CodeMirror controller', () => {
  it('mounts lazily and applies external source without emitting a second change', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const onChange = vi.fn()
    const controller = createMermaidCodeEditorController({
      source: 'flowchart TD\nA --> B',
      onChange,
    })

    await controller.mount(host)
    expect(host.querySelector('.cm-editor')).toBeTruthy()
    expect(host.querySelector('.cm-content')?.getAttribute('aria-label')).toBe('Mermaid source code')
    expect(controller.getSource()).toBe('flowchart TD\nA --> B')

    controller.updateSource('flowchart LR\nA --> C')
    expect(controller.getSource()).toBe('flowchart LR\nA --> C')
    expect(onChange).not.toHaveBeenCalled()

    controller.destroy()
    expect(host.querySelector('.cm-editor')).toBeNull()
  })

  it('applies an accessible label and honors focus requested during lazy mount', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const controller = createMermaidCodeEditorController({
      source: 'flowchart TD',
      ariaLabel: 'Mermaid 源码',
    })

    const mounting = controller.mount(host)
    controller.focus()
    await mounting

    const content = host.querySelector('.cm-content') as HTMLElement
    expect(content.getAttribute('aria-label')).toBe('Mermaid 源码')
    expect(document.activeElement).toBe(content)
    controller.destroy()
  })

  it('routes undo and redo shortcuts to ProseMirror callbacks', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const controller = createMermaidCodeEditorController({
      source: 'flowchart TD',
      onUndo,
      onRedo,
    })

    await controller.mount(host)
    const content = host.querySelector('.cm-content') as HTMLElement
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }))

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
    controller.destroy()
  })

  it('supports theme, readonly, and error-line updates after mount', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const controller = createMermaidCodeEditorController({
      source: 'flowchart TD\nA --> B',
    })

    await controller.mount(host)
    controller.setTheme('dark')
    controller.setEditable(false)
    controller.setErrorLine(2)

    expect(host.querySelector('.cm-editor')?.classList.contains('cm-theme-dark')).toBe(true)
    expect(host.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false')
    expect(host.querySelector('.tvp-cm-error-line')).toBeTruthy()
    controller.destroy()
  })
})
