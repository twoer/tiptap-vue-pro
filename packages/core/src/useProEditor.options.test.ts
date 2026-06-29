import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useEditor } from '@tiptap/vue-3'
import { useProEditor } from './useProEditor'

vi.mock('@tiptap/vue-3', async () => {
  const vue = await import('vue')
  return {
    useEditor: vi.fn(() => vue.ref(undefined)),
  }
})

function mountComposable(options: { immediatelyRender?: boolean } = {}) {
  const Comp = defineComponent({
    setup() {
      useProEditor({
        content: '<p>hello</p>',
        extensions: [],
        ...options,
      })
      return () => null
    },
  })

  return mount(Comp, { attachTo: document.body })
}

describe('useProEditor options', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('默认关闭 immediatelyRender,避免 SSR 场景立即渲染编辑器', () => {
    wrapper = mountComposable()

    expect(useEditor).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useEditor).mock.calls[0][0]).toMatchObject({
      immediatelyRender: false,
    })
  })

  it('显式传入 immediatelyRender=true 时透传给 Tiptap useEditor', () => {
    wrapper = mountComposable({ immediatelyRender: true })

    expect(useEditor).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useEditor).mock.calls[0][0]).toMatchObject({
      immediatelyRender: true,
    })
  })
})
