<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElTooltip, ElDropdown, ElDropdownMenu, ElDropdownItem, ElDialog, ElInput } from 'element-plus'
import {
  Undo2, Redo2, ChevronDown,
  Bold, Italic, Strikethrough, Underline,
  Baseline, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Quote, Code, Minus,
  Link, ImagePlus, Table,
  Eraser,
} from 'lucide-vue-next'
import type { ProEditorContext, UploadImage } from 'tiptap-vue-pro-core'

/**
 * 工具栏。消费 Core 返回的 isActive / commands,
 * 渲染成 Element Plus 按钮组。
 *
 * 设计原则:
 * - 每个按钮的 active 态用 type="primary" 体现
 * - 命令直接调 ctx.commands.xxx(),无中间层
 * - 标题用 dropdown(多级),其余用 button
 *
 * active 响应性:依赖 ctx.isActive,工具栏组件本身在 EditorContent
 * 的父组件里会随 selectionUpdate 重渲染(通过 :key 或 watch 触发)。
 */
const props = defineProps<{
  ctx: ProEditorContext
  /** 图片上传函数。传入则显示「上传图片」按钮 */
  uploadImage?: UploadImage
}>()

const ctx = computed(() => props.ctx)

// 隐藏的图片选择 input
const imageInput = ref<HTMLInputElement | null>(null)
function triggerImageUpload() {
  imageInput.value?.click()
}
function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    ctx.value.commands.uploadAndInsertImage(file)
  }
  // 清空 value,允许重复选同一文件
  input.value = ''
}

// ---- 表格网格选择器 ----
const TABLE_MAX_ROWS = 8
const TABLE_MAX_COLS = 10
const tableHover = ref({ rows: 1, cols: 1 })
function resetTableHover() {
  tableHover.value = { rows: 1, cols: 1 }
}
// ElDropdown 的 @command 占位:网格点击走 cell 的 @click,这里不做 command 路由
function onTableInsert(_cmd?: unknown) {
  void _cmd
  ctx.value.commands.insertTable(tableHover.value.rows, tableHover.value.cols)
}

// 当前标题级别(用于 dropdown 显示)
const headingLabel = computed(() => {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (ctx.value.isActive('heading', { level })) return `H${level}`
  }
  return '正文'
})

