import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor } from '../useProEditor'
import { ImageExtended } from './image'
import type { ProEditorContext } from '../types'

/**
 * ImageExtended 自定义扩展的单元测试。
 *
 * 这是对标飞书图片功能的数据层:在官方 Image 基础上开启 resize 并预留
 * align/caption 属性。漏配或写错任一项,adapter 的图片工具条就会静默失效。
 * 这里验证:
 * 1. 扩展名仍是 image(保证官方 setImage 命令、parseHTML 仍可用)
 * 2. resize 选项正确开启
 * 3. align/caption 属性的 parseHTML/renderHTML 行为(中心化逻辑,UI 无关)
 */

describe('ImageExtended', () => {
  it('扩展名为 image(保持与官方兼容)', () => {
    expect(ImageExtended.name).toBe('image')
  })

  it('开启了 resize 且锁比例', () => {
    const resize = (ImageExtended as any).options.resize
    expect(resize).toBeTruthy()
    expect(resize.enabled).toBe(true)
    expect(resize.alwaysPreserveAspectRatio).toBe(true)
  })

  it('resize 方向为四角', () => {
    const dirs = (ImageExtended as any).options.resize.directions
    expect(dirs).toEqual(
      expect.arrayContaining(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
    )
  })

  describe('align 属性', () => {
    // 属性定义存在 addAttributes 返回值里,通过扩展配置取出
    const attrs = (ImageExtended as any).config.addAttributes.call({
      parent: () => ({ src: {}, alt: {} }),
    })
    const align = attrs.align

    it('parseHTML 读 data-align,缺省 center', () => {
      const el = document.createElement('img')
      expect(align.parseHTML(el)).toBe('center')
      el.setAttribute('data-align', 'left')
      expect(align.parseHTML(el)).toBe('left')
    })

    it('renderHTML: center(默认)不输出属性', () => {
      expect(align.renderHTML({ align: 'center' })).toEqual({})
    })

    it('renderHTML: left/right 输出 data-align', () => {
      expect(align.renderHTML({ align: 'left' })).toEqual({ 'data-align': 'left' })
      expect(align.renderHTML({ align: 'right' })).toEqual({ 'data-align': 'right' })
    })
  })

  describe('caption 属性', () => {
    const attrs = (ImageExtended as any).config.addAttributes.call({
      parent: () => ({ src: {}, alt: {} }),
    })
    const caption = attrs.caption

    it('parseHTML 读 data-caption,缺省空串', () => {
      const el = document.createElement('img')
      expect(caption.parseHTML(el)).toBe('')
      el.setAttribute('data-caption', '说明')
      expect(caption.parseHTML(el)).toBe('说明')
    })

    it('renderHTML: 空串不输出属性', () => {
      expect(caption.renderHTML({ caption: '' })).toEqual({})
    })

    it('renderHTML: 有值输出 data-caption', () => {
      expect(caption.renderHTML({ caption: '图1' })).toEqual({ 'data-caption': '图1' })
    })
  })
})

/**
 * NodeView 集成测试:挂载真实编辑器,验证题注输入框确实渲染并能双向同步。
 *
 * NodeView 是 DOM 层渲染,必须在真实编辑器里验证——光测 schema 测不到
 * 「input 是否生成」「输入是否写回属性」「对齐是否反映到外层 data-align」。
 *
 * 注意:查询以 editor.view.dom 为根(happy-dom 下 document.body 可能残留多个
 * 编辑器实例,直接 document.querySelector 不可靠),并用 afterEach 卸载清理。
 */
describe('ImageExtended — NodeView 渲染(题注/对齐)', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  async function mountWithImage(content: string, options: { editable?: boolean } = {}): Promise<ProEditorContext> {
    let ctx: ProEditorContext | undefined
    const modelValue = ref(content)
    const Comp = defineComponent({
      setup() {
        ctx = useProEditor({
          get content() {
            return modelValue.value
          },
          set content(v) {
            modelValue.value = v
          },
          output: 'html',
          editable: options.editable ?? true,
        } as any)
        return () => h(EditorContent, { editor: ctx!.editor.value })
      },
    })
    wrapper = mount(Comp, { attachTo: document.body })
    const c = ctx!
    for (let i = 0; i < 20 && !c.editor.value; i++) {
      await nextTick()
    }
    await nextTick()
    return c
  }

  /** 以编辑器 view.dom 为根查询,避开 document.body 多实例污染 */
  function query(ctx: ProEditorContext, selector: string) {
    return ctx.editor.value!.view.dom.querySelector(selector)
  }

  it('渲染出题注 input(占位文案 + tvp-img-caption 类)', async () => {
    const ctx = await mountWithImage('<img src="a.png">')
    const input = query(ctx, '.tvp-img-caption') as HTMLInputElement | null
    expect(input).toBeTruthy()
    expect(input!.placeholder).toBe('添加题注')
  })

  it('已有 data-caption 时回填到 input', async () => {
    const ctx = await mountWithImage('<img src="a.png" data-caption="预设说明">')
    const input = query(ctx, '.tvp-img-caption') as HTMLInputElement
    expect(input.value).toBe('预设说明')
  })

  it('对齐属性反映到外层 data-align', async () => {
    const ctx = await mountWithImage('<img src="a.png" data-align="right">')
    const outer = query(ctx, '.tvp-img-node') as HTMLElement
    expect(outer.getAttribute('data-align')).toBe('right')
  })

  it('题注 input 输入会写回 data-caption 属性', async () => {
    const ctx = await mountWithImage('<img src="a.png">')
    ctx.editor.value!.chain().setNodeSelection(0).run()
    await nextTick()
    const input = query(ctx, '.tvp-img-caption') as HTMLInputElement
    input.value = '输入的题注'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    // 写回了节点属性 → getHTML 应包含 data-caption
    expect(ctx.getHTML()).toContain('data-caption="输入的题注"')
  })

  it('切换只读后题注 input 不可编辑且不会写回 data-caption', async () => {
    const ctx = await mountWithImage('<img src="a.png">')
    ctx.editor.value!.chain().setNodeSelection(0).run()
    await nextTick()
    const input = query(ctx, '.tvp-img-caption') as HTMLInputElement

    ctx.setEditable(false)
    await nextTick()

    expect(input.readOnly).toBe(true)
    input.value = '只读下的输入'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    expect(ctx.getHTML()).not.toContain('data-caption="只读下的输入"')
  })

  it('切换只读后图片 resize 交互禁用,恢复编辑后重新启用', async () => {
    const ctx = await mountWithImage('<img src="a.png">')
    const resizable = query(ctx, '.tvp-img-resizable') as HTMLElement
    const img = query(ctx, '.tvp-img-resizable img') as HTMLImageElement

    expect(resizable).toBeTruthy()
    img.dispatchEvent(new Event('load'))
    await nextTick()
    expect(resizable.style.pointerEvents).toBe('')

    ctx.setEditable(false)
    await nextTick()
    expect(resizable.style.pointerEvents).toBe('none')

    ctx.setEditable(true)
    await nextTick()
    expect(resizable.style.pointerEvents).toBe('')
  })
})
