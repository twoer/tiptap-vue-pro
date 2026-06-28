import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import ProEditorElementPlus from './ProEditorElementPlus.vue'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

const mockState = vi.hoisted(() => ({
  ctx: undefined as ProEditorContext | undefined,
}))

vi.mock('tiptap-vue-pro-core', () => ({
  useProEditor: vi.fn(() => mockState.ctx),
  handleImageFiles: vi.fn(),
  hasImageFiles: vi.fn(() => false),
}))

function createCtx() {
  return {
    editor: ref({
      on: vi.fn(),
      off: vi.fn(),
    }),
    loaded: ref(true),
    isActive: vi.fn(() => false),
    commands: {
      ensureFocusAtEnd: vi.fn(),
    },
    getHTML: vi.fn(() => '<p>hello</p>'),
    getJSON: vi.fn(() => ({})),
    getMarkdown: vi.fn(() => ''),
    importMarkdown: vi.fn(),
    wordCount: ref({ characters: 5, words: 1 }),
    setEditable: vi.fn(),
    tableState: ref({
      inTable: false,
      canMerge: false,
      canSplit: false,
      tablePos: null,
      rowCount: 0,
      colCount: 0,
    }),
    notify: vi.fn(),
  } as unknown as ProEditorContext
}

const childStubs = {
  Toolbar: {
    emits: ['toggle-preview', 'toggle-fullscreen'],
    template: '<div data-testid="toolbar"><button data-testid="preview-toggle" @click="$emit(\'toggle-preview\')">预览</button></div>',
  },
  BubbleMenu: { template: '<div data-testid="bubble-menu" />' },
  TableBubbleMenu: { template: '<div data-testid="table-bubble-menu" />' },
  ImageBubbleMenu: { template: '<div data-testid="image-bubble-menu" />' },
  TableGripHandles: { template: '<div data-testid="table-grip-handles" />' },
  EditorContent: { template: '<div data-testid="editor-content" />' },
}

describe('ProEditorElementPlus', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    mockState.ctx = createCtx()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('readonly=true 时隐藏工具栏和所有浮层入口', () => {
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { readonly: true },
      global: { stubs: childStubs },
    })

    expect(wrapper.find('[data-testid="toolbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-grip-handles"]').exists()).toBe(false)
  })

  it('进入预览后隐藏工具栏和浮层,显示只读预览条', async () => {
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    await wrapper.find('[data-testid="preview-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="toolbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('预览模式(只读)')
    expect(wrapper.find('.tvp-preview-bar__edit-btn').exists()).toBe(true)
    expect(wrapper.find('.tvp-preview-bar__edit-btn').text()).toContain('编辑')
    expect(mockState.ctx!.setEditable).toHaveBeenCalledWith(false)
  })
})
