<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { ElButton, ElTooltip, ElMessage } from 'element-plus'
import { Pencil } from 'lucide-vue-next'
import { useProEditor, handleImageFiles, hasImageFiles, type UploadImage, type OutputFormat, type Extensions, type NotifyType, type ProEditorContext, type ToolbarProp } from 'tiptap-vue-pro-core'
import Toolbar from './Toolbar.vue'
import BubbleMenu from './BubbleMenu.vue'
import TableBubbleMenu from './TableBubbleMenu.vue'
import TableGripHandles from './TableGripHandles.vue'
import ImageBubbleMenu from './ImageBubbleMenu.vue'

/**
 * tiptap-vue-pro 的 Element Plus 适配主组件。
 *
 * 用户用法:
 *   <ProEditorElementPlus v-model="content" :upload-image="upload" output="html" />
 *
 * 职责:
 * - 把 v-model 接到 Core 的 useProEditor
 * - 渲染工具栏 + EditorContent
 * - 处理图片粘贴/拖拽上传(委托 Core 的 handleImageFiles)
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
// notify 注入:把 Core 的消息提示接到 ElMessage,
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
  uploadImage: props.uploadImage,
  editable: !props.readonly,
  extensions: props.extensions,
  notify: (msg: string, type?: NotifyType) => {
    if (type === 'error') ElMessage.error(msg)
    else if (type === 'warning') ElMessage.warning(msg)
    else if (type === 'success') ElMessage.success(msg)
    else ElMessage.info(msg)
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

// 工具栏 active 响应性:监听 editor 实例,绑定 selectionUpdate 触发重渲染
const selectionTick = ref(0)
// 是否曾获得过焦点:用于判断「用户从未点进编辑器」的场景。
// ProseMirror 的 selection 在失焦后仍保留上次值,但点工具栏按钮时 DOM 已失焦,
// editor.isFocused 恒为 false,无法直接区分「从未点过」和「点过后失焦」。
let editorHasBeenFocused = false
watch(
  () => ctx.editor.value,
  (ed) => {
    if (!ed) return
    ed.on('selectionUpdate', () => {
      selectionTick.value++
    })
    ed.on('transaction', () => {
      selectionTick.value++
    })
    ed.on('focus', () => {
      editorHasBeenFocused = true
    })
  },
  { immediate: true },
)

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
      if (!editorHasBeenFocused) {
        ctx.commands.ensureFocusAtEnd()
      }
    },
  }
})

// 图片粘贴/拖拽:挂到 EditorContent 的容器上
//
// 关键:preventDefault 必须在事件的「同步阶段」调用才生效。而 handleImageFiles
// 是 async(要等上传),不能把它的返回值用于 if 判断——那会让 if 永远拿到一个
// Promise(恒真),既误拦所有粘贴,又因 preventDefault 时机已过而失效。
// 因此:先用同步的 hasImageFiles 判断「有没有图片」并立即 preventDefault,
// 再异步走真正的上传 + 插入。
function onPaste(e: ClipboardEvent) {
  if (!props.uploadImage) return
  const files = e.clipboardData?.files
  if (!hasImageFiles(files)) return
  e.preventDefault()
  void handleImageFiles(files, props.uploadImage, ctx.editor.value!, () => {
    ctx.notify('部分图片上传失败', 'error')
  })
}

function onDrop(e: DragEvent) {
  if (!props.uploadImage) return
  const files = e.dataTransfer?.files
  if (!hasImageFiles(files)) return
  e.preventDefault()
  void handleImageFiles(files, props.uploadImage, ctx.editor.value!, () => {
    ctx.notify('部分图片上传失败', 'error')
  })
}

// 字数
const wordCount = computed(() => ctx.wordCount.value)
</script>

<template>
  <div
    class="tvp-editor tvp-editor--element-plus"
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
    />

    <Toolbar
      v-else-if="!readonly && !isPreview"
      :ctx="toolbarCtx"
      :upload-image="props.uploadImage"
      :is-fullscreen="isFullscreen"
      :is-preview="isPreview"
      :toolbar="props.toolbar"
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
      <ElTooltip content="返回编辑" placement="top" :show-after="300">
        <ElButton text class="tvp-preview-bar__edit-btn" @click="togglePreview">
          <Pencil :size="16" />
          <span class="tvp-preview-bar__edit-text">编辑</span>
        </ElButton>
      </ElTooltip>
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
    />

    <div v-if="!readonly && !isPreview && showWordCount" class="tvp-footer">
      <span>字数: {{ wordCount.characters }}</span>
    </div>
  </div>
</template>

<style>
/* 编辑器容器 */
.tvp-editor {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--el-bg-color, #fff);
  color: var(--el-text-color-regular, #303133);
  overflow: hidden;
}

.tvp-editor--readonly {
  border-color: var(--el-border-color-lighter, #ebeef5);
}

/*
 * 全屏:position:fixed 铺满视口,不接管物理屏幕。
 * 改成纵向 flex,让内容区 flex:1 撑满工具栏与状态栏之间的空间。
 * z-index 取 2000,高于 Element Plus 弹层(dialog ~2000)以外的常规层叠,
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
  background: var(--el-fill-color-light, #f5f7fa);
}

/* 预览顶部「返回编辑」条:右对齐一个按钮 + 左侧状态提示 */
.tvp-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  background: var(--el-fill-color-blank, #fff);
}

.tvp-preview-bar__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.tvp-preview-bar :deep(.el-button.tvp-preview-bar__edit-btn) {
  width: auto;
  min-width: 56px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.tvp-preview-bar__edit-text {
  margin-left: 4px;
  line-height: 1;
}

/* 纯图标按钮正方形击中区,复用工具栏的约束 */
.tvp-editor :deep(.el-button.tvp-icon-btn) {
  width: 32px;
  height: 32px;
  padding: 0;
}

/*
 * 暗色模式:在编辑器根容器局部覆盖 --el-* 变量。
 * 不依赖 html.dark 全局类,实现组件级独立暗色切换。
 */
.tvp-editor--dark {
  --el-bg-color: #1d1e1f;
  --el-bg-color-page: #141414;
  --el-bg-color-overlay: #1d1e1f;
  --el-text-color-primary: #e5eaf3;
  --el-text-color-regular: #cfd3dc;
  --el-text-color-secondary: #a3a6ad;
  --el-text-color-placeholder: #8d9095;
  --el-text-color-disabled: #0c0c0c;
  --el-border-color: #414243;
  --el-border-color-light: #414243;
  --el-border-color-lighter: #363637;
  --el-border-color-extra-light: #2e2e2f;
  --el-border-color-dark: #4b4b4d;
  --el-fill-color: #303030;
  --el-fill-color-blank: #1d1e1f;
  --el-fill-color-light: #262727;
  --el-fill-color-lighter: #1d1e1f;
  --el-fill-color-dark: #363637;
  --el-color-primary: #409eff;
  --el-color-primary-light-9: #18222c;
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
  border: 1.5px solid var(--el-border-color, #dcdfe6);
  border-radius: 3px;
  background: var(--el-bg-color, #fff);
  transition: background-color 0.15s, border-color 0.15s;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"]:checked + span {
  background-color: var(--el-color-primary, #409eff);
  border-color: var(--el-color-primary, #409eff);
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
  color: var(--el-text-color-placeholder, #a8abb2);
  text-decoration: line-through;
}

.tvp-content .ProseMirror blockquote {
  padding-left: 1em;
  margin: 0.5em 0;
  border-left: 3px solid var(--el-border-color, #dcdfe6);
  color: var(--el-text-color-secondary, #909399);
}

.tvp-content .ProseMirror pre {
  background: var(--el-fill-color-dark, #f5f7fa);
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
  background: var(--el-fill-color-dark, #f5f7fa);
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
.tvp-editor--element-plus .tvp-content .ProseMirror .tvp-img-node.ProseMirror-selectednode {
  outline: 2px solid var(--el-color-primary, #409eff);
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
  color: var(--el-text-color-secondary, #909399);
  outline: none;
}
.tvp-editor--element-plus .tvp-content .ProseMirror .tvp-img-caption:focus {
  border-bottom-color: var(--el-color-primary, #409eff);
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

.tvp-content .ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.tvp-content .ProseMirror th,
.tvp-content .ProseMirror td {
  border: 1px solid var(--el-border-color, #dcdfe6);
  padding: 6px 10px;
}

.tvp-content .ProseMirror th {
  background: var(--el-fill-color-light, #f5f7fa);
}

/* placeholder */
.tvp-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--el-text-color-placeholder, #a8abb2);
  pointer-events: none;
  height: 0;
}

.tvp-footer {
  display: flex;
  justify-content: flex-end;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
}
</style>
