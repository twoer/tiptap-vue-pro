import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ResolvedEditorImageCropOptions } from './editorBehaviorOptions'
import type { ProEditorDebugLogFn } from './debug'
import { cropImageFile } from './imageCrop'

export interface ImageCropControllerOptions {
  getCropOptions: () => ResolvedEditorImageCropOptions
  uploadImage: (file: File) => Promise<void>
  notifyCropFailed: () => void
  debugLog?: ProEditorDebugLogFn
}

interface ImageCropDraggingState {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
}

export function useImageCropController(options: ImageCropControllerOptions) {
  const visible = ref(false)
  const queue = shallowRef<File[]>([])
  const currentFile = shallowRef<File | null>(null)
  const objectUrl = ref('')
  const preview = shallowRef<HTMLDivElement | null>(null)
  const image = shallowRef<HTMLImageElement | null>(null)
  const zoom = ref(1)
  const pan = ref({ x: 0, y: 0 })
  const dragging = ref<ImageCropDraggingState | null>(null)
  const imageStyle = computed(() => ({
    transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`,
    cursor: zoom.value > 1 ? (dragging.value ? 'grabbing' : 'grab') : 'default',
  }))

  function revokeObjectUrl() {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }

  function getMaxPan() {
    const box = preview.value?.getBoundingClientRect()
    const zoomOverflow = Math.max(0, zoom.value - 1)
    return {
      x: box ? (box.width * zoomOverflow) / 2 : 0,
      y: box ? (box.height * zoomOverflow) / 2 : 0,
    }
  }

  function clampPan(next = pan.value) {
    const maxPan = getMaxPan()
    pan.value = {
      x: Math.min(maxPan.x, Math.max(-maxPan.x, next.x)),
      y: Math.min(maxPan.y, Math.max(-maxPan.y, next.y)),
    }
  }

  function getOffsets() {
    const maxPan = getMaxPan()
    return {
      offsetX: maxPan.x > 0 ? -pan.value.x / maxPan.x : 0,
      offsetY: maxPan.y > 0 ? -pan.value.y / maxPan.y : 0,
    }
  }

  function stopDragging(pointerId?: number) {
    const activeDrag = dragging.value
    if (!activeDrag) return
    if (typeof pointerId === 'number' && activeDrag.pointerId !== pointerId) return

    dragging.value = null
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('blur', onWindowBlur)

    try {
      if (preview.value?.hasPointerCapture(activeDrag.pointerId)) {
        preview.value.releasePointerCapture(activeDrag.pointerId)
      }
    } catch {
      // The browser may already have released capture.
    }
  }

  function resetTransform() {
    stopDragging()
    zoom.value = 1
    pan.value = { x: 0, y: 0 }
  }

  function openNext() {
    revokeObjectUrl()
    image.value = null
    resetTransform()
    const [file] = queue.value
    currentFile.value = file ?? null
    if (!file) {
      visible.value = false
      return
    }
    objectUrl.value = URL.createObjectURL(file)
    visible.value = true
  }

  function openQueue(files: File[]) {
    queue.value = [...files]
    options.debugLog?.('upload', 'image-crop:open', { fileCount: files.length })
    openNext()
  }

  function finishCurrent() {
    queue.value = queue.value.slice(1)
    openNext()
  }

  function cancel() {
    const fileCount = queue.value.length
    stopDragging()
    queue.value = []
    currentFile.value = null
    visible.value = false
    revokeObjectUrl()
    if (fileCount > 0) {
      options.debugLog?.('upload', 'image-crop:cancel', { fileCount }, 'info')
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (zoom.value <= 1) return
    event.preventDefault()
    stopDragging()
    try {
      preview.value?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture can fail if the pointer is already released.
    }
    dragging.value = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.value.x,
      panY: pan.value.y,
    }
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('blur', onWindowBlur)
  }

  function onPointerMove(event: PointerEvent) {
    const activeDrag = dragging.value
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      stopDragging(event.pointerId)
      return
    }
    event.preventDefault()
    clampPan({
      x: activeDrag.panX + event.clientX - activeDrag.startX,
      y: activeDrag.panY + event.clientY - activeDrag.startY,
    })
  }

  function onPointerUp(event: PointerEvent) {
    stopDragging(event.pointerId)
  }

  function onWindowBlur() {
    stopDragging()
  }

  async function confirm() {
    const file = currentFile.value
    if (!file) return
    let uploadFile = file
    try {
      if (image.value) {
        options.debugLog?.('upload', 'image-crop:start', { fileName: file.name })
        uploadFile = await cropImageFile(file, image.value, {
          ...options.getCropOptions(),
          zoom: zoom.value,
          ...getOffsets(),
        })
        options.debugLog?.('upload', 'image-crop:success', { fileName: file.name }, 'info')
      }
    } catch (error) {
      options.debugLog?.(
        'upload',
        'image-crop:error',
        { fileName: file.name },
        'error',
        error,
      )
      options.notifyCropFailed()
    }
    await options.uploadImage(uploadFile)
    finishCurrent()
  }

  async function skip() {
    const file = currentFile.value
    if (!file) return
    options.debugLog?.('upload', 'image-crop:skip', { fileName: file.name }, 'info')
    await options.uploadImage(file)
    finishCurrent()
  }

  watch(zoom, () => clampPan())
  onScopeDispose(() => {
    stopDragging()
    revokeObjectUrl()
  })

  return {
    visible,
    currentFile,
    objectUrl,
    preview,
    image,
    zoom,
    pan,
    imageStyle,
    openQueue,
    cancel,
    clampPan,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    confirm,
    skip,
  }
}