// 标题 dropdown 命令
function onHeading(level: number) {
  ctx.value.commands.toggleHeading(level as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

// ---- 颜色选择器 ----
// 预设色板:覆盖常见用色,空字符串 = 清除
const PRESET_COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#e0398b', '#db4437', '#f57c00', '#fbc02d',
  '#0f9d58', '#1e88e5', '#673ab7', '#00897b',
]
const PRESET_HIGHLIGHTS = [
  '#fff3b0', '#ffd6a5', '#caffbf', '#a0c4ff',
  '#bdb2ff', '#ffc6ff', '#fdffb6', '#9bf6ff',
]

// 当前文字色(从选区的 textStyle mark 读取)
const currentColor = computed(
  () => (ctx.value.editor.value?.getAttributes('textStyle') as { color?: string })?.color ?? '',
)
// 当前高亮色
const currentHighlight = computed(
  () => (ctx.value.editor.value?.getAttributes('highlight') as { color?: string })?.color ?? '',
)

function selectColor(color: string) {
  ctx.value.commands.setColor(color)
}
function selectHighlight(color: string) {
  ctx.value.commands.toggleHighlight(color)
}

// ---- 文本对齐 ----
import { markRaw } from 'vue'
const ALIGN_ICONS = {
  left: markRaw(AlignLeft),
  center: markRaw(AlignCenter),
  right: markRaw(AlignRight),
  justify: markRaw(AlignJustify),
}
const alignIcon = computed(() => {
  for (const a of ['center', 'right', 'justify'] as const) {
    if (ctx.value.isActive({ textAlign: a })) return ALIGN_ICONS[a]
  }
  return ALIGN_ICONS.left
})
function onAlign(align: string) {
  ctx.value.commands.align(align as 'left' | 'center' | 'right' | 'justify')
}

// 链接弹窗(简化版:用 prompt,MVP 阶段够用,后续可换 ElDialog)
const linkDialogVisible = ref(false)
const linkUrl = ref('')

function openLinkDialog() {
  // 预填当前选中的链接
  const attrs = ctx.value.editor.value?.getAttributes('link') as { href?: string } | undefined
  linkUrl.value = attrs?.href ?? ''
  linkDialogVisible.value = true
}

function confirmLink() {
  ctx.value.commands.setLink(linkUrl.value.trim())
  linkDialogVisible.value = false
}
</script>

<template>
  <div class="tvp-toolbar">
    <!-- 撤销/重做 -->
    <ElTooltip content="撤销" placement="bottom" :show-after="300">
      <ElButton text @click="ctx.commands.undo()"><Undo2 :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="重做" placement="bottom" :show-after="300">
      <ElButton text @click="ctx.commands.redo()"><Redo2 :size="16" /></ElButton>
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 标题级别 dropdown -->
    <ElDropdown trigger="click" @command="onHeading">
      <ElButton text>
        {{ headingLabel }}
        <ChevronDown :size="14" class="tvp-caret" />
      </ElButton>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem :command="0">正文</ElDropdownItem>
          <ElDropdownItem :command="1">标题 1</ElDropdownItem>
          <ElDropdownItem :command="2">标题 2</ElDropdownItem>
          <ElDropdownItem :command="3">标题 3</ElDropdownItem>
          <ElDropdownItem :command="4">标题 4</ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>

    <span class="tvp-divider" />

    <!-- 格式化 -->
    <ElTooltip content="加粗" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('bold') ? 'primary' : 'default'"
        @click="ctx.commands.bold()"
      ><Bold :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="斜体" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('italic') ? 'primary' : 'default'"
        @click="ctx.commands.italic()"
      ><Italic :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="删除线" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('strike') ? 'primary' : 'default'"
        @click="ctx.commands.strike()"
      ><Strikethrough :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="下划线" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('underline') ? 'primary' : 'default'"
        @click="ctx.commands.underline()"
      ><Underline :size="16" /></ElButton>
    </ElTooltip>

    <!-- 文字颜色 -->
    <ElDropdown trigger="click">
      <ElButton text>
        <Baseline :size="16" :style="{ color: currentColor || 'inherit' }" />
        <span class="tvp-color-bar" :style="{ background: currentColor || '#909399' }" />
      </ElButton>
      <template #dropdown>
        <div class="tvp-color-panel">
          <div
            class="tvp-color-swatch"
            :class="{ 'is-active': currentColor === '' }"
            @click="selectColor('')"
          >默认</div>
          <div
            v-for="c in PRESET_COLORS"
            :key="c"
            class="tvp-color-swatch"
            :class="{ 'is-active': currentColor === c }"
            :style="{ background: c }"
            @click="selectColor(c)"
          />
        </div>
      </template>
    </ElDropdown>

    <!-- 背景高亮 -->
    <ElDropdown trigger="click">
      <ElButton text>
        <Highlighter :size="16" :style="{ color: currentHighlight || 'inherit' }" />
      </ElButton>
      <template #dropdown>
        <div class="tvp-color-panel">
          <div
            class="tvp-color-swatch"
            :class="{ 'is-active': currentHighlight === '' }"
            @click="selectHighlight('')"
          >无</div>
          <div
            v-for="c in PRESET_HIGHLIGHTS"
            :key="c"
            class="tvp-color-swatch"
            :class="{ 'is-active': currentHighlight === c }"
            :style="{ background: c }"
            @click="selectHighlight(c)"
          />
        </div>
      </template>
    </ElDropdown>

    <!-- 文本对齐 -->
    <ElDropdown trigger="click" @command="onAlign">
      <ElButton text>
        <component :is="alignIcon" :size="16" />
      </ElButton>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem command="left"><AlignLeft :size="16" /> 左对齐</ElDropdownItem>
          <ElDropdownItem command="center"><AlignCenter :size="16" /> 居中</ElDropdownItem>
          <ElDropdownItem command="right"><AlignRight :size="16" /> 右对齐</ElDropdownItem>
          <ElDropdownItem command="justify"><AlignJustify :size="16" /> 两端对齐</ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>

    <span class="tvp-divider" />

    <!-- 列表 -->
    <ElTooltip content="无序列表" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('bulletList') ? 'primary' : 'default'"
        @click="ctx.commands.bulletList()"
      ><List :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="有序列表" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('orderedList') ? 'primary' : 'default'"
        @click="ctx.commands.orderedList()"
      ><ListOrdered :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="任务列表" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('taskList') ? 'primary' : 'default'"
        @click="ctx.commands.taskList()"
      ><ListChecks :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="引用" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('blockquote') ? 'primary' : 'default'"
        @click="ctx.commands.blockquote()"
      ><Quote :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="代码块" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('codeBlock') ? 'primary' : 'default'"
        @click="ctx.commands.codeBlock()"
      ><Code :size="16" /></ElButton>
    </ElTooltip>
    <ElTooltip content="分割线" placement="bottom" :show-after="300">
      <ElButton text @click="ctx.commands.hr()"><Minus :size="16" /></ElButton>
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 链接 -->
    <ElTooltip content="链接" placement="bottom" :show-after="300">
      <ElButton
        text
        :type="ctx.isActive('link') ? 'primary' : 'default'"
        @click="openLinkDialog"
      ><Link :size="16" /></ElButton>
    </ElTooltip>

    <!-- 图片上传 -->
    <ElTooltip v-if="uploadImage" content="上传图片" placement="bottom" :show-after="300">
      <ElButton text @click="triggerImageUpload"><ImagePlus :size="16" /></ElButton>
    </ElTooltip>
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      class="tvp-image-input"
      @change="onImageSelected"
    />

    <!-- 表格(网格选择器) -->
    <ElTooltip content="插入表格" placement="bottom" :show-after="300">
      <ElDropdown trigger="click" @command="onTableInsert">
        <ElButton text><Table :size="16" /></ElButton>
        <template #dropdown>
          <div class="tvp-table-grid" @mouseleave="resetTableHover">
            <div
              v-for="r in TABLE_MAX_ROWS"
              :key="r"
              class="tvp-table-grid__row"
            >
              <div
                v-for="c in TABLE_MAX_COLS"
                :key="c"
                class="tvp-table-grid__cell"
                :class="{ 'is-active': r <= tableHover.rows && c <= tableHover.cols }"
                @mouseenter="tableHover.rows = r; tableHover.cols = c"
                @click="onTableInsert()"
              />
            </div>
            <div class="tvp-table-grid__label">
              {{ tableHover.rows }} × {{ tableHover.cols }}
            </div>
          </div>
        </template>
      </ElDropdown>
    </ElTooltip>

    <!-- 清除格式 -->
    <ElTooltip content="清除格式" placement="bottom" :show-after="300">
      <ElButton text @click="ctx.commands.clearFormat()"><Eraser :size="16" /></ElButton>
    </ElTooltip>

    <!-- 链接弹窗(ElDialog) -->
    <ElDialog
      v-model="linkDialogVisible"
      title="插入链接"
      width="400px"
      append-to-body
      :close-on-click-modal="true"
    >
      <ElInput
        v-model="linkUrl"
        placeholder="https://example.com"
        clearable
        @keyup.enter="confirmLink"
      />
      <template #footer>
        <ElButton @click="linkDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="confirmLink">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.tvp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  background: var(--el-fill-color-blank, #fff);
}

