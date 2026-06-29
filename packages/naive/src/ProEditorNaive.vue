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
  useEditorEventBridge,
  useImageDropPaste,
  useProEditor,
  type UploadImage,
  type OutputFormat,
  type Extensions,
  type NotifyType,
  type ProEditorContext,
  type ToolbarOptions,
  type ToolbarProp,
  type EditorBehaviorOptions,
} from 'tiptap-vue-pro-core'
import Toolbar from './Toolbar.vue'
import BubbleMenu from './BubbleMenu.vue'
import TableBubbleMenu from './TableBubbleMenu.vue'
import TableGripHandles from './TableGripHandles.vue'
import ImageBubbleMenu from './ImageBubbleMenu.vue'
import MessageBridge from './MessageBridge.vue'

const props = withDefaults(
  defineProps<{
    /** v-model 绑定值 */
    modelValue?: string | object
    /** 输出格式 */
    output?: OutputFormat
    /** placeholder */
    placeholder?: string
    /** 图片上传函数 */
    uploadImage?: UploadImage
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
  }>(),
  {
    modelValue: '',
    output: 'html',
    placeholder: '请输入内容...',
    readonly: false,
    dark: false,
    showWordCount: true,
    toolbar: undefined,
    toolbarOptions: undefined,
    editorBehaviorOptions: undefined,
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
  uploadImage: props.uploadImage,
  get editorBehaviorOptions() {
    return props.editorBehaviorOptions
  },
  editable: !props.readonly,
  extensions: props.extensions,
  notify: (msg: string, type?: NotifyType) => {
    const m = messageApi.value
    if (!m) return
    if (type === 'error') m.error(msg)
    else if (type === 'warning') m.warning(msg)
    else if (type === 'success') m.success(msg)
    else m.info(msg)
  },
} as any)

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
const { onPaste, onDrop } = useImageDropPaste(ctx, () => props.uploadImage)

// 字数
const wordCount = computed(() => ctx.wordCount.value)

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
          :is-fullscreen="isFullscreen"
          :is-preview="isPreview"
          :toolbar="props.toolbar"
          :toolbar-options="props.toolbarOptions"
          :editor-behavior-options="props.editorBehaviorOptions"
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
          <span class="tvp-preview-bar__hint">预览模式(只读)</span>
          <NTooltip placement="top" :show-arrow="false">
            <template #trigger>
              <NButton text class="tvp-preview-bar__edit-btn" @click="togglePreview">
                <Pencil :size="16" />
                <span class="tvp-preview-bar__edit-text">编辑</span>
              </NButton>
            </template>
            返回编辑
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
        />

        <!-- 气泡菜单:选中文字时浮现(仅可编辑态;预览/只读不显示) -->
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
          <span>字数: {{ wordCount.characters }}</span>
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
  gap: 4px;
  line-height: 1;
}

.tvp-preview-bar__edit-text {
  margin-left: 4px;
  line-height: 1;
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

.tvp-editor--naive .tvp-content .ProseMirror .tvp-img-node.ProseMirror-selectednode {
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
