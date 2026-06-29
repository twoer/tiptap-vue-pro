import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import Toolbar from './Toolbar.vue'
import { getCommandLabel, TOOLBAR_MARKDOWN_OPTIONS } from 'tiptap-vue-pro-core'
import type { ProEditorContext, ToolbarOptions } from 'tiptap-vue-pro-core'

function createEditor(options: { empty?: boolean; inLink?: boolean; codeBlockLanguage?: string } = {}) {
  return {
    state: {
      selection: {
        from: 3,
        to: options.empty === false ? 10 : 3,
        empty: options.empty ?? true,
      },
      doc: {
        textBetween: vi.fn(() => '选中文本'),
      },
    },
    isActive: vi.fn((name: string) => name === 'link' && !!options.inLink),
    getAttributes: vi.fn((name: string) => {
      if (name === 'link' && options.inLink) return { href: 'https://old.example.com' }
      if (name === 'codeBlock' && options.codeBlockLanguage) return { language: options.codeBlockLanguage }
      return {}
    }),
  }
}

function createCtx(editor?: ReturnType<typeof createEditor>) {
  return {
    editor: ref(editor),
    isActive: vi.fn(() => false),
    commands: {
      setImage: vi.fn(),
      uploadAndInsertImage: vi.fn(),
      insertLinkText: vi.fn(),
      setLink: vi.fn(),
      code: vi.fn(),
      superscript: vi.fn(),
      subscript: vi.fn(),
      codeBlock: vi.fn(),
      setFontFamily: vi.fn(),
      setFontSize: vi.fn(),
      setLineHeight: vi.fn(),
      clearTypography: vi.fn(),
      increaseIndent: vi.fn(),
      decreaseIndent: vi.fn(),
    },
    getHTML: vi.fn(() => '<p>hello</p>'),
    getMarkdown: vi.fn(() => '# hello'),
    importMarkdown: vi.fn(),
    notify: vi.fn(),
    prepareInsert: vi.fn(),
  } as unknown as ProEditorContext & { prepareInsert: ReturnType<typeof vi.fn> }
}

