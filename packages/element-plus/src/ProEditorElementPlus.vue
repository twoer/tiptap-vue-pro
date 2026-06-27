<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { useProEditor, handleImageFiles, type UploadImage, type OutputFormat, type Extensions } from 'tiptap-vue-pro-core'
import Toolbar from './Toolbar.vue'
import BubbleMenu from './BubbleMenu.vue'

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
    /** 自定义扩展(覆盖默认) */
    extensions?: Extensions
  }>(),
  {
    modelValue: '',
    output: 'html',
    placeholder: '请输入内容...',
    readonly: false,
    dark: false,
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
const ctx = useProEditor({
  get content() {
    return content.value
  },
  set content(v) {
    content.value = v
    emit('update:modelValue', v)
  },
  output: props.output,
  placeholder: props.placeholder,
  uploadImage: props.uploadImage,
  editable: !props.readonly,
  extensions: props.extensions,
} as any)

// 工具栏 active 响应性:监听 editor 实例,绑定 selectionUpdate 触发重渲染
const selectionTick = ref(0)
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
  },
  { immediate: true },
)

// readonly 变化
watch(
  () => props.readonly,
  (v) => ctx.setEditable(!v),
)

// 把 ctx 喂给工具栏,绑定 selectionTick 让其响应
const toolbarCtx = computed(() => {
  // 读取 selectionTick 以建立依赖
  void selectionTick.value
  return ctx
})

// 图片粘贴/拖拽:挂到 EditorContent 的容器上
function onPaste(e: ClipboardEvent) {
  if (!props.uploadImage) return
  const handled = handleImageFiles(e.clipboardData?.files, props.uploadImage, ctx.editor.value!)
  if (handled) e.preventDefault()
}

function onDrop(e: DragEvent) {
  if (!props.uploadImage) return
  const handled = handleImageFiles(e.dataTransfer?.files, props.uploadImage, ctx.editor.value!)
  if (handled) e.preventDefault()
}

// 字数
const wordCount = computed(() => ctx.wordCount.value)
</script>

<template>
  <div class="tvp-editor" :class="{ 'tvp-editor--readonly': readonly, 'tvp-editor--dark': props.dark }">
    <Toolbar v-if="!readonly" :ctx="toolbarCtx" :upload-image="props.uploadImage" />

    <div
      class="tvp-content-wrap"
      @paste="onPaste"
      @drop="onDrop"
      @dragover.prevent
    >
      <EditorContent :editor="ctx.editor.value" class="tvp-content" />
    </div>

    <!-- 气泡菜单:选中文字时浮现(仅非只读) -->
    <BubbleMenu
      v-if="!readonly && ctx.editor.value"
      :editor="ctx.editor.value"
      :ctx="toolbarCtx"
    />

    <div v-if="!readonly" class="tvp-footer">
      <span>字数: {{ wordCount.characters }}</span>
    </div>
  </div>
</template>

<style>
/* 编辑器容器 */
.tvp-editor {
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--el-bg-color, #fff);
  overflow: hidden;
}

.tvp-editor--readonly {
  border-color: var(--el-border-color-lighter, #ebeef5);
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
  --el-fill-color-light: #262727;
  --el-fill-color-lighter: #1d1e1f;
  --el-fill-color-dark: #363637;
  --el-color-primary: #409eff;
}

.tvp-content-wrap {
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
}

/* ProseMirror 编辑区基础样式 —— 全局(非 scoped),因为内容是动态注入的 */
.tvp-content .ProseMirror {
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

.tvp-content .ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.tvp-content .ProseMirror ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  user-select: none;
  margin-top: 4px;
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
