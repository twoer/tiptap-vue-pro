import type { ResolvedEditorImageCropOptions } from './editorBehaviorOptions'

export interface ImageCropSourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface CropImageFileOptions extends ResolvedEditorImageCropOptions {
  zoom?: number
  offsetX?: number
  offsetY?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getCenteredImageCropSourceRect(
  naturalWidth: number,
  naturalHeight: number,
  aspectRatio: number,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
): ImageCropSourceRect {
  const safeWidth = Math.max(1, naturalWidth)
  const safeHeight = Math.max(1, naturalHeight)
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1
  const safeZoom = Math.max(1, zoom)
  const safeOffsetX = Number.isFinite(offsetX) ? clamp(offsetX, -1, 1) : 0
  const safeOffsetY = Number.isFinite(offsetY) ? clamp(offsetY, -1, 1) : 0
  const sourceRatio = safeWidth / safeHeight
  let sw = safeWidth
  let sh = safeHeight

  if (sourceRatio > safeRatio) {
    sw = safeHeight * safeRatio
  } else {
    sh = safeWidth / safeRatio
  }

  sw = Math.max(1, Math.min(safeWidth, sw / safeZoom))
  sh = Math.max(1, Math.min(safeHeight, sh / safeZoom))
  const maxSx = Math.max(0, safeWidth - sw)
  const maxSy = Math.max(0, safeHeight - sh)

  return {
    sx: clamp(maxSx / 2 + safeOffsetX * (maxSx / 2), 0, maxSx),
    sy: clamp(maxSy / 2 + safeOffsetY * (maxSy / 2), 0, maxSy),
    sw,
    sh,
  }
}

export async function cropImageFile(
  file: File,
  image: HTMLImageElement,
  options: CropImageFileOptions,
): Promise<File> {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!naturalWidth || !naturalHeight) return file

  const rect = getCenteredImageCropSourceRect(
    naturalWidth,
    naturalHeight,
    options.aspectRatio,
    options.zoom,
    options.offsetX,
    options.offsetY,
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rect.sw)
  canvas.height = Math.round(rect.sh)

  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const mimeType = options.mimeType || file.type || 'image/png'
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, options.quality)
  })

  if (!blob) return file
  return new File([blob], file.name, { type: blob.type || mimeType, lastModified: Date.now() })
}
