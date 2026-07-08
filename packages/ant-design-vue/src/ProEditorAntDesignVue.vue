<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { AntButton, AntTooltip, antMessage } from './antDesignPrimitives'
import { Pencil } from 'lucide-vue-next'
import { createDebugLogger, resolveLocale, useEditorEventBridge, useImageDropPaste, useProEditor, type UploadAsset, type UploadImage, type OutputFormat, type Extensions, type NotifyType, type ProEditorContext, type ToolbarOptions, type ToolbarProp, type EditorBehaviorOptions, type LocaleKey, type LocaleProp, type ProEditorDebugLogger, type ProEditorDebugLogFn, type ProEditorDebugOptions } from 'tiptap-vue-pro-core'
import Toolbar from './Toolbar.vue'
import BubbleMenu from './BubbleMenu.vue'
import TableBubbleMenu from './TableBubbleMenu.vue'
import TableGripHandles from './TableGripHandles.vue'
import ImageBubbleMenu from './ImageBubbleMenu.vue'
import LinkBubbleMenu from './LinkBubbleMenu.vue'
import FileBubbleMenu from './FileBubbleMenu.vue'
import MediaBubbleMenu from './MediaBubbleMenu.vue'
import HorizontalRuleBubbleMenu from './HorizontalRuleBubbleMenu.vue'

/**
 * Tiptap Vue Pro 的 Ant Design Vue 适配主组件。
 *
 * 用户用法:
 *   <ProEditorAntDesignVue v-model="content" :upload-image="upload" output="html" />
 *
 * 职责:
 * - 把 v-model 接到 Core 的 useProEditor
 * - 渲染工具栏 + EditorContent
 * - 处理图片粘贴/拖拽上传(委托 Core 的 useImageDropPaste)
 *
 * 注意:active 态的响应性。
 * Tiptap 的 isActive 不会自动触发 Vue 重渲染,这里用一个 selectionTick
 * 在编辑器 selection 变化时 ++ 触发工具栏重渲染。
 */
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

// 用 Core 创建编辑器实例
//
// notify 注入:把 Core 的消息提示接到 antMessage,
// 与 Naive 版(useMessage)对等——Core 决定「何时提示 + 文案」,adapter 决定「用什么显示」。
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
    if (type === 'error') antMessage.error(msg)
    else if (type === 'warning') antMessage.warning(msg)
    else if (type === 'success') antMessage.success(msg)
    else antMessage.info(msg)
  },
} as any)

