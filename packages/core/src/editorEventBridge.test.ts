import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, shallowRef } from 'vue'
import { useEditorEventBridge } from './editorEventBridge'
import type { Editor } from '@tiptap/vue-3'

function createEditor() {
  const handlers = new Map<string, Function[]>()
  return {
    on: vi.fn((event: string, handler: Function) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler])
    }),
    off: vi.fn((event: string, handler: Function) => {
      handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== handler))
    }),
    emit(event: string) {
      for (const handler of handlers.get(event) ?? []) handler()
    },
  }
}

describe('useEditorEventBridge', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('bridges editor events into refs and cleans up when editor changes', async () => {
    const first = createEditor()
    const second = createEditor()
    const editor = shallowRef<Editor | undefined>(first as unknown as Editor)
    let bridge!: ReturnType<typeof useEditorEventBridge>

    const Comp = defineComponent({
      setup() {
        bridge = useEditorEventBridge(editor)
        return () => null
      },
    })

    wrapper = mount(Comp)

    first.emit('selectionUpdate')
    first.emit('transaction')
    first.emit('focus')

    expect(bridge.selectionTick.value).toBe(2)
    expect(bridge.editorHasBeenFocused.value).toBe(true)

    editor.value = second as unknown as Editor
    await nextTick()

    expect(first.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(first.off).toHaveBeenCalledWith('transaction', expect.any(Function))
    expect(first.off).toHaveBeenCalledWith('focus', expect.any(Function))
    expect(second.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
  })
})
