import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { readFileSync } from 'node:fs'
import ProEditorElementPlus from './ProEditorElementPlus.vue'
import { useProEditor } from 'tiptap-vue-pro-core'
import type { EditorBehaviorOptions, FindReplaceState, ProEditorContext, SlashCommandRenderState, ToolbarOptions } from 'tiptap-vue-pro-core'

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

function createCtx(findReplace?: Partial<FindReplaceState>) {
  return {
    editor: ref({
      on: vi.fn(),
      off: vi.fn(),
    }),
    loaded: ref(true),
    isActive: vi.fn(() => false),
    commands: {
      ensureFocusAtEnd: vi.fn(),
      setFindReplaceQuery: vi.fn(),
      setFindReplaceReplacement: vi.fn(),
      setFindReplaceCaseSensitive: vi.fn(),
      findReplaceNext: vi.fn(),
      findReplacePrevious: vi.fn(),
      replaceFindReplaceCurrent: vi.fn(),
      replaceFindReplaceAll: vi.fn(),
      closeFindReplace: vi.fn(),
      openFindReplace: vi.fn(),
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
    findReplaceState: ref({
      open: false,
      query: '',
      replacement: '',
      caseSensitive: false,
      activeIndex: 0,
      matches: [],
      ...findReplace,
    }),
    notify: vi.fn(),
  } as unknown as ProEditorContext
}

const childStubs = {
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
  LinkBubbleMenu: {
    name: 'LinkBubbleMenu',
    props: ['editorBehaviorOptions'],
    template: '<div data-testid="link-bubble-menu" />',
  },
  FileBubbleMenu: {
    name: 'FileBubbleMenu',
    props: ['editorBehaviorOptions'],
    template: '<div data-testid="file-bubble-menu" />',
  },
  MediaBubbleMenu: {
    name: 'MediaBubbleMenu',
    props: ['editorBehaviorOptions'],
    template: '<div data-testid="media-bubble-menu" />',
  },
  HorizontalRuleBubbleMenu: {
    name: 'HorizontalRuleBubbleMenu',
    template: '<div data-testid="hr-bubble-menu" />',
  },
  TableBubbleMenu: { template: '<div data-testid="table-bubble-menu" />' },
  ImageBubbleMenu: {
    name: 'ImageBubbleMenu',
    props: ['editorBehaviorOptions'],
    template: '<div data-testid="image-bubble-menu" />',
  },
  SlashCommandMenu: {
    name: 'SlashCommandMenu',
    props: ['state'],
    template: '<button v-if="state" data-testid="slash-menu" @click="state.command(state.items[0])">{{ state.items[0].label }}</button>',
  },
  TableGripHandles: { template: '<div data-testid="table-grip-handles" />' },
  EditorContent: { template: '<div data-testid="editor-content" />' },
}

function createSlashState(command = vi.fn()): SlashCommandRenderState {
  return {
    editor: {} as SlashCommandRenderState['editor'],
    range: { from: 1, to: 2 },
    query: '',
    text: '/',
    selectedIndex: 0,
    loading: false,
    clientRect: () => new DOMRect(0, 0, 0, 0),
    command,
    items: [
      {
        id: 'table',
        label: '表格',
        hint: '插入 3 x 3 表格',
        icon: 'Table',
        aliases: ['table'],
        keywords: ['表格'],
      },
    ],
  }
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
    expect(wrapper.find('[data-testid="link-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="media-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="hr-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slash-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-grip-handles"]').exists()).toBe(false)
  })

  it('查找面板打开时显示命中计数', () => {
    mockState.ctx = createCtx({
      open: true,
      query: 'hello',
      activeIndex: 1,
      matches: [
        { from: 1, to: 6, text: 'hello' },
        { from: 8, to: 13, text: 'hello' },
      ],
    })
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    expect(wrapper.find('.tvp-find-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('2 / 2')
  })

  it('readonly=true 时查找面板保留查找但隐藏替换操作', () => {
    mockState.ctx = createCtx({
      open: true,
      query: 'hello',
      matches: [{ from: 1, to: 6, text: 'hello' }],
    })
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { readonly: true },
      global: { stubs: childStubs },
    })

    expect(wrapper.find('.tvp-find-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 / 1')
    expect(wrapper.text()).not.toContain('替换')
    expect(wrapper.text()).not.toContain('全部')
  })

  it('透传 developer diagnostics 配置到 core', () => {
    const debugLogger = vi.fn()
    const debug = { channels: ['adapter' as const] }
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { debug, debugLogger },
      global: { stubs: childStubs },
    })

    expect(vi.mocked(useProEditor).mock.calls[0][0]).toMatchObject({
      debug,
      debugLogger,
    })
  })

  it('进入预览后隐藏工具栏和浮层,显示只读预览条', async () => {
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    await wrapper.find('[data-testid="preview-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="toolbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="link-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="media-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="hr-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-bubble-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slash-menu"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('预览模式(只读)')
    expect(wrapper.find('.tvp-preview-bar__edit-btn').exists()).toBe(true)
    expect(wrapper.find('.tvp-preview-bar__edit-btn').text()).toContain('编辑')
    expect(mockState.ctx!.setEditable).toHaveBeenCalledWith(false)
  })

  it('把 Slash Command bridge 传给 core,菜单 state 更新后渲染菜单', async () => {
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    const calls = vi.mocked(useProEditor).mock.calls
    const useProEditorOptions = calls[calls.length - 1]?.[0] as any
    const state = createSlashState()
    useProEditorOptions.slashCommand.onOpen(state)
    await nextTick()

    expect(useProEditorOptions.slashCommand.items).toHaveLength(8)
    expect(wrapper.find('[data-testid="slash-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slash-menu"]').text()).toContain('表格')
  })

  it('Slash 菜单点击时通过 state.command 执行候选项', async () => {
    const command = vi.fn()
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    const calls = vi.mocked(useProEditor).mock.calls
    const useProEditorOptions = calls[calls.length - 1]?.[0] as any
    useProEditorOptions.slashCommand.onOpen(createSlashState(command))
    await nextTick()
    await wrapper.find('[data-testid="slash-menu"]').trigger('click')

    expect(command).toHaveBeenCalledWith(expect.objectContaining({ id: 'table' }))
  })

  it('Slash 执行回调会复用 core 命令执行表格插入', () => {
    const ctx = createCtx()
    ;(ctx.commands as any).insertTable = vi.fn()
    mockState.ctx = ctx
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      global: { stubs: childStubs },
    })

    const calls = vi.mocked(useProEditor).mock.calls
    const useProEditorOptions = calls[calls.length - 1]?.[0] as any
    useProEditorOptions.slashCommand.onExecute({
      item: {
        id: 'table',
        label: '表格',
        icon: 'Table',
        aliases: ['table'],
        keywords: ['表格'],
      },
    })

    expect((ctx.commands as any).insertTable).toHaveBeenCalledWith(3, 3)
  })

  it('预览编辑按钮保持图标和文字水平居中且间距一致', () => {
    const source = readFileSync('src/ProEditorElementPlus.vue', 'utf8')

    expect(source).toContain('.el-button.tvp-preview-bar__edit-btn > span')
    expect(source).toContain('gap: 6px;')
    expect(source).toContain('.el-button.tvp-preview-bar__edit-btn svg')
  })

  it('contextual bubble 根节点默认不可见,避免插件接管前裸露在文档流中', () => {
    for (const [file, className] of [
      ['src/LinkBubbleMenu.vue', 'tvp-link-bubble'],
      ['src/FileBubbleMenu.vue', 'tvp-file-bubble'],
      ['src/MediaBubbleMenu.vue', 'tvp-media-bubble'],
      ['src/HorizontalRuleBubbleMenu.vue', 'tvp-hr-bubble'],
    ]) {
      const source = readFileSync(file, 'utf8')
      expect(source).toMatch(new RegExp(`\\.${className} \\{[\\s\\S]*?visibility: hidden;`))
    }
  })

  it('output 动态切换到 json 时立即按 JSON 更新 v-model', async () => {
    const json = { type: 'doc', content: [{ type: 'paragraph' }] }
    mockState.ctx = {
      ...createCtx(),
      getJSON: vi.fn(() => json),
    } as unknown as ProEditorContext
    wrapper = mount(ProEditorElementPlus, {
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
    wrapper = mount(ProEditorElementPlus, {
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
    wrapper = mount(ProEditorElementPlus, {
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
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { toolbarOptions },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    expect(toolbar.props('toolbarOptions')).toEqual(toolbarOptions)
  })

  it('把 editorBehaviorOptions 配置传给 core、Toolbar、LinkBubbleMenu、MediaBubbleMenu 和 ImageBubbleMenu', () => {
    const editorBehaviorOptions: EditorBehaviorOptions = {
      link: { defaultTarget: '_self' },
      table: { withHeaderRow: false },
      image: { accept: 'image/png,image/jpeg' },
    }
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { editorBehaviorOptions },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    const linkBubbleMenu = wrapper.findComponent({ name: 'LinkBubbleMenu' })
    const mediaBubbleMenu = wrapper.findComponent({ name: 'MediaBubbleMenu' })
    const imageBubbleMenu = wrapper.findComponent({ name: 'ImageBubbleMenu' })
    const useProEditorCalls = vi.mocked(useProEditor).mock.calls
    const useProEditorOptions = useProEditorCalls[useProEditorCalls.length - 1]?.[0]
    expect(useProEditorOptions?.editorBehaviorOptions).toEqual(editorBehaviorOptions)
    expect(toolbar.props('editorBehaviorOptions')).toEqual(editorBehaviorOptions)
    expect(linkBubbleMenu.props('editorBehaviorOptions')).toEqual(editorBehaviorOptions)
    expect(mediaBubbleMenu.props('editorBehaviorOptions')).toEqual(editorBehaviorOptions)
    expect(imageBubbleMenu.props('editorBehaviorOptions')).toEqual(editorBehaviorOptions)
  })

  it('toolbar=false 时把隐藏配置传给内置 Toolbar', () => {
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { toolbar: false },
      global: { stubs: childStubs },
    })

    const toolbar = wrapper.findComponent({ name: 'Toolbar' })
    expect(toolbar.props('toolbar')).toBe(false)
  })

  it('toolbar 插槽会完全替换内置 Toolbar', () => {
    wrapper = mount(ProEditorElementPlus, {
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
    wrapper = mount(ProEditorElementPlus, {
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
    wrapper = mount(ProEditorElementPlus, {
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
    wrapper = mount(ProEditorElementPlus, {
      attachTo: document.body,
      props: { uploadImage },
      global: { stubs: childStubs },
    })

    await wrapper.find('.tvp-content-wrap').trigger('paste', {
      clipboardData: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
    })

    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('元素 BubbleMenu 层级高于编辑器工具栏', () => {
    const source = readFileSync(`${process.cwd()}/src/ProEditorElementPlus.vue`, 'utf8')

    expect(source).toContain('.tvp-img-bubble')
    expect(source).toContain('.tvp-media-bubble')
    expect(source).toContain('z-index: 2100;')
  })
})
