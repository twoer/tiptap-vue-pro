import Image from '@tiptap/extension-image'
import type { Extensions } from '@tiptap/core'
import { createImageNodeView } from './imageNodeView'

/**
 * 自定义 Image 扩展(基于官方 @tiptap/extension-image)。
 *
 * 在官方基础上增强两点(对标飞书图片):
 * 1. 开启 v3 原生 resize —— 通过 configure.resize 配置 ResizableNodeView,
 *    支持四角拖拽缩放(alwaysPreserveAspectRatio 锁比例,与飞书一致)。
 * 2. 预留 align / caption 两个 schema 属性 —— 对齐与题注的「数据层」。
 *    属性定义本身不依赖任何 UI;具体渲染(NodeView 的对齐样式、题注输入框)
 *    在后续能力里逐步叠加。
 *
 * 架构约束:本文件在 core/,严禁引入 UI 库或 .vue。NodeView 一律用原生 DOM
 * (Tiptap 扩展本身的 addNodeView 用 document.createElement 是框架无关的正常能力,
 * 不算「依赖具体 UI 库」)。
 */

/** 图片对齐方式 */
export type ImageAlign = 'left' | 'center' | 'right'

/** 图片尺寸预设(相对编辑器内容区宽度的比例;'original' 清除宽度回归自然尺寸) */
export type ImageSizePreset = 'small' | 'medium' | 'large' | 'original'

/**
 * 扩展后的 Image。
 *
 * 链式顺序:extend(改 schema/命令) → configure(设 options)。
 * extend 必须在 configure 之前,否则 configure 的 options 不会被 extend 后的
 * 扩展读到。
 */
export const ImageExtended = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /**
       * 对齐:data-align 属性。默认 center(与飞书默认居中一致)。
       * 渲染层(CSS)根据该属性控制图片在内容区的水平位置。
       */
      align: {
        default: 'center',
        parseHTML: (el) => (el.getAttribute('data-align') as ImageAlign) || 'center',
        renderHTML: (attrs) => {
          const align = (attrs as { align?: ImageAlign }).align
          return align && align !== 'center' ? { 'data-align': align } : {}
        },
      },
      /**
       * 题注:data-caption 属性。空串表示无题注。
       * 渲染层(NodeView)把它显示为图片下方的可编辑输入框。
       */
      caption: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-caption') || '',
        renderHTML: (attrs) => {
          const caption = (attrs as { caption?: string }).caption
          return caption ? { 'data-caption': caption } : {}
        },
      },
    }
  },
  /**
   * 自定义 NodeView:复用官方 ResizableNodeView(四角手柄) + 追加题注输入框。
   * 完全原生 DOM 实现(core 无 UI 依赖),逻辑见 imageNodeView.ts。
   * 仅在客户端(document 存在)且有 resize 配置时启用;否则回退官方默认。
   */
  addNodeView() {
    return ({ node, getPos, HTMLAttributes, editor }) => {
      return createImageNodeView(
        { node, getPos, HTMLAttributes, editor } as never,
        this.options.HTMLAttributes,
      )
    }
  },
}).configure({
  inline: false,
  allowBase64: false, // 强制走上传,避免 base64 撑大文档
  resize: {
    enabled: true,
    // v3 的方向键值用连字符格式(见 @tiptap/core 的 ResizableNodeViewDirection)
    directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    minWidth: 60,
    minHeight: 60,
    alwaysPreserveAspectRatio: true, // 锁比例,飞书行为
  },
})

// 保持与 extensions.ts 现有「Extensions 兼容」的导出风格
export type { Extensions }
