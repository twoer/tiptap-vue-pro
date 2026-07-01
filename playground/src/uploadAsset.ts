import { ElMessage } from 'element-plus'
import type { UploadAsset, UploadAssetKind, UploadedAsset } from 'tiptap-vue-pro-core'

export const MEDIA_UPLOAD_MAX_SIZE = 50 * 1024 * 1024 // 50 MB

export const uploadAsset: UploadAsset = async (
  file: File,
  kind: UploadAssetKind,
): Promise<UploadedAsset | null> => {
  if (file.size > MEDIA_UPLOAD_MAX_SIZE) {
    ElMessage.error(`文件过大(${(file.size / 1024 / 1024).toFixed(1)} MB),上限 50 MB`)
    return null
  }
  if (kind === 'video' && !file.type.startsWith('video/')) {
    ElMessage.error('只支持视频文件')
    return null
  }
  if (kind === 'audio' && !file.type.startsWith('audio/')) {
    ElMessage.error('只支持音频文件')
    return null
  }

  // Playground 演示模式:使用 object URL,刷新页面后会失效。
  // 真实项目请上传到业务服务 / OSS / COS / S3 后返回稳定 URL。
  return {
    url: URL.createObjectURL(file),
    name: file.name,
    size: file.size,
    mimeType: file.type,
    uploadedAt: Date.now(),
  }
}