async function clickBodyButton(text: string) {
  await nextTick()
  const button = Array.from(document.body.querySelectorAll('button')).find((node) =>
    node.textContent?.includes(text),
  )
  expect(button).toBeTruthy()
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

function inputByPlaceholder(placeholder: string) {
  const input = document.body.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement | null
  expect(input).toBeTruthy()
  return input!
}

async function setNativeInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('Naive Toolbar', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('网络图片:输入合法地址后插入图片并调用 prepareInsert', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="网络图片"]').trigger('click')
    await nextTick()
    const input = inputByPlaceholder('请输入图片地址 https://...')

    await setNativeInput(input, ' https://example.com/a.png ')
    await clickBodyButton('确定')

    expect(ctx.prepareInsert).toHaveBeenCalledTimes(1)
    expect(ctx.commands.setImage).toHaveBeenCalledWith('https://example.com/a.png')
    expect(ctx.notify).not.toHaveBeenCalledWith('请输入有效的图片地址', 'warning')
  })

  it('网络图片:非法地址给出提示且不插入', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="网络图片"]').trigger('click')
    await nextTick()
    const input = inputByPlaceholder('请输入图片地址 https://...')
    await setNativeInput(input, 'javascript:alert(1)')
    await clickBodyButton('确定')

    expect(ctx.commands.setImage).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('请输入有效的图片地址', 'warning')
  })

  it('视图按钮会抛出预览和全屏事件', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="预览"]').trigger('click')
    await wrapper.find('button[aria-label="全屏"]').trigger('click')

    expect(wrapper.emitted('toggle-preview')).toHaveLength(1)
    expect(wrapper.emitted('toggle-fullscreen')).toHaveLength(1)
  })

  it('使用 core 命令注册表的 label 渲染基础按钮', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: {
        ctx,
        toolbar: [['bold', 'undo', 'clearFormat']],
      },
    })

    expect(wrapper.find(`button[aria-label="${getCommandLabel('bold')}"]`).exists()).toBe(true)
    expect(wrapper.find(`button[aria-label="${getCommandLabel('undo')}"]`).exists()).toBe(true)
    expect(wrapper.find(`button[aria-label="${getCommandLabel('clearFormat')}"]`).exists()).toBe(true)
  })

  it('下拉和弹出类工具也接入 Naive tooltip 触发器', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    for (const label of [
      '标题',
      '字体',
      '字号',
      '行高',
      '文字颜色',
      '背景高亮',
      '文本对齐',
      '代码块',
      '插入表格',
      '导入 / 导出 Markdown',
    ]) {
      const button = wrapper.find(`button[aria-label="${label}"]`)
      expect(button.exists()).toBe(true)
      expect(button.element.closest('.tvp-tooltip-trigger')).toBeTruthy()
    }
  })

  it('标题下拉菜单会显示 H1-H6 对应的预览字号', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="标题"]').trigger('click')
    await nextTick()

    const heading1 = Array.from(document.body.querySelectorAll('span')).find(
      (node) => node.textContent?.trim() === '标题 1',
    ) as HTMLSpanElement | undefined
    const heading6 = Array.from(document.body.querySelectorAll('span')).find(
      (node) => node.textContent?.trim() === '标题 6',
    ) as HTMLSpanElement | undefined

    expect(heading1).toBeTruthy()
    expect(heading1!.style.fontSize).toBe('15px')
    expect(heading1!.style.fontWeight).toBe('700')
    expect(heading6).toBeTruthy()
    expect(heading6!.style.fontSize).toBe('12px')
    expect(heading6!.style.fontWeight).toBe('500')
  })

  it('格式化补充按钮会调用行内代码、上标、下标命令', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="行内代码"]').trigger('click')
    await wrapper.find('button[aria-label="上标"]').trigger('click')
    await wrapper.find('button[aria-label="下标"]').trigger('click')

    expect(ctx.commands.code).toHaveBeenCalledTimes(1)
    expect(ctx.commands.superscript).toHaveBeenCalledTimes(1)
    expect(ctx.commands.subscript).toHaveBeenCalledTimes(1)
  })

  it('仅渲染配置的内置工具栏项', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: {
        ctx,
        toolbar: [['bold', 'italic'], ['link']],
      },
    })

    expect(wrapper.find('button[aria-label="加粗"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="斜体"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="链接"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="网络图片"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="标题"]').exists()).toBe(false)
  })

  it('toolbar=false 时隐藏所有内置工具栏按钮', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx, toolbar: false },
    })

    expect(wrapper.find('.tvp-toolbar').exists()).toBe(true)
    expect(wrapper.find('button[aria-label]').exists()).toBe(false)
  })

  it('在配置分组前后渲染 before / after 插槽', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: {
        ctx,
        isFullscreen: true,
        isPreview: true,
        toolbar: [['bold']],
      },
      slots: {
        before: (slotProps) =>
          h(
            'button',
            {
              'data-testid': 'before',
              'data-fullscreen': String(slotProps.isFullscreen),
              onClick: slotProps.toggleFullscreen,
            },
            'Before',
          ),
        after: (slotProps) =>
          h(
            'button',
            {
              'data-testid': 'after',
              'data-preview': String(slotProps.isPreview),
              onClick: slotProps.togglePreview,
            },
            'After',
          ),
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('data-testid')).toBe('before')
    expect(buttons[buttons.length - 1].attributes('data-testid')).toBe('after')
    expect(wrapper.find('[data-testid="before"]').attributes('data-fullscreen')).toBe('true')
    expect(wrapper.find('[data-testid="after"]').attributes('data-preview')).toBe('true')
  })

  it('字体、字号、行高选择会分别调用对应命令', async () => {
    const ctx = createCtx(createEditor({ codeBlockLanguage: 'mermaid' }))
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })
    const vm = wrapper.vm as unknown as {
      onFontFamilySelect: (key: string | number) => void
      onFontSizeSelect: (key: string | number) => void
      onLineHeightSelect: (key: string | number) => void
    }

    vm.onFontFamilySelect('Arial')
    expect(ctx.commands.setFontFamily).toHaveBeenCalledWith('Arial')

    vm.onFontSizeSelect('96px')
    expect(ctx.commands.setFontSize).toHaveBeenCalledWith('96px')

    vm.onLineHeightSelect('1.6')
    expect(ctx.commands.setLineHeight).toHaveBeenCalledWith('1.6')
  })

  it('toolbarOptions 会覆盖工具栏菜单和动作配置', () => {
    const ctx = createCtx(createEditor({ codeBlockLanguage: 'mermaid' }))
    const exportFilename = () => 'notes.md'
    const toolbarOptions: ToolbarOptions = {
      fontFamilies: [{ label: '苹方', value: 'PingFang SC' }],
      fontSizes: ['', '13px'],
      lineHeights: ['', '1.75'],
      colors: ['#123456'],
      highlights: ['#abcdef'],
      codeBlockLanguages: [{ label: 'Mermaid', value: 'mermaid' }],
      tableGrid: { maxRows: 3, maxCols: 4 },
      markdown: { importAccept: '.mdx,text/markdown', exportFilename },
      print: { title: '打印预览', cleanupDelay: 25 },
    }
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx, toolbarOptions },
    })
    const vm = wrapper.vm as unknown as {
      FONT_FAMILIES: Array<{ label: string; value: string }>
      FONT_SIZES: string[]
      LINE_HEIGHTS: string[]
      PRESET_COLORS: string[]
      PRESET_HIGHLIGHTS: string[]
      CODE_BLOCK_LANGUAGE_OPTIONS: Array<{ label: string; value: string }>
      TABLE_MAX_ROWS: number
      TABLE_MAX_COLS: number
      MARKDOWN_IMPORT_ACCEPT: string
      currentCodeBlockLabel: string
    }

    expect(vm.FONT_FAMILIES).toEqual([{ label: '苹方', value: 'PingFang SC' }])
    expect(vm.FONT_SIZES).toEqual(['', '13px'])
    expect(vm.LINE_HEIGHTS).toEqual(['', '1.75'])
    expect(vm.PRESET_COLORS).toEqual(['#123456'])
    expect(vm.PRESET_HIGHLIGHTS).toEqual(['#abcdef'])
    expect(vm.CODE_BLOCK_LANGUAGE_OPTIONS).toEqual([{ label: 'Mermaid', value: 'mermaid' }])
    expect(vm.TABLE_MAX_ROWS).toBe(3)
    expect(vm.TABLE_MAX_COLS).toBe(4)
    expect(vm.MARKDOWN_IMPORT_ACCEPT).toBe('.mdx,text/markdown')
    expect(vm.currentCodeBlockLabel).toBe('Mermaid')
    expect(wrapper.find('input[accept=".mdx,text/markdown"]').exists()).toBe(true)
  })

  it('缩进按钮会调用 increaseIndent / decreaseIndent', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="减少缩进"]').trigger('click')
    await wrapper.find('button[aria-label="增加缩进"]').trigger('click')

    expect(ctx.commands.decreaseIndent).toHaveBeenCalledTimes(1)
    expect(ctx.commands.increaseIndent).toHaveBeenCalledTimes(1)
  })

  it('代码块语言菜单会用所选语言创建代码块', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })
    const vm = wrapper.vm as unknown as {
      codeBlockOptions: Array<{ label: string; key: string }>
      onCodeBlockSelect: (key: string | number) => void
    }

    expect(vm.codeBlockOptions).toContainEqual({ label: 'TypeScript', key: 'typescript' })
    vm.onCodeBlockSelect('typescript')

    expect(ctx.commands.codeBlock).toHaveBeenCalledWith('typescript')
  })

  it('代码块语言菜单使用 Naive Dropdown,不保留自绘菜单样式', () => {
    const source = readFileSync(`${process.cwd()}/src/Toolbar.vue`, 'utf8')

    expect(source).toContain(':options="codeBlockOptions"')
    expect(source).toContain(':render-label="renderCodeBlockLabel"')
    expect(source).not.toContain('tvp-code-language-menu')
  })

  it('工具栏 UI 角色使用 Naive UI 对应控件', () => {
    const source = readFileSync(`${process.cwd()}/src/Toolbar.vue`, 'utf8')

    for (const item of ['heading', 'fontFamily', 'fontSize', 'lineHeight', 'align', 'codeBlock', 'markdown']) {
      expect(source).toContain(`item === '${item}'`)
      expect(source).toMatch(new RegExp(`item === '${item}'[\\s\\S]*<NDropdown`))
    }
    for (const item of ['color', 'highlight', 'table']) {
      expect(source).toContain(`item === '${item}'`)
      expect(source).toMatch(new RegExp(`item === '${item}'[\\s\\S]*<NPopover`))
    }
    expect(source).toContain('<NModal')
    expect(source).toContain('v-model:show="urlModalVisible"')
    expect(source).toContain('v-model:show="linkDialogVisible"')
    expect(source).toContain(':accept="IMAGE_ACCEPT"')
    expect(source).toContain(':accept="MARKDOWN_IMPORT_ACCEPT"')
  })

  it('链接弹窗:输入文字和 URL 后按保存位置插入链接', async () => {
    const ctx = createCtx(createEditor())
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('显示的文字(留空则用链接地址)'), 'Example')
    await setNativeInput(inputByPlaceholder('https://example.com'), 'https://example.com')
    await clickBodyButton('确定')

    expect(ctx.prepareInsert).toHaveBeenCalledTimes(1)
    expect(ctx.commands.insertLinkText).toHaveBeenCalledWith(
      'https://example.com',
      'Example',
      { target: '_blank', range: { from: 3, to: 3 } },
    )
  })

  it('editorBehaviorOptions 可配置链接默认 target 为当前窗口', async () => {
    const ctx = createCtx(createEditor())
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: {
        ctx,
        editorBehaviorOptions: {
          link: { defaultTarget: '_self' },
        },
      },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('显示的文字(留空则用链接地址)'), 'Example')
    await setNativeInput(inputByPlaceholder('https://example.com'), 'https://example.com')
    await clickBodyButton('确定')

    expect(ctx.commands.insertLinkText).toHaveBeenCalledWith(
      'https://example.com',
      'Example',
      { target: '_self', range: { from: 3, to: 3 } },
    )
  })

  it('链接弹窗:非法 URL 给出提示且不写入', async () => {
    const ctx = createCtx(createEditor())
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('https://example.com'), 'not-a-url')
    await clickBodyButton('确定')

    expect(ctx.commands.insertLinkText).not.toHaveBeenCalled()
    expect(ctx.commands.setLink).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('链接格式不正确,请输入完整网址(如 https://example.com)', 'warning')
  })

  it('链接弹窗:当前在链接上且清空地址时移除链接', async () => {
    const ctx = createCtx(createEditor({ inLink: true, empty: false }))
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })

    await wrapper.find('button[aria-label="链接"]').trigger('click')
    await setNativeInput(inputByPlaceholder('https://example.com'), '')
    await clickBodyButton('确定')

    expect(ctx.commands.setLink).toHaveBeenCalledWith('', {
      target: '_blank',
      range: { from: 3, to: 10 },
    })
    expect(ctx.notify).toHaveBeenCalledWith('已移除链接', 'success')
  })

  it('上传图片:选择文件后调用 uploadAndInsertImage 并清空 input', async () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx, uploadImage: vi.fn() },
    })
    const input = wrapper.find('input[accept="image/*"]').element as HTMLInputElement
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'a.png',
    })

    await wrapper.find('input[accept="image/*"]').trigger('change')

    expect(ctx.commands.uploadAndInsertImage).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
  })

  it('editorBehaviorOptions 可配置图片上传 accept', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: {
        ctx,
        uploadImage: vi.fn(),
        editorBehaviorOptions: {
          image: { accept: 'image/png,image/jpeg' },
        },
      },
    })

    expect(wrapper.find('input[accept="image/png,image/jpeg"]').exists()).toBe(true)
  })

  it('Markdown 菜单文案保持简化,菜单项图标文字间距统一', () => {
    const ctx = createCtx()
    wrapper = mount(Toolbar, {
      attachTo: document.body,
      props: { ctx },
    })
    const vm = wrapper.vm as unknown as { mdOptions: Array<{ label?: string }> }
    const source = readFileSync(`${process.cwd()}/src/Toolbar.vue`, 'utf8')

    expect(vm.mdOptions.map((option) => option.label)).toEqual(TOOLBAR_MARKDOWN_OPTIONS.map((option) => option.label))
    expect(source).toContain('gap:6px')
  })

  it('图标按钮尺寸和字体按钮宽度保持稳定,避免 tooltip 字体被截断', () => {
    const source = readFileSync(`${process.cwd()}/src/Toolbar.vue`, 'utf8')

    expect(source).toContain('.tvp-toolbar .tvp-icon-btn')
    expect(source).toContain('width: 32px')
    expect(source).toContain('height: 32px')
    expect(source).toContain('.tvp-toolbar .tvp-select-btn--font')
    expect(source).toContain('width: 86px')
  })
})
