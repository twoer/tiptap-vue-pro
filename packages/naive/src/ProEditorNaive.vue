<script setup lang="ts">
/**
 * Tiptap Vue Pro 的 Naive UI 适配主组件。
 *
 * 用户用法:
 *   <ProEditorNaive v-model="content" :upload-image="upload" output="html" />
 *
 * 功能覆盖:v-model 双向绑定、完整工具栏、气泡菜单、
 * 图片粘贴/拖拽、全屏、预览、暗色、Markdown 导入导出、打印。
 *
 * 关键差异:
 * 1. 暗色:用 NConfigProvider + darkTheme 注入。
 *    好处:Naive 默认暗色已足够,不用手写一堆主题变量。
 * 2. 消息提示:Naive 的 useMessage 必须在 NMessageProvider 后代里调用,
 *    所以内部自包一层 NMessageProvider + MessageBridge 拿到 message API,
 *    再转成 notify 注入 Core。保证「开箱即用」,不强制宿主包 provider。
 *
 * active 态响应性:用 selectionTick 在 selection/transaction
 * 变化时 ++ 触发工具栏重渲染(Tiptap 的 isActive 不会自动触发 Vue 重渲染)。
 */
import { ref, watch, computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import {
  NConfigProvider,
  NMessageProvider,
  NButton,
  NTooltip,
  darkTheme,
  type MessageApi,
} from 'naive-ui'
import { Pencil } from 'lucide-vue-next'
import {
  createDebugLogger,
  useEditorEventBridge,
  useImageDropPaste,
  useProEditor,
  resolveLocale,
  type UploadAsset,
  type UploadImage,
  type OutputFormat,
  type Extensions,
  type NotifyType,
  type ProEditorContext,
  type ToolbarOptions,
  type ToolbarProp,
  type EditorBehaviorOptions,
  type LocaleKey,
  type LocaleProp,
  type ProEditorDebugLogger,
  type ProEditorDebugLogFn,
  type ProEditorDebugOptions,
} from 'tiptap-vue-pro-core'
import Toolbar from './Toolbar.vue'
import BubbleMenu from './BubbleMenu.vue'
import TableBubbleMenu from './TableBubbleMenu.vue'
import TableGripHandles from './TableGripHandles.vue'
import ImageBubbleMenu from './ImageBubbleMenu.vue'
import LinkBubbleMenu from './LinkBubbleMenu.vue'
import FileBubbleMenu from './FileBubbleMenu.vue'
import MediaBubbleMenu from './MediaBubbleMenu.vue'
import HorizontalRuleBubbleMenu from './HorizontalRuleBubbleMenu.vue'
import MessageBridge from './MessageBridge.vue'

const props = withDefaults(
  defineProps<{
    /** v-model 绑定值 */
    modelValue?: string | object
    /** 输出格式 */
    output?: OutputFormat
    /** placeholder */
    placeholder?: string
    /** 内置文案语言或自定义文案覆盖。默认 zh-CN */
    locale?: LocaleProp
    /** 图片上传函数 */
    uploadImage?: UploadImage
    /** 视频、音频、文件上传函数 */
    uploadAsset?: UploadAsset
    /** 是否只读 */
    readonly?: boolean
    /** 暗色模式 */
    dark?: boolean
    /** 是否显示底部字数统计,默认 true */
    showWordCount?: boolean
    /** 工具栏配置:false 隐藏内置按钮;数组控制内置按钮分组/顺序 */
    toolbar?: ToolbarProp
    /** 工具栏选项配置。用于覆盖菜单数据、表格网格、Markdown 和打印等预设 */
    toolbarOptions?: ToolbarOptions
    /** 编辑器行为配置。用于覆盖链接、表格、图片等默认行为 */
    editorBehaviorOptions?: EditorBehaviorOptions
    /** 自定义扩展(覆盖默认) */
    extensions?: Extensions
    /** 开发者诊断开关。默认关闭 */
    debug?: boolean | ProEditorDebugOptions
    /** 自定义诊断日志接收器 */
    debugLogger?: ProEditorDebugLogger
  }>(),
  {
    modelValue: '',
    output: 'html',
    placeholder: undefined,
    locale: undefined,
    readonly: false,
    dark: false,
    showWordCount: true,
    toolbar: undefined,
    toolbarOptions: undefined,
    editorBehaviorOptions: undefined,
    debug: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | object]
}>()

// Core 的 content 用一个可变 ref,把 v-model 和 Core 内部双向绑定桥接起来
const content = ref(props.modelValue)

// 外部 modelValue 变化 → 同步到 content
watch(
  () => props.modelValue,
  (v) => {
    if (v !== content.value) content.value = v
  },
)

// ---- 消息提示:MessageBridge 拿到 message API 后回填到这里 ----
// 用 shallowRef 存 message 实例(它内部有响应式,不必深响应)。
// notify 闭包读取它:实例就绪前静默(此时用户也点不到工具栏,不会触发提示)。
const messageApi = shallowRef<MessageApi | null>(null)
const bridgeRef = ref<InstanceType<typeof MessageBridge> | null>(null)
function handleBridgeReady() {
  const api = bridgeRef.value?.get?.() ?? null
  if (api) messageApi.value = api
}

// 用 Core 创建编辑器实例
//
// notify 注入:把 Core 的消息提示接到 Naive 的 useMessage,
// 与其他 adapter 对等——Core 决定「何时提示 + 文案」,adapter 决定「用什么显示」。
const ctx = useProEditor({
  get content() {
    return content.value
  },
  set content(v) {
    content.value = v
    emit('update:modelValue', v)
  },
  get output() {
    return props.output
  },
  placeholder: props.placeholder,
  get locale() {
    return props.locale
  },
  uploadImage: props.uploadImage,
  uploadAsset: props.uploadAsset,
  get editorBehaviorOptions() {
    return props.editorBehaviorOptions
  },
  editable: !props.readonly,
  extensions: props.extensions,
  get debug() {
    return props.debug
  },
  get debugLogger() {
    return props.debugLogger
  },
  notify: (msg: string, type?: NotifyType) => {
    const m = messageApi.value
    if (!m) return
    if (type === 'error') m.error(msg)
    else if (type === 'warning') m.warning(msg)
    else if (type === 'success') m.success(msg)
    else m.info(msg)
  },
} as any)

const debugLog: ProEditorDebugLogFn = (...args) => {
  createDebugLogger({
    debug: props.debug,
    debugLogger: props.debugLogger,
    source: 'naive',
  })(...args)
}

watch(
  () => props.output,
  (format) => {
    const next = format === 'json' ? ctx.getJSON() : ctx.getHTML()
    content.value = next
    emit('update:modelValue', next)
  },
)

// 是否曾获得过焦点:用于判断「用户从未点进编辑器」的场景。
// ProseMirror 的 selection 在失焦后仍保留上次值,但点工具栏按钮时 DOM 已失焦,
// editor.isFocused 恒为 false,无法直接区分「从未点过」和「点过后失焦」。
const { selectionTick, editorHasBeenFocused } = useEditorEventBridge(ctx.editor)

// readonly 变化
watch(
  () => props.readonly,
  (v) => ctx.setEditable(!v),
)

// ---- 全屏 / 预览 ----
// 纯 UI 行为,状态留在 adapter 层(Core 无需感知)。
const isFullscreen = ref(false)
const isPreview = ref(false)
const tableGripMenuOpen = ref(false)
// 内容滚动容器(表格抓手覆盖层相对它定位)
const contentWrap = ref<HTMLElement | null>(null)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function togglePreview() {
  const next = !isPreview.value
  isPreview.value = next
  // 进入预览 → 只读;退出预览 → 恢复到 props.readonly 决定的可编辑性
  ctx.setEditable(!next && !props.readonly)
}

// Esc 退出:全屏优先退全屏;非全屏时退预览。
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (isFullscreen.value) {
    isFullscreen.value = false
  } else if (isPreview.value) {
    isPreview.value = false
    ctx.setEditable(!props.readonly)
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// 把 ctx 喂给工具栏,绑定 selectionTick 让其响应;
// 并注入 prepareInsert:工具栏的「插入类」按钮在操作前调用,
// 若用户从未点进编辑器,先把光标移到文档末尾,避免内容插到开头用户看不到。
const toolbarCtx = computed<ProEditorContext & { prepareInsert: () => void }>(() => {
  // 读取 selectionTick 以建立依赖
  void selectionTick.value
  return {
    ...ctx,
    prepareInsert: () => {
      if (!editorHasBeenFocused.value) {
        ctx.commands.ensureFocusAtEnd()
      }
    },
  }
})

// 图片粘贴/拖拽:挂到内容容器上。
const { onPaste, onDrop } = useImageDropPaste(ctx, () => props.uploadImage, () => props.editorBehaviorOptions)

// 字数
const wordCount = computed(() => ctx.wordCount.value)
const fallbackT = resolveLocale().t
function t(key: LocaleKey, params?: Record<string, string | number>) {
  return ctx.t?.(key, params) ?? fallbackT(key, params)
}

// 暗色主题:NConfigProvider 注入 darkTheme,Naive 组件自动跟随。
// 自绘区域(toolbar / ProseMirror / footer)没有 Naive 组件变量,由 .tvp-editor--dark
// 局部补齐 --n-* 变量,避免白色图标落在白色工具栏上。
const theme = computed(() => (props.dark ? darkTheme : null))
</script>

<template>
  <!--
    NConfigProvider:局部主题注入,实现「组件级独立暗色切换」,
    不依赖宿主全局。
    内部包 NMessageProvider + MessageBridge,拿到 message API 转 notify。
    namespace 用唯一前缀,避免与宿主可能存在的 provider 冲突。
  -->
  <NConfigProvider :theme="theme" :namespace="'tvp'">
    <NMessageProvider>
      <MessageBridge ref="bridgeRef" @vue:mounted="handleBridgeReady" />
      <div
        class="tvp-editor tvp-editor--naive"
        :class="{
          'tvp-editor--readonly': readonly,
          'tvp-editor--dark': dark,
          'is-fullscreen': isFullscreen,
          'is-preview': isPreview,
        }"
      >
        <slot
          v-if="!readonly && !isPreview && $slots.toolbar"
          name="toolbar"
          :ctx="toolbarCtx"
          :is-fullscreen="isFullscreen"
          :is-preview="isPreview"
          :toggle-fullscreen="toggleFullscreen"
          :toggle-preview="togglePreview"
          :toolbar-options="props.toolbarOptions"
          :editor-behavior-options="props.editorBehaviorOptions"
        />

        <Toolbar
          v-else-if="!readonly && !isPreview"
          :ctx="toolbarCtx"
          :upload-image="props.uploadImage"
          :upload-asset="props.uploadAsset"
          :is-fullscreen="isFullscreen"
          :is-preview="isPreview"
          :toolbar="props.toolbar"
          :toolbar-options="props.toolbarOptions"
          :editor-behavior-options="props.editorBehaviorOptions"
          :debug-log="debugLog"
          @toggle-fullscreen="toggleFullscreen"
          @toggle-preview="togglePreview"
        >
          <template #before="slotProps">
            <slot name="toolbar-before" v-bind="slotProps" />
          </template>
          <template #after="slotProps">
            <slot name="toolbar-after" v-bind="slotProps" />
          </template>
        </Toolbar>

        <!-- 预览态:隐藏工具栏,顶部只留一个「返回编辑」条 -->
        <div v-if="isPreview" class="tvp-preview-bar">
          <span class="tvp-preview-bar__hint">{{ t('preview.readonly') }}</span>
          <NTooltip placement="top" :show-arrow="false">
            <template #trigger>
              <NButton text class="tvp-preview-bar__edit-btn" @click="togglePreview">
                <Pencil :size="16" />
                <span class="tvp-preview-bar__edit-text">{{ t('toolbar.preview.edit') }}</span>
              </NButton>
            </template>
            {{ t('toolbar.preview.edit') }}
          </NTooltip>
        </div>

        <div
          ref="contentWrap"
          class="tvp-content-wrap"
          @paste="onPaste"
          @drop="onDrop"
          @dragover.prevent
        >
          <EditorContent :editor="ctx.editor.value" class="tvp-content" />
        </div>

        <!-- 表格行/列抓手(飞书式):fixed 浮层,放 content-wrap 外避免 overflow 裁剪 -->
        <TableGripHandles
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
          :scroll-container="contentWrap"
          :debug-log="debugLog"
          @menu-open-change="tableGripMenuOpen = $event"
        />

        <!-- 气泡菜单:选中文字时浮现(仅可编辑态;预览/只读不显示) -->
        <MediaBubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
          :editor-behavior-options="props.editorBehaviorOptions"
        />

        <FileBubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
          :editor-behavior-options="props.editorBehaviorOptions"
        />

        <HorizontalRuleBubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
          :suppress="tableGripMenuOpen"
        />

        <LinkBubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
          :editor-behavior-options="props.editorBehaviorOptions"
        />

        <BubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
        />

        <!-- 表格气泡:光标进入表格单元格时浮现,操作入口贴近表格本身(免滚动) -->
        <TableBubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
        />

        <!-- 图片气泡菜单:选中图片时浮现(尺寸/对齐/题注/替换/删除) -->
        <ImageBubbleMenu
          v-if="!readonly && !isPreview && ctx.editor.value"
          :editor="ctx.editor.value"
          :ctx="toolbarCtx"
          :upload-image="props.uploadImage"
          :editor-behavior-options="props.editorBehaviorOptions"
        />

        <div v-if="!readonly && !isPreview && showWordCount" class="tvp-footer">
          <span>{{ t('wordCount.characters', { count: wordCount.characters }) }}</span>
        </div>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
/* 编辑器容器 */
.tvp-editor {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--n-color, #fff);
  color: var(--n-text-color-2, #303133);
  overflow: hidden;
}

/*
 * Naive 的 darkTheme 只会把变量注入到 Naive 组件自身。
 * toolbar / ProseMirror / footer 是我们自绘的普通 DOM,需要在编辑器根节点
 * 局部补齐同名 --n-* 变量,这样组件级 :dark="true" 不依赖 html.dark 或宿主页。
 */
.tvp-editor--dark {
  --n-color: #18181c;
  --n-color-hover: rgba(255, 255, 255, 0.09);
  --n-border-color: rgba(255, 255, 255, 0.14);
  --n-text-color-2: rgba(255, 255, 255, 0.82);
  --n-text-color-3: rgba(255, 255, 255, 0.52);
  --n-code-color: rgba(255, 255, 255, 0.08);
  --n-table-color: rgba(255, 255, 255, 0.06);
  --n-fill-color-light: rgba(255, 255, 255, 0.08);
  --n-primary-color: #63e2b7;
  --n-color-target: #63e2b7;
}

.tvp-editor--readonly {
  border-color: var(--n-border-color, #ebeef5);
}

.tvp-bubble,
.tvp-img-bubble,
.tvp-link-bubble,
.tvp-file-bubble,
.tvp-media-bubble,
.tvp-hr-bubble,
.tvp-table-bubble {
  position: relative;
  z-index: 2100;
}

.tvp-editor[data-table-grip-suppress-bubble="true"] .tvp-table-bubble {
  display: none !important;
}

/*
 * 全屏:position:fixed 铺满视口,不接管物理屏幕。
 * z-index 取 2000。
 */
.tvp-editor.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  border: none;
  border-radius: 0;
}

.tvp-editor.is-fullscreen .tvp-content-wrap {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.tvp-editor.is-preview {
  background: var(--n-color, #f5f7fa);
}

.tvp-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid var(--n-border-color, #ebeef5);
  background: var(--n-color, #fff);
}

.tvp-preview-bar__hint {
  font-size: 12px;
  color: var(--n-text-color-3, #909399);
}

.tvp-preview-bar .tvp-preview-bar__edit-btn {
  width: auto;
  min-width: 56px;
  height: 28px;
  padding: 0 10px;
  white-space: nowrap;
}

.tvp-preview-bar .tvp-preview-bar__edit-btn :deep(.n-button__content) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
}

.tvp-preview-bar .tvp-preview-bar__edit-btn :deep(svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-preview-bar__edit-text {
  margin-left: 0;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

/* 纯图标按钮正方形击中区,复用工具栏的约束 */
.tvp-editor .tvp-icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

.tvp-content-wrap {
  position: relative; /* 表格抓手覆盖层的定位锚点 */
  min-width: 0;
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
}

/* ProseMirror 编辑区基础样式 —— 全局(非 scoped),因为内容是动态注入的 */
.tvp-content .ProseMirror {
  min-width: 0;
  min-height: 200px;
  padding: 12px 16px;
  outline: none;
}

.tvp-content .ProseMirror p {
  margin: 0.5em 0;
}

.tvp-content .ProseMirror hr {
  position: relative;
  height: 16px;
  margin: 0.5em 0;
  border: 0;
  cursor: pointer;
}

.tvp-content .ProseMirror hr::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  border-top: 1.5px solid var(--n-border-color, #dcdfe6);
  transform: translateY(-50%);
}

.tvp-content .ProseMirror hr[data-hr-variant='thick']::before {
  border-top-width: 3px;
}

.tvp-content .ProseMirror hr[data-hr-variant='dashed']::before {
  border-top-style: dashed;
}

.tvp-content .ProseMirror hr[data-hr-variant='dotted']::before {
  border-top-style: dotted;
}

.tvp-editor--naive .tvp-content .ProseMirror hr.ProseMirror-selectednode,
.tvp-editor--naive .tvp-content .ProseMirror hr.tvp-range-selected-node {
  outline: 2px solid var(--n-primary-color-hover, #36ad6a);
  outline-offset: 4px;
}

.tvp-content .ProseMirror h1,
.tvp-content .ProseMirror h2,
.tvp-content .ProseMirror h3,
.tvp-content .ProseMirror h4 {
  margin: 0.8em 0 0.4em;
  line-height: 1.3;
}

.tvp-content .ProseMirror ul,
.tvp-content .ProseMirror ol {
  padding-left: 1.5em;
}

/* 任务列表 */
.tvp-content .ProseMirror ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}

/*
 * 任务列表对齐方案(三处协同):
 *   li 显式 line-height + 清首段 margin-top + label height = line-height
 */
.tvp-content .ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.6;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > div > p:first-child {
  margin-top: 0;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 1.6em;
  width: 16px;
  margin: 0;
  user-select: none;
  cursor: pointer;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"] + span {
  display: block;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--n-border-color, #dcdfe6);
  border-radius: 3px;
  background: var(--n-color, #fff);
  transition: background-color 0.15s, border-color 0.15s;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"]:checked + span {
  background-color: var(--n-primary-color, #18a058);
  border-color: var(--n-primary-color, #18a058);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 12px 12px;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > div {
  flex: 1;
  min-width: 0;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
  color: var(--n-text-color-3, #a8abb2);
  text-decoration: line-through;
}

.tvp-content .ProseMirror blockquote {
  padding-left: 1em;
  margin: 0.5em 0;
  border-left: 3px solid var(--n-border-color, #dcdfe6);
  color: var(--n-text-color-3, #909399);
}

.tvp-content .ProseMirror pre {
  background: var(--n-code-color, #f5f7fa);
  border-radius: 4px;
  padding: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  overflow-x: auto;
}

.tvp-content .ProseMirror pre code {
  background: none;
  padding: 0;
}

.tvp-content .ProseMirror pre .hljs-keyword,
.tvp-content .ProseMirror pre .hljs-selector-tag,
.tvp-content .ProseMirror pre .hljs-built_in {
  color: #7c3aed;
}

.tvp-content .ProseMirror pre .hljs-string,
.tvp-content .ProseMirror pre .hljs-attr,
.tvp-content .ProseMirror pre .hljs-title {
  color: #047857;
}

.tvp-content .ProseMirror pre .hljs-number,
.tvp-content .ProseMirror pre .hljs-literal {
  color: #b45309;
}

.tvp-content .ProseMirror pre .hljs-comment {
  color: #8a8f98;
  font-style: italic;
}

.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-keyword,
.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-selector-tag,
.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-built_in {
  color: #c4b5fd;
}

.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-string,
.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-attr,
.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-title {
  color: #86efac;
}

.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-number,
.tvp-editor--dark .tvp-content .ProseMirror pre .hljs-literal {
  color: #fbbf24;
}

.tvp-content .ProseMirror code {
  background: var(--n-code-color, #f5f7fa);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 0.9em;
}

.tvp-content .ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

/*
 * 图片节点容器(自定义 NodeView):承载对齐 + 选中态 + 题注。
 * 与其他 adapter 对等,仅 CSS 变量名不同(Naive 用 --n-*)。
 */
.tvp-content .ProseMirror .tvp-img-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0.5em 0;
}
.tvp-content .ProseMirror .tvp-img-node[data-align='left'] {
  align-items: flex-start;
}
.tvp-content .ProseMirror .tvp-img-node[data-align='right'] {
  align-items: flex-end;
}

.tvp-editor--naive .tvp-content .ProseMirror .tvp-img-node.ProseMirror-selectednode,
.tvp-editor--naive .tvp-content .ProseMirror .tvp-img-node.tvp-range-selected-node {
  outline: 2px solid var(--n-color-target, #18a058);
  outline-offset: 2px;
  border-radius: 4px;
}

.tvp-content .ProseMirror .tvp-img-caption {
  width: 100%;
  max-width: 400px;
  margin-top: 6px;
  padding: 2px 4px;
  border: none;
  border-bottom: 1px dashed transparent;
  background: transparent;
  text-align: center;
  font-size: 13px;
  color: var(--n-text-color-3, #909399);
  outline: none;
}
.tvp-editor--naive .tvp-content .ProseMirror .tvp-img-caption:focus {
  border-bottom-color: var(--n-color-target, #18a058);
}
/*
 * 题注显隐(对标飞书):空题注默认不占位、不显示。
 * 仅当图片被选中 / hover / 输入框聚焦 / 已有内容时显示。
 */
.tvp-content .ProseMirror .tvp-img-caption-empty {
  display: none;
}
.tvp-content .ProseMirror .tvp-img-caption-empty:focus,
.tvp-content .ProseMirror .tvp-img-node:hover .tvp-img-caption-empty,
.tvp-content .ProseMirror .tvp-img-node.ProseMirror-selectednode .tvp-img-caption-empty {
  display: block;
}

.tvp-content .ProseMirror video,
.tvp-content .ProseMirror audio {
  display: block;
  max-width: 100%;
  margin: 10px 0;
}

.tvp-content .ProseMirror audio {
  width: min(100%, 520px);
}

.tvp-content .ProseMirror .tvp-media-node {
  display: flex;
  align-items: flex-start;
  width: fit-content;
  max-width: 100%;
  margin: 10px 0;
  border-radius: 6px;
}

.tvp-content .ProseMirror .tvp-media-resizable {
  max-width: 100%;
  line-height: 0;
}

.tvp-content .ProseMirror .tvp-media-node[data-media-kind='audio'] {
  width: 520px;
  max-width: 100%;
}

.tvp-content .ProseMirror .tvp-media-node[data-media-kind='audio'] .tvp-media-resizable {
  width: 100%;
  line-height: normal;
}

.tvp-content .ProseMirror .tvp-media-node video,
.tvp-content .ProseMirror .tvp-media-node audio {
  display: block;
  max-width: 100%;
  margin: 0;
}

.tvp-content .ProseMirror .tvp-media-node[data-media-kind='audio'] audio {
  width: 100%;
  height: 40px;
  min-height: 40px;
}

.tvp-editor--naive .tvp-content .ProseMirror .tvp-media-node.ProseMirror-selectednode,
.tvp-editor--naive .tvp-content .ProseMirror .tvp-media-node.tvp-range-selected-node {
  outline: 2px solid var(--n-color-target, #18a058);
  outline-offset: 2px;
}

.tvp-content .ProseMirror .tvp-file-attachment {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 42px;
  margin: 6px 0;
  padding: 7px 11px;
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 6px;
  background: var(--n-color, #fff);
  color: var(--n-primary-color, #18a058);
  text-decoration: none;
  vertical-align: middle;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.tvp-content .ProseMirror .tvp-file-attachment:hover {
  border-color: var(--n-primary-color-hover, #36ad6a);
  background: var(--n-color-hover, #f6fffa);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.1);
  text-decoration: none;
  transform: translateY(-1px);
}

.tvp-content .ProseMirror .tvp-file-attachment:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.tvp-editor--naive .tvp-content .ProseMirror .tvp-file-attachment.ProseMirror-selectednode,
.tvp-editor--naive .tvp-content .ProseMirror .tvp-file-attachment.tvp-range-selected-node {
  border-color: var(--n-primary-color, #18a058);
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.16);
}

.tvp-content .ProseMirror .tvp-file-attachment__icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  margin-right: 8px;
  border-radius: 6px;
  background: #909399;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.tvp-content .ProseMirror .tvp-file-attachment__icon::before {
  content: 'FILE';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='pdf'] .tvp-file-attachment__icon {
  background: #f56c6c;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='pdf'] .tvp-file-attachment__icon::before {
  content: 'PDF';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='doc'] .tvp-file-attachment__icon {
  background: #2080f0;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='doc'] .tvp-file-attachment__icon::before {
  content: 'DOC';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] .tvp-file-attachment__icon {
  background: var(--n-primary-color, #18a058);
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] .tvp-file-attachment__icon::before {
  content: 'XLS';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='slide'] .tvp-file-attachment__icon {
  background: #f0a020;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='slide'] .tvp-file-attachment__icon::before {
  content: 'PPT';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='archive'] .tvp-file-attachment__icon {
  background: #8a8f99;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='archive'] .tvp-file-attachment__icon::before {
  content: 'ZIP';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='image'] .tvp-file-attachment__icon {
  background: #a855f7;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='image'] .tvp-file-attachment__icon::before {
  content: 'IMG';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='video'] .tvp-file-attachment__icon {
  background: #7c3aed;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='video'] .tvp-file-attachment__icon::before {
  content: 'VID';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='audio'] .tvp-file-attachment__icon {
  background: #13c2c2;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='audio'] .tvp-file-attachment__icon::before {
  content: 'AUD';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='text'] .tvp-file-attachment__icon {
  background: #64748b;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='text'] .tvp-file-attachment__icon::before {
  content: 'TXT';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='code'] .tvp-file-attachment__icon {
  background: #334155;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='code'] .tvp-file-attachment__icon::before {
  content: '</>';
}

.tvp-content .ProseMirror .tvp-file-attachment .tvp-file-attachment__icon::before {
  content: none !important;
}

.tvp-content .ProseMirror .tvp-file-attachment__icon::after {
  content: '';
  width: 18px;
  height: 18px;
  display: block;
  background: currentColor;
  mask: var(--tvp-file-icon-mask) center / 18px 18px no-repeat;
  -webkit-mask: var(--tvp-file-icon-mask) center / 18px 18px no-repeat;
}

.tvp-content .ProseMirror .tvp-file-attachment {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='pdf'],
.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='doc'],
.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='text'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='M10 9H8'/%3E%3Cpath d='M16 13H8'/%3E%3Cpath d='M16 17H8'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='image'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Ccircle cx='10' cy='12' r='2'/%3E%3Cpath d='m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='video'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='m10 17.843 3.033-1.755a.64.64 0 0 1 .967.56v4.704a.65.65 0 0 1-.967.56L10 20.157'/%3E%3Crect width='7' height='6' x='3' y='16' rx='1'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='audio'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11.65 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v10.35'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='M8 20v-7l3 1.474'/%3E%3Ccircle cx='6' cy='20' r='2'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='archive'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v11.5'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='M8 12v-1'/%3E%3Cpath d='M8 18v-2'/%3E%3Cpath d='M8 7V6'/%3E%3Ccircle cx='8' cy='20' r='2'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='code'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='M10 12.5 8 15l2 2.5'/%3E%3Cpath d='m14 12.5 2 2.5-2 2.5'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/%3E%3Cpath d='M14 2v5a1 1 0 0 0 1 1h5'/%3E%3Cpath d='M8 13h2'/%3E%3Cpath d='M14 13h2'/%3E%3Cpath d='M8 17h2'/%3E%3Cpath d='M14 17h2'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='slide'] {
  --tvp-file-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 3h20'/%3E%3Cpath d='M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3'/%3E%3Cpath d='m7 21 5-5 5 5'/%3E%3C/svg%3E");
}

.tvp-content .ProseMirror .tvp-file-attachment__svg {
  width: 18px;
  height: 18px;
  display: none;
  flex: 0 0 auto;
}

.tvp-content .ProseMirror .tvp-file-attachment__body {
  min-width: 0;
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.tvp-content .ProseMirror .tvp-file-attachment__name,
.tvp-content .ProseMirror .tvp-file-attachment__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tvp-content .ProseMirror .tvp-file-attachment__name {
  font-size: 13px;
  line-height: 1.3;
}

.tvp-content .ProseMirror .tvp-file-attachment__meta {
  color: var(--n-text-color-3, #909399);
  font-size: 12px;
  line-height: 1.2;
}

.tvp-content .ProseMirror .tvp-file-attachment {
  box-sizing: border-box;
  max-width: min(calc(100% - 8px), 440px);
  margin: 6px 8px 6px 0;
  gap: 10px;
}

.tvp-content .ProseMirror .tvp-file-attachment__icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  margin-right: 0;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
}

.tvp-content .ProseMirror .tvp-file-attachment__icon::after {
  display: block;
}

.tvp-content .ProseMirror .tvp-file-attachment__svg {
  display: none;
  width: 18px;
  height: 18px;
}

.tvp-content .ProseMirror .tvp-file-attachment__body {
  flex: 1 1 auto;
  max-width: 100%;
}

.tvp-content .ProseMirror .tvp-file-attachment__download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  margin-left: 2px;
  border-radius: 6px;
  color: var(--n-text-color-2, #606266);
  opacity: 0;
  pointer-events: none;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease;
}

.tvp-content .ProseMirror .tvp-file-attachment:hover .tvp-file-attachment__download,
.tvp-content .ProseMirror .tvp-file-attachment:focus .tvp-file-attachment__download,
.tvp-content .ProseMirror .tvp-file-attachment.ProseMirror-selectednode .tvp-file-attachment__download,
.tvp-content .ProseMirror .tvp-file-attachment.tvp-range-selected-node .tvp-file-attachment__download {
  opacity: 1;
  pointer-events: auto;
}

.tvp-content .ProseMirror .tvp-file-attachment__download:hover {
  background: var(--n-action-color, #f5f7fa);
  color: var(--n-primary-color, #18a058);
}

.tvp-content .ProseMirror .tvp-file-attachment__download-svg {
  display: none;
}

.tvp-content .ProseMirror .tvp-file-attachment__download::before {
  content: '';
  display: block;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 15V3'/%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 15V3'/%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}

.tvp-content .ProseMirror .tvp-file-attachment__name,
.tvp-content .ProseMirror .tvp-file-attachment__meta {
  display: block;
  max-width: 100%;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='pdf'] .tvp-file-attachment__icon {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #e11d48;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='doc'] .tvp-file-attachment__icon {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2080f0;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] .tvp-file-attachment__icon {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: var(--n-primary-color, #18a058);
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='slide'] .tvp-file-attachment__icon {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #ea580c;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='archive'] .tvp-file-attachment__icon {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #64748b;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='image'] .tvp-file-attachment__icon,
.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='video'] .tvp-file-attachment__icon {
  border-color: #ddd6fe;
  background: #f5f3ff;
  color: #7c3aed;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='audio'] .tvp-file-attachment__icon {
  border-color: #bae6fd;
  background: #f0f9ff;
  color: #0284c7;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='text'] .tvp-file-attachment__icon,
.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='code'] .tvp-file-attachment__icon {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #334155;
}

.tvp-content .ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.tvp-content .ProseMirror th,
.tvp-content .ProseMirror td {
  border: 1px solid var(--n-border-color, #dcdfe6);
  padding: 6px 10px;
}

.tvp-content .ProseMirror th {
  background: var(--n-table-color, #f5f7fa);
}

.tvp-content .ProseMirror .selectedCell {
  position: relative;
}

.tvp-content .ProseMirror .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(24, 160, 88, 0.12);
  box-shadow: inset 0 0 0 1px var(--n-primary-color, #18a058);
}

/* placeholder */
.tvp-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--n-text-color-3, #a8abb2);
  pointer-events: none;
  height: 0;
}

.tvp-footer {
  display: flex;
  justify-content: flex-end;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--n-text-color-3, #909399);
  border-top: 1px solid var(--n-border-color, #ebeef5);
}
</style>
