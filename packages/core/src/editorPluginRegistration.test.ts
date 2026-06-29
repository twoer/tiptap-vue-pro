import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, shallowRef } from 'vue'
import { useEditorPluginRegistration } from './editorPluginRegistration'
import type { Editor } from '@tiptap/vue-3'

function createEditor() {
  return {
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
}

describe('useEditorPluginRegistration', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('registers, migrates, and unregisters plugins across editor lifecycle', async () => {
    const first = createEditor()
    const second = createEditor()
    const editor = shallowRef<Editor | undefined>(first as unknown as Editor)
    const element = shallowRef<HTMLElement | null>(document.createElement('div'))
    const createPlugin = vi.fn(() => ({ key: 'plugin' }) as never)
    const onRegistered = vi.fn((ed: ReturnType<typeof createEditor>) => {
      const handler = () => undefined
      ed.on('selectionUpdate', handler)
      return () => ed.off('selectionUpdate', handler)
    })

    const Comp = defineComponent({
      setup() {
        useEditorPluginRegistration({
          getEditor: () => editor.value,
          getElement: () => element.value,
          pluginKey: 'plugin',
          createPlugin,
          onRegistered: onRegistered as never,
        })
        return () => null
      },
    })

    wrapper = mount(Comp)

    expect(first.registerPlugin).toHaveBeenCalledTimes(1)
    expect(createPlugin).toHaveBeenCalledWith(first, element.value)
    expect(first.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))

    editor.value = second as unknown as Editor
    await nextTick()

    expect(first.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(first.unregisterPlugin).toHaveBeenCalledWith('plugin')
    expect(second.registerPlugin).toHaveBeenCalledTimes(1)
    expect(second.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))

    element.value = null
    await nextTick()

    expect(second.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(second.unregisterPlugin).toHaveBeenCalledWith('plugin')
  })
})
