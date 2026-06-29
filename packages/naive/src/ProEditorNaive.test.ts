import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ProEditorNaive from './ProEditorNaive.vue'
import { useProEditor } from 'tiptap-vue-pro-core'
import type { EditorBehaviorOptions, ProEditorContext, ToolbarOptions } from 'tiptap-vue-pro-core'

const mockState = vi.hoisted(() => ({
  ctx: undefined as ProEditorContext | undefined,
}))

vi.mock('tiptap-vue-pro-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tiptap-vue-pro-core')>()
  return {
    ...actual,
    useProEditor: vi.fn(() => mockState.ctx),
  }
})

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
  NConfigProvider: { template: '<div><slot /></div>' },
  NMessageProvider: { template: '<div><slot /></div>' },
  NTooltip: { template: '<span><slot name="trigger" /><slot /></span>' },
  NButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>' },
  MessageBridge: { template: '<span />', methods: { get: () => null } },
  Toolbar: {
    name: 'Toolbar',
    props: ['toolbar', 'toolbarOptions', 'editorBehaviorOptions'],
    emits: ['toggle-preview', 'toggle-fullscreen'],
    template: `
      <div data-testid="toolbar">
        <slot name="before" />
        <button data-testid="preview-toggle" @click="$emit('toggle-preview')">预览</button>
        <slot name="after" />
      </div>
    `,
  },
  BubbleMenu: { template: '<div data-testid="bubble-menu" />' },
  TableBubbleMenu: { template: '<div data-testid="table-bubble-menu" />' },
  ImageBubbleMenu: {
    name: 'ImageBubbleMenu',
    props: ['editorBehaviorOptions'],
    template: '<div data-testid="image-bubble-menu" />',
  },
  TableGripHandles: { template: '<div data-testid="table-grip-handles" />' },
  EditorContent: { template: '<div data-testid="editor-content" />' },
}

describe('ProEditorNaive', () => {
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
    wrapper = mount(ProEditorNaive, {
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
    wrapper = mount(ProEditorNaive, {
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

  it('output 动态切换到 json 时立即按 JSON 更新 v-model', async () => {
    const json = { type: 'doc', content: [{ type: 'paragraph' }] }
    mockState.ctx = {
      ...createCtx(),
      getJSON: vi.fn(() => json),
    } as unknown as ProEditorContext
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { output: 'html' },
      global: { stubs: childStubs },
    })

    await wrapper.setProps({ output: 'json' })
    await nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(mockState.ctx.getJSON).toHaveBeenCalledTimes(1)
    expect(events[events.length - 1]).toEqual([json])
  })

  it('output 动态切换回 html 时立即按 HTML 更新 v-model', async () => {
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { output: 'json' },
      global: { stubs: childStubs },
    })

    await wrapper.setProps({ output: 'html' })
    await nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(mockState.ctx!.getHTML).toHaveBeenCalledTimes(1)
    expect(events[events.length - 1]).toEqual(['<p>hello</p>'])
  })

  it('把 toolbar 配置传给内置 Toolbar', () => {
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { toolbar: [['bold']] },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    expect(toolbar.props('toolbar')).toEqual([['bold']])
  })

  it('把 toolbarOptions 配置传给内置 Toolbar', () => {
    const toolbarOptions: ToolbarOptions = {
      fontFamilies: [{ label: 'PingFang SC', value: 'PingFang SC' }],
      fontSizes: ['', '13px'],
      lineHeights: ['', '1.75'],
    }
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { toolbarOptions },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    expect(toolbar.props('toolbarOptions')).toEqual(toolbarOptions)
  })

  it('把 editorBehaviorOptions 配置传给 core、Toolbar 和 ImageBubbleMenu', () => {
    const editorBehaviorOptions: EditorBehaviorOptions = {
      link: { defaultTarget: '_self' },
      table: { withHeaderRow: false },
      image: { accept: 'image/png,image/jpeg' },
    }
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { editorBehaviorOptions },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    const imageBubbleMenu = wrapper.findComponent({ name: 'ImageBubbleMenu' })
    const useProEditorCalls = vi.mocked(useProEditor).mock.calls
    const useProEditorOptions = useProEditorCalls[useProEditorCalls.length - 1]?.[0]
    expect(useProEditorOptions?.editorBehaviorOptions).toEqual(editorBehaviorOptions)
    expect(toolbar.props('editorBehaviorOptions')).toEqual(editorBehaviorOptions)
    expect(imageBubbleMenu.props('editorBehaviorOptions')).toEqual(editorBehaviorOptions)
  })

  it('toolbar=false 时把隐藏配置传给内置 Toolbar', () => {
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { toolbar: false },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    expect(toolbar.props('toolbar')).toBe(false)
  })

  it('toolbar 插槽会完全替换内置 Toolbar', () => {
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      slots: {
        toolbar: '<div data-testid="custom-toolbar">Custom</div>',
      },
      global: { stubs: childStubs },
    })

    expect(wrapper.find('[data-testid="custom-toolbar"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'Toolbar' }).exists()).toBe(false)
  })

  it('toolbar-before / toolbar-after 插槽会透传给内置 Toolbar', () => {
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      slots: {
        'toolbar-before': '<button data-testid="before">Before</button>',
        'toolbar-after': '<button data-testid="after">After</button>',
      },
      global: { stubs: childStubs },
    })

    expect(wrapper.find('[data-testid="before"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="after"]').exists()).toBe(true)
  })

  it('卸载时清理 editor 事件监听', () => {
    const ctx = createCtx()
    const editor = ctx.editor.value!
    mockState.ctx = ctx
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    wrapper.unmount()

    expect(editor.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(editor.off).toHaveBeenCalledWith('transaction', expect.any(Function))
    expect(editor.off).toHaveBeenCalledWith('focus', expect.any(Function))
  })

  it('粘贴图片但 editor 未就绪时不调用上传插入', async () => {
    const ctx = createCtx()
    ctx.editor.value = undefined
    mockState.ctx = ctx
    const uploadImage = vi.fn()
    wrapper = mount(ProEditorNaive, {
      attachTo: document.body,
      props: { uploadImage },
      global: { stubs: childStubs },
    })

    await wrapper.find('.tvp-content-wrap').trigger('paste', {
      clipboardData: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
    })

    expect(uploadImage).not.toHaveBeenCalled()
  })
})
