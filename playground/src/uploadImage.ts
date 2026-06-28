import { defineComponent, h, ref, type Ref } from 'vue'
import {
  ElNotification,
  ElProgress,
  ElMessage,
  type NotificationHandle,
} from 'element-plus'
import type { UploadImage } from 'tiptap-vue-pro-core'

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 生产级图片上传示例(可直接拷到真实项目改造使用)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Core 对外契约只有 `(file) => Promise<string | null>`(见 core/src/types.ts),
 * 不含进度回调——但函数体内做什么 Core 完全不关心。所以这里把「进度展示 /
 * 成功 / 失败提示」都封进 uploadImage 自己,保持 Core UI 无关的同时,
 * 给终端用户完整的上传反馈。
 *
 * 三个关键点:
 * 1. 用 XMLHttpRequest 而非 fetch:只有 XHR 提供 upload.onprogress 真实进度。
 * 2. 进度通过一个自带响应式的内联组件 + ElProgress 渲染,塞进 ElNotification
 *    的 message(EP 的 Notification 返回实例只有 close(),不能动态改 message,
 *    所以用「响应式子组件」让它在 notification 内部自驱重渲染)。
 * 3. 未配置端点时降级 base64,保证 playground 离线也能跑;真实项目删掉降级
 *    分支,把 UPLOAD_URL 换成自己的接口即可。
 */

/**
 * 上传接口地址。
 * 真实项目:改成你的 OSS/COS/自建服务接口,或读 import.meta.env.VITE_UPLOAD_URL。
 * 留空 → 走 base64 降级(仅 demo 用,生产环境务必配置真实端点)。
 */
const UPLOAD_URL = ''
/** 单图大小上限,超过直接拒,省得传一半才 413。 */
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * 进度提示条内联组件。
 * 接收外部 Ref<number>,ElProgress 的 percentage 绑定它,ref 变化时本组件
 * 自行重渲染(不依赖 notification 父级重渲染)。
 */
const ProgressMessage = defineComponent({
  name: 'UploadProgressMessage',
  props: { percent: { type: Object as () => Ref<number>, required: true } },
  setup(props) {
    return () =>
      h(ElProgress, {
        percentage: props.percent.value,
        strokeWidth: 8,
        status: props.percent.value >= 100 ? 'success' : undefined,
      })
  },
})

/**
 * 把 File 转成 dataURL——离线降级用。
 * 真实项目不会用到这个,删掉即可。
 */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 真实 HTTP 上传 + 进度。
 * 返回服务端给的 url;失败抛错(由 uploadImage 兜底提示)。
 */
function uploadViaHTTP(
  file: File,
  url: string,
  percent: Ref<number>,
  onProgress?: (e: ProgressEvent) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    // 字段名按你后端约定改;常见为 file / image / upload
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)

    // 真实上传进度(only when lengthComputable,否则保持 0 不误导)
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        percent.value = Math.round((e.loaded / e.total) * 100)
        onProgress?.(e)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          // 后端返回结构各项目不同,这里按 { url } / { data: { url } } 两种常见形态兼容
          const resultUrl: string | undefined = data?.url ?? data?.data?.url
          if (!resultUrl) {
            reject(new Error('服务端未返回图片地址'))
            return
          }
          percent.value = 100
          resolve(resultUrl)
        } catch {
          reject(new Error('服务端返回格式异常'))
        }
      } else {
        reject(new Error(`上传失败(HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误,上传失败'))
    xhr.send(form)
  })
}

/**
 * 对外暴露的上传函数,签名严格匹配 Core 的 UploadImage 契约。
 *
 * 流程:前置校验 → 弹进度通知 → 上传 → 成功/失败收尾。
 * 整个函数对 Core 是黑盒,Core 只 await 它的返回值。
 */
export const uploadImage: UploadImage = async (file) => {
  // 1. 前置校验:类型 + 大小。早失败早提示,不浪费网络。
  if (!file.type.startsWith('image/')) {
    ElMessage.error('只支持图片文件')
    return null
  }
  if (file.size > MAX_SIZE) {
    ElMessage.error(`图片过大(${(file.size / 1024 / 1024).toFixed(1)} MB),上限 10 MB`)
    return null
  }

  // 2. 离线降级:未配置端点 → base64。仅 demo 用。
  if (!UPLOAD_URL) {
    // eslint-disable-next-line no-console
    console.warn(
      '[uploadImage] 未配置 UPLOAD_URL,降级使用 base64。' +
        '真实项目请配置上传端点(见 uploadImage.ts 顶部说明)。',
    )
    const notify = ElNotification({
      title: '演示模式',
      message: '未配置上传服务,使用 base64 内嵌(仅用于本地演示)',
      type: 'info',
      duration: 2000,
    })
    try {
      const dataUrl = await fileToDataURL(file)
      ;(notify as NotificationHandle).close()
      ElMessage.success('图片已插入(演示模式)')
      return dataUrl
    } catch {
      ;(notify as NotificationHandle).close()
      ElMessage.error('读取图片失败')
      return null
    }
  }

  // 3. 真实上传:弹带进度条的通知
  const percent = ref(0)
  const notify = ElNotification({
    title: '图片上传中',
    message: h(ProgressMessage, { percent }),
    duration: 0, // 不自动关,等上传完手动关
    showClose: false,
  })

  try {
    const url = await uploadViaHTTP(file, UPLOAD_URL, percent)
    ;(notify as NotificationHandle).close()
    ElMessage.success('上传成功')
    return url
  } catch (err) {
    ;(notify as NotificationHandle).close()
    ElMessage.error(err instanceof Error ? err.message : '上传失败')
    return null
  }
}