const debugLog: ProEditorDebugLogFn = (...args) => {
  createDebugLogger({
    debug: props.debug,
    debugLogger: props.debugLogger,
    source: 'ant-design-vue',
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
// 全屏:CSS position:fixed 铺满视口,不接管物理屏幕,用户仍可切换标签/窗口。
// 预览:切到只读 + 隐藏工具栏,只留一个「返回编辑」按钮,所见即所得。
// 二者独立,可叠加(全屏下也能预览)。
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
// 全屏/预览都是编辑器自身的临时态,Esc 作为通用「退出」手势符合直觉。
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
// 并注入 prepareInsert:工具栏的「插入类」按钮(链接/图片/表格)在操作前调用,
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

// 图片粘贴/拖拽:挂到 EditorContent 的容器上。
const { onPaste, onDrop } = useImageDropPaste(ctx, () => props.uploadImage, () => props.editorBehaviorOptions)

// 字数
const wordCount = computed(() => ctx.wordCount.value)
const fallbackT = resolveLocale().t
function t(key: LocaleKey, params?: Record<string, string | number>) {
  return ctx.t?.(key, params) ?? fallbackT(key, params)
}
</script>

<template>
  <div
    class="tvp-editor tvp-editor--ant-design-vue"
    :class="{
      'tvp-editor--readonly': readonly,
      'tvp-editor--dark': props.dark,
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
      <AntTooltip :content="t('toolbar.preview.edit')" placement="top" :show-after="300">
        <AntButton text class="tvp-preview-bar__edit-btn" @click="togglePreview">
          <Pencil :size="16" />
          <span class="tvp-preview-bar__edit-text">{{ t('toolbar.preview.edit') }}</span>
        </AntButton>
      </AntTooltip>
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
</template>

<style>
/* 编辑器容器 */
.tvp-editor {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--tvp-ant-bg-color, #fff);
  color: var(--tvp-ant-text-color-regular, #303133);
  overflow: hidden;
}

.tvp-editor--readonly {
  border-color: var(--tvp-ant-border-color-lighter, #ebeef5);
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
 * 改成纵向 flex,让内容区 flex:1 撑满工具栏与状态栏之间的空间。
 * z-index 取 2000,高于 Ant Design Vue 弹层(dialog ~2000)以外的常规层叠,
 * 但低于 dialog,保证全屏下链接弹窗等仍能正常盖在上面。
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

/* 全屏下内容区撑满剩余高度,取消固定 max-height 限制 */
.tvp-editor.is-fullscreen .tvp-content-wrap {
  flex: 1;
  min-height: 0;
  max-height: none;
}

/*
 * 预览态:轻微背景区分,让用户感知「这是只读预览」。
 * 内容仍复用编辑区样式(所见即所得),只在外层做视觉提示。
 */
.tvp-editor.is-preview {
  background: var(--tvp-ant-fill-color-light, #f5f7fa);
}

/* 预览顶部「返回编辑」条:右对齐一个按钮 + 左侧状态提示 */
.tvp-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid var(--tvp-ant-border-color-lighter, #ebeef5);
  background: var(--tvp-ant-fill-color-blank, #fff);
}

.tvp-preview-bar__hint {
  font-size: 12px;
  color: var(--tvp-ant-text-color-secondary, #909399);
}

.tvp-preview-bar :deep(.tvp-ant-button.tvp-preview-bar__edit-btn) {
  width: auto;
  min-width: 56px;
  height: 28px;
  padding: 0 10px;
  line-height: 1;
  white-space: nowrap;
}

.tvp-preview-bar :deep(.tvp-ant-button.tvp-preview-bar__edit-btn > span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
}

.tvp-preview-bar :deep(.tvp-ant-button.tvp-preview-bar__edit-btn svg) {
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
.tvp-editor :deep(.tvp-ant-button.tvp-icon-btn) {
  width: 32px;
  height: 32px;
  padding: 0;
}

/*
 * 暗色模式:在编辑器根容器局部覆盖 Ant 适配的 --tvp-ant-* 变量。
 * 不依赖 html.dark 全局类,实现组件级独立暗色切换。
 */
.tvp-editor--dark {
  --tvp-ant-bg-color: #1d1e1f;
  --tvp-ant-bg-color-page: #141414;
  --tvp-ant-bg-color-overlay: #1d1e1f;
  --tvp-ant-text-color-primary: #e5eaf3;
  --tvp-ant-text-color-regular: #cfd3dc;
  --tvp-ant-text-color-secondary: #a3a6ad;
  --tvp-ant-text-color-placeholder: #8d9095;
  --tvp-ant-text-color-disabled: #0c0c0c;
  --tvp-ant-border-color: #414243;
  --tvp-ant-border-color-light: #414243;
  --tvp-ant-border-color-lighter: #363637;
  --tvp-ant-border-color-extra-light: #2e2e2f;
  --tvp-ant-border-color-dark: #4b4b4d;
  --tvp-ant-fill-color: #303030;
  --tvp-ant-fill-color-blank: #1d1e1f;
  --tvp-ant-fill-color-light: #262727;
  --tvp-ant-fill-color-lighter: #1d1e1f;
  --tvp-ant-fill-color-dark: #363637;
  --tvp-ant-color-primary: #409eff;
  --tvp-ant-color-primary-light-9: #18222c;
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
  border-top: 1.5px solid var(--tvp-ant-border-color, #dcdfe6);
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

.tvp-editor--ant-design-vue .tvp-content .ProseMirror hr.ProseMirror-selectednode,
.tvp-editor--ant-design-vue .tvp-content .ProseMirror hr.tvp-range-selected-node {
  outline: 2px solid var(--tvp-ant-color-primary-light-5, #a0cfff);
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
 * 任务列表对齐方案(三处协同,才能精确对齐):
 *   1) li 设显式 line-height —— 让「一行文字的行框高」变成已知确定值,
 *      不再依赖浏览器默认的 normal(约 1.15~1.2,各平台不一致)。
 *   2) 清掉任务项首段 <p> 的 margin-top —— .ProseMirror p 默认有 0.5em 上外边距,
 *      会把文字第一行整体下推,导致 checkbox 看起来比文字高。只清首段,
 *      多段任务的段间距仍然保留。
 *   3) label 的 height 取与 line-height 相同的 em 值 —— 这样 label 高度精确等于
 *      一行行框高,内部 align-items:center 把复选框垂直居中,正好落在文字第一行
 *      的垂直中心。字号/字体/主题怎么变都对齐。li 用 flex-start,长文本换行
 *      时复选框仍贴首行顶部。
 */
.tvp-content .ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.6;
}

/* 清掉任务项首段的默认上外边距,让文字顶部与 label 顶部真正共线 */
.tvp-content .ProseMirror ul[data-type="taskList"] li > div > p:first-child {
  margin-top: 0;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  /* height = li 的 line-height(1.6em),精确等于一行行框高 */
  height: 1.6em;
  width: 16px;
  margin: 0;
  user-select: none;
  cursor: pointer;
}

/*
 * 隐藏原生 input 的视觉,但保留它在 DOM 里:tiptap 靠 input 的 change 事件
 * 切换勾选状态,绝不能 display:none / remove。这里用 opacity:0 + 绝对定位
 * 撑满 label,既不影响点击(点 label 任意位置都能触发),也不破坏交互。
 */
.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

/*
 * 复选框外观画在 tiptap 预留的 <span>(input 的下一兄弟节点)上。
 * Lucide 风格:1.5px 边框 + 3px 圆角;勾选时填充主题色并显示白色对勾(SVG)。
 */
.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"] + span {
  display: block;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 3px;
  background: var(--tvp-ant-bg-color, #fff);
  transition: background-color 0.15s, border-color 0.15s;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"]:checked + span {
  background-color: var(--tvp-ant-color-primary, #409eff);
  border-color: var(--tvp-ant-color-primary, #409eff);
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
  color: var(--tvp-ant-text-color-placeholder, #a8abb2);
  text-decoration: line-through;
}

.tvp-content .ProseMirror blockquote {
  padding-left: 1em;
  margin: 0.5em 0;
  border-left: 3px solid var(--tvp-ant-border-color, #dcdfe6);
  color: var(--tvp-ant-text-color-secondary, #909399);
}

.tvp-content .ProseMirror pre {
  background: var(--tvp-ant-fill-color-dark, #f5f7fa);
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

html.dark .tvp-content .ProseMirror pre .hljs-keyword,
html.dark .tvp-content .ProseMirror pre .hljs-selector-tag,
html.dark .tvp-content .ProseMirror pre .hljs-built_in {
  color: #c4b5fd;
}

html.dark .tvp-content .ProseMirror pre .hljs-string,
html.dark .tvp-content .ProseMirror pre .hljs-attr,
html.dark .tvp-content .ProseMirror pre .hljs-title {
  color: #86efac;
}

html.dark .tvp-content .ProseMirror pre .hljs-number,
html.dark .tvp-content .ProseMirror pre .hljs-literal {
  color: #fbbf24;
}

.tvp-content .ProseMirror code {
  background: var(--tvp-ant-fill-color-dark, #f5f7fa);
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
 * 图片节点容器(自定义 NodeView 渲染):承载对齐 + 选中态 + 题注。
 * NodeView 把图片包在 .tvp-img-node 里,通过 data-align 控制水平对齐。
 *
 * 对齐用 flex + justify(图片是块级,居中/左右用 flex 最稳,不依赖 text-align
 * 对 inline-block 的不确定性)。
 */
.tvp-content .ProseMirror .tvp-img-node {
  display: flex;
  flex-direction: column;
  align-items: center; /* 默认居中 */
  margin: 0.5em 0;
}
.tvp-content .ProseMirror .tvp-img-node[data-align='left'] {
  align-items: flex-start;
}
.tvp-content .ProseMirror .tvp-img-node[data-align='right'] {
  align-items: flex-end;
}

/* 选中态:蓝色描边(ProseMirror 给选中节点加 ProseMirror-selectednode 类) */
.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-img-node.ProseMirror-selectednode,
.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-img-node.tvp-range-selected-node {
  outline: 2px solid var(--tvp-ant-color-primary, #409eff);
  outline-offset: 2px;
  border-radius: 4px;
}

/* 题注输入框:图片下方灰色小字(对标飞书) */
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
  color: var(--tvp-ant-text-color-secondary, #909399);
  outline: none;
}
.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-img-caption:focus {
  border-bottom-color: var(--tvp-ant-color-primary, #409eff);
}
/*
 * 题注显隐(对标飞书):空题注默认不占位、不显示,避免每张图下方都挂着空输入框。
 * 仅当下列情况显示:① 图片被选中(NodeSelection 加 ProseMirror-selectednode);
 *                   ② 鼠标 hover 在图片节点上;③ 输入框正聚焦;④ 已有题注内容。
 * 有内容(无 tvp-img-caption-empty 类)的始终显示。
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

.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-media-node.ProseMirror-selectednode,
.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-media-node.tvp-range-selected-node {
  outline: 2px solid var(--tvp-ant-color-primary, #1677ff);
  outline-offset: 2px;
}

.tvp-content .ProseMirror .tvp-file-attachment {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 42px;
  margin: 6px 0;
  padding: 7px 11px;
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 6px;
  background: var(--tvp-ant-fill-color-blank, #fff);
  color: var(--tvp-ant-color-primary, #1677ff);
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
  border-color: var(--tvp-ant-color-primary-border-hover, #91caff);
  background: var(--tvp-ant-color-primary-bg, #e6f4ff);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.1);
  text-decoration: none;
  transform: translateY(-1px);
}

.tvp-content .ProseMirror .tvp-file-attachment:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-file-attachment.ProseMirror-selectednode,
.tvp-editor--ant-design-vue .tvp-content .ProseMirror .tvp-file-attachment.tvp-range-selected-node {
  border-color: var(--tvp-ant-color-primary, #1677ff);
  box-shadow: 0 0 0 2px var(--tvp-ant-color-primary-bg, #e6f4ff);
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
  background: #ff4d4f;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='pdf'] .tvp-file-attachment__icon::before {
  content: 'PDF';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='doc'] .tvp-file-attachment__icon {
  background: var(--tvp-ant-color-primary, #1677ff);
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='doc'] .tvp-file-attachment__icon::before {
  content: 'DOC';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] .tvp-file-attachment__icon {
  background: #52c41a;
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] .tvp-file-attachment__icon::before {
  content: 'XLS';
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='slide'] .tvp-file-attachment__icon {
  background: #faad14;
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
  color: var(--tvp-ant-text-color-secondary, #909399);
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
  color: var(--tvp-ant-text-color-secondary, #606266);
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
  background: var(--tvp-ant-fill-color-light, #f5f7fa);
  color: var(--tvp-ant-color-primary, #1677ff);
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
  color: var(--tvp-ant-color-primary, #1677ff);
}

.tvp-content .ProseMirror .tvp-file-attachment[data-file-icon='sheet'] .tvp-file-attachment__icon {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #16a34a;
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
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  padding: 6px 10px;
}

.tvp-content .ProseMirror th {
  background: var(--tvp-ant-fill-color-light, #f5f7fa);
}

.tvp-content .ProseMirror .selectedCell {
  position: relative;
}

.tvp-content .ProseMirror .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(22, 119, 255, 0.12);
  box-shadow: inset 0 0 0 1px var(--tvp-ant-color-primary, #1677ff);
}

/* placeholder */
.tvp-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--tvp-ant-text-color-placeholder, #a8abb2);
  pointer-events: none;
  height: 0;
}

.tvp-footer {
  display: flex;
  justify-content: flex-end;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--tvp-ant-text-color-secondary, #909399);
  border-top: 1px solid var(--tvp-ant-border-color-lighter, #ebeef5);
}

</style>
