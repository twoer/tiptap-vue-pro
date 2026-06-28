import { mergeAttributes, ResizableNodeView, type Editor, type NodeViewProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * 图片的 NodeView(原生 DOM 实现,core 无 UI 依赖)。
 *
 * 在官方 Image 扩展的可调整大小 NodeView 基础上,额外渲染图片下方的
 * 「题注输入框」(对标飞书)。结构:
 *
 *   <div class="tvp-img-node" data-align=...>        ← 外层(对齐 + 选中态)
 *     <div class="tvp-img-resizable">…官方手柄…</div> ← ResizableNodeView.dom
 *     <input class="tvp-img-caption" />              ← 题注(可编辑)
 *   </div>
 *
 * 设计要点:
 * 1. 复用官方 ResizableNodeView 拿到「四角手柄 + 锁比例」能力,不重造轮子。
 *    把它的 dom(container)插到我们的外层 div 里。
 * 2. 题注用 <input>(非 contenteditable),输入时 updateAttributes 写回 data-caption,
 *    避免在文档里引入嵌套可编辑区域导致 ProseMirror 光标混乱。
 * 3. 对齐通过外层 data-align 控制(渲染层 CSS 用 margin:auto/text-align 处理)。
 * 4. 完全原生 DOM,无 .vue / 无 UI 库 —— 遵守 core 无 UI 边界。
 *
 * NodeView 接口需实现:dom / contentDOM(无,atom 节点返回 undefined)/
 * update(节点属性变化时同步 UI)/ destroy(解绑监听)/ ignoreMutation(题注
 * input 的变化不应被 ProseMirror 当作文档变更)。
 *
 * 返回类型用 @tiptap/pm 的 NodeView(ProseMirror 接口),方法签名严格对齐,
 * 避免 vue-tsc 在 addNodeView 处报「类型不兼容」。
 */
import type { NodeView as PMNodeView } from '@tiptap/pm/view'

/**
 * 创建图片 NodeView。
 *
 * @param props Tiptap 注入的 NodeViewProps(node/getPos/HTMLAttributes/editor)
 * @param extOptions 扩展自身的 options(HTMLAttributes),用于合并到 img 上
 */
export function createImageNodeView(
  props: NodeViewProps,
  extHTMLAttributes: Record<string, unknown>,
): PMNodeView {
  const { node, getPos, HTMLAttributes, editor } = props

  // ---- 外层容器(承载对齐 + 选中态样式) ----
  const outer = document.createElement('div')
  outer.className = 'tvp-img-node'
  const align = (node.attrs as { align?: string }).align || 'center'
  if (align && align !== 'center') outer.setAttribute('data-align', align)

  // ---- 可调整大小的 img(复用官方 ResizableNodeView) ----
  // 注:图片未加载完成前先隐藏手柄,避免闪现错误尺寸(与官方实现一致)
  const img = document.createElement('img')
  img.draggable = false
  const merged = mergeAttributes(extHTMLAttributes, HTMLAttributes) as Record<string, unknown>
  for (const [key, value] of Object.entries(merged)) {
    if (value == null) continue
    // width/height 由 ResizableNodeView 通过 style 控制,这里不写 attribute
    if (key === 'width' || key === 'height') continue
    // data-align/caption 是节点属性,不写死到 img 上(由外层和 input 管理)
    if (key === 'align' || key === 'caption') continue
    img.setAttribute(key, String(value))
  }
  if (merged.src != null) img.src = String(merged.src)

  const resizable = new ResizableNodeView({
    element: img,
    editor: editor as Editor,
    node,
    getPos,
    onResize: (width, height) => {
      img.style.width = `${width}px`
      img.style.height = `${height}px`
    },
    onCommit: (width, height) => {
      const pos = getPos()
      if (pos === undefined) return
      ;(editor as Editor)
        .chain()
        .setNodeSelection(pos)
        .updateAttributes('image', { width, height })
        .run()
    },
    onUpdate: (updatedNode) => {
      // 节点类型变化时重建;否则接受更新(update 内部会刷新 node 引用)
      return updatedNode.type === node.type
    },
    options: {
      directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      min: { width: 60, height: 60 },
      preserveAspectRatio: true,
    },
  })

  // 官方实现:图片加载前隐藏 container,加载后显示(避免手柄闪到错误位置)。
  // 但必须同时兜底 onerror——若 src 加载失败(404/网络),onload 永远不触发,
  // 手柄会被永久隐藏,用户无法调整大小。这里无论成功/失败都恢复显示。
  resizable.dom.style.visibility = 'hidden'
  resizable.dom.style.pointerEvents = 'none'
  // 图片加载完成时:① 恢复手柄显示;② 强制图片气泡菜单按加载后的真实尺寸
  // 重新定位。BubbleMenuPlugin 仅在 selection/doc 变化时重算位置,而图片加载
  // 不产生 transaction,导致菜单停留在「图片高度 0」时的错位(偏下),加载完
  // 跳到正确位置(上方),造成「先在下面后跳上面」的视觉抖动。
  // 用官方支持的 pluginKey meta 'updatePosition' 触发重定位(见 BubbleMenu 源码
  // transactionHandler)。
  const reveal = () => {
    resizable.dom.style.visibility = ''
    resizable.dom.style.pointerEvents = ''
    const view = (editor as Editor).view
    view.dispatch(view.state.tr.setMeta('proImageBubbleMenu', 'updatePosition'))
  }
  img.addEventListener('load', reveal, { once: true })
  img.addEventListener('error', reveal, { once: true })
  outer.appendChild(resizable.dom)

  // ---- 题注输入框 ----
  const captionInput = document.createElement('input')
  captionInput.className = 'tvp-img-caption'
  captionInput.type = 'text'
  captionInput.placeholder = '添加题注'
  const initialCaption = (node.attrs as { caption?: string }).caption || ''
  captionInput.value = initialCaption
  if (!initialCaption) captionInput.classList.add('tvp-img-caption-empty')
  // 只读模式下题注不可编辑,但仍显示
  const syncCaptionReadonly = () => {
    captionInput.readOnly = !(editor as Editor).isEditable
  }
  syncCaptionReadonly()
  const onEditorUpdate = () => syncCaptionReadonly()
  ;(editor as Editor).on('update', onEditorUpdate)
  // 输入即写回 data-caption 属性
  const onCaptionInput = () => {
    // 只读/预览切换后,旧 NodeView 仍可能收到 input 事件;这里再做一次写入保护。
    if (!(editor as Editor).isEditable) return
    const pos = getPos()
    if (pos === undefined) return
    const val = captionInput.value
    captionInput.classList.toggle('tvp-img-caption-empty', !val)
    ;(editor as Editor)
      .chain()
      .setNodeSelection(pos)
      .updateAttributes('image', { caption: val })
      .run()
  }
  captionInput.addEventListener('input', onCaptionInput)
  // 拦截题注输入框内的键盘事件,避免触发编辑器快捷键(如 Backspace 删节点)
  const onCaptionKeydown = (e: KeyboardEvent) => {
    e.stopPropagation()
  }
  captionInput.addEventListener('keydown', onCaptionKeydown)
  outer.appendChild(captionInput)

  // ---- NodeView 接口实现 ----
  return {
    dom: outer,
    contentDOM: undefined, // atom 节点无嵌套可编辑内容
    update(updatedNode: PMNode) {
      if (updatedNode.type !== node.type) return false
      const attrs = updatedNode.attrs as { align?: string; caption?: string; src?: string; width?: number | null; height?: number | null }
      // 同步对齐(外层 data-align)
      const newAlign = attrs.align || 'center'
      if (newAlign && newAlign !== 'center') outer.setAttribute('data-align', newAlign)
      else outer.removeAttribute('data-align')
      // editable 不是节点属性,但只读/预览切换会触发 editor.setEditable。
      // NodeView 可能不会重建,因此每次更新时同步 input 状态。
      syncCaptionReadonly()
      // 同步题注(外部命令 setImageCaption 改了属性时,回填到 input)
      const newCaption = attrs.caption || ''
      if (newCaption !== captionInput.value) {
        captionInput.value = newCaption
        captionInput.classList.toggle('tvp-img-caption-empty', !newCaption)
      }
      // 同步 src(替换图片场景)
      const newSrc = attrs.src
      if (newSrc && newSrc !== img.getAttribute('src')) {
        img.src = newSrc
      }
      // 同步尺寸到 img.style.width/height。
      // 关键:工具条「小/中/大」按钮只更新节点 width 属性,ResizableNodeView 的
      // update() 不会把属性主动刷到 img.style(它只在拖拽手柄的 onResize 里设置)。
      // 所以这里显式按节点属性同步内联样式,否则点了尺寸按钮图片视觉不变。
      // original 预设会清空 width/height → 这里清空 style,回归自然尺寸。
      if (attrs.width != null) img.style.width = `${attrs.width}px`
      else img.style.width = ''
      if (attrs.height != null) img.style.height = `${attrs.height}px`
      else img.style.height = ''
      // 让 ResizableNodeView 处理尺寸更新(刷新内部 node 引用)
      return resizable.update(updatedNode as never, [] as never, undefined as never)
    },
    destroy() {
      ;(editor as Editor).off('update', onEditorUpdate)
      captionInput.removeEventListener('input', onCaptionInput)
      captionInput.removeEventListener('keydown', onCaptionKeydown)
      resizable.destroy()
    },
    // 题注 input / 手柄的 DOM 变化不应被 ProseMirror 视作文档变更
    ignoreMutation: () => true,
    // 题注 input 内的事件不应被 ProseMirror 编辑视图接管
    stopEvent(event: Event) {
      const target = event.target as HTMLElement | null
      return !!target && (target === captionInput || captionInput.contains(target))
    },
  }
}