/* 隐藏的图片选择 input */
.tvp-image-input {
  display: none;
}

/* 表格网格选择器 */
.tvp-table-grid {
  padding: 8px;
  user-select: none;
}

.tvp-table-grid__row {
  display: flex;
}

.tvp-table-grid__cell {
  width: 18px;
  height: 18px;
  margin: 1px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 2px;
  cursor: pointer;
  background: var(--el-fill-color-blank, #fff);
  transition: background 0.1s;
}

.tvp-table-grid__cell.is-active {
  background: var(--el-color-primary, #409eff);
  border-color: var(--el-color-primary, #409eff);
}

.tvp-table-grid__label {
  text-align: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

/* 颜色选择器 */
.tvp-color-icon {
  font-weight: 700;
  line-height: 1;
}

/* 文字色按钮下方的色条 */
.tvp-color-bar {
  display: block;
  width: 16px;
  height: 3px;
  margin-top: 2px;
  border-radius: 1px;
}

.tvp-color-panel {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  padding: 8px;
  width: 180px;
}

.tvp-color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--el-border-color, #dcdfe6);
  font-size: 12px;
  line-height: 24px;
  text-align: center;
  color: var(--el-text-color-secondary, #909399);
  transition: transform 0.1s;
}

.tvp-color-swatch:hover {
  transform: scale(1.1);
}

.tvp-color-swatch.is-active {
  outline: 2px solid var(--el-color-primary, #409eff);
  outline-offset: 1px;
}

.tvp-divider {
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--el-border-color, #dcdfe6);
}

.tvp-caret {
  margin-left: 4px;
  font-size: 10px;
  opacity: 0.6;
}
</style>
