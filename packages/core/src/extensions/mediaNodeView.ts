import type { NodeViewProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import type { NodeView as PMNodeView } from '@tiptap/pm/view'

type MediaNodeName = 'video' | 'audio'

function booleanAttr(
  element: HTMLElement,
  name: string,
  enabled: unknown,
) {
  if (enabled) element.setAttribute(name, '')
  else element.removeAttribute(name)
}

function controlsList(attrs: Record<string, unknown>, type: MediaNodeName) {
  return [
    type === 'video' && attrs.allowFullscreen === false ? 'nofullscreen' : '',
    attrs.allowDownload === false ? 'nodownload' : '',
  ].filter(Boolean).join(' ')
}

function widthStyleValue(width: unknown) {
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) return `${width}px`
  if (typeof width === 'string' && width.trim()) return width.trim()
  return ''
}

function syncMediaElement(
  element: HTMLVideoElement | HTMLAudioElement,
  node: PMNode,
) {
  const type = node.type.name as MediaNodeName
  const attrs = node.attrs as Record<string, unknown>
  const src = String(attrs.src ?? '')
  if (src && element.getAttribute('src') !== src) element.setAttribute('src', src)
  else if (!src) element.removeAttribute('src')

  if (attrs.name) element.setAttribute('data-name', String(attrs.name))
  else element.removeAttribute('data-name')
  if (attrs.mimeType) element.setAttribute('data-mime-type', String(attrs.mimeType))
  else element.removeAttribute('data-mime-type')
  if (attrs.duration != null) element.setAttribute('data-duration', String(attrs.duration))
  else element.removeAttribute('data-duration')
  if (attrs.preload) element.setAttribute('preload', String(attrs.preload))
  else element.removeAttribute('preload')

  booleanAttr(element, 'controls', attrs.controls !== false)
  booleanAttr(element, 'muted', attrs.muted === true)
  booleanAttr(element, 'loop', attrs.loop === true)
  booleanAttr(element, 'autoplay', attrs.autoplay === true)

  const list = controlsList(attrs, type)
  if (list) element.setAttribute('controlslist', list)
  else element.removeAttribute('controlslist')

  const widthStyle = widthStyleValue(attrs.width)
  if (type === 'audio') {
    element.style.width = '100%'
    element.removeAttribute('width')
  } else if (widthStyle) {
    element.style.width = widthStyle
    element.setAttribute('width', String(attrs.width))
  } else {
    element.style.width = ''
    element.removeAttribute('width')
  }

  if (type === 'audio') {
    element.style.height = ''
    element.style.minHeight = '40px'
    return
  }

  const video = element as HTMLVideoElement
  if (attrs.poster) video.setAttribute('poster', String(attrs.poster))
  else video.removeAttribute('poster')
  booleanAttr(video, 'playsinline', attrs.playsInline !== false)
  booleanAttr(video, 'disablepictureinpicture', attrs.allowPictureInPicture === false)
}

function syncMediaContainer(container: HTMLElement, node: PMNode) {
  const type = node.type.name as MediaNodeName
  const widthStyle = widthStyleValue((node.attrs as Record<string, unknown>).width)
  container.dataset.mediaKind = type
  if (type === 'audio' && widthStyle) container.style.width = widthStyle
  else container.style.width = ''
}

export function createMediaNodeView(props: NodeViewProps): PMNodeView {
  const { node, getPos, editor } = props
  const type = node.type.name as MediaNodeName
  let currentNode = node
  const outer = document.createElement('div')
  outer.className = 'tvp-media-node'
  syncMediaContainer(outer, node)

  const frame = document.createElement('div')
  frame.className = 'tvp-media-resizable'

  const element = document.createElement(type) as HTMLVideoElement | HTMLAudioElement
  element.draggable = false
  syncMediaElement(element, node)
  frame.appendChild(element)
  outer.appendChild(frame)

  const selectNode = () => {
    if (!editor.isEditable) return
    const pos = getPos()
    if (pos === undefined) return
    const view = editor.view
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
    view.focus()
  }
  outer.addEventListener('pointerdown', selectNode, true)
  outer.addEventListener('mousedown', selectNode, true)
  outer.addEventListener('click', selectNode, true)

  return {
    dom: outer,
    contentDOM: undefined,
    update(updatedNode) {
      if (updatedNode.type.name !== type) return false
      currentNode = updatedNode
      syncMediaContainer(outer, currentNode)
      syncMediaElement(element, currentNode)
      return true
    },
    destroy() {
      outer.removeEventListener('pointerdown', selectNode, true)
      outer.removeEventListener('mousedown', selectNode, true)
      outer.removeEventListener('click', selectNode, true)
      outer.remove()
    },
    ignoreMutation: () => true,
    stopEvent: (event) => {
      const target = event.target as HTMLElement | null
      return !!target && outer.contains(target)
    },
  }
}
