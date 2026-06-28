<script setup lang="ts">
import { computed, ref, h, defineComponent, markRaw } from 'vue'
import { ElButton, ElTooltip, ElDropdown, ElDropdownMenu, ElDropdownItem, ElDialog, ElInput, ElCheckbox } from 'element-plus'
import {
  Undo2, Redo2, ChevronDown,
  Bold, Italic, Strikethrough, Underline,
  Superscript, Subscript,
  Type, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Quote, Code, Minus,
  Link, ImagePlus, Link2, Table,
  FileDown, FileUp,
  Eraser, Printer,
  Maximize2, Minimize2, Eye, Pencil,
} from 'lucide-vue-next'
import { CODE_BLOCK_LANGUAGES, codeBlockLanguageLabel } from 'tiptap-vue-pro-core'
import type { CodeBlockLanguage, ProEditorContext, UploadImage } from 'tiptap-vue-pro-core'

/**
 * Markdown 官方 logo(圆角方块 + 向下双箭头)。
 * lucide 不收录品牌图标,这里按官方 MD logo(MIT)内联 SVG,
 * 暴露 size 属性,用法对齐 lucide 图标。
 */
const MarkdownIcon = markRaw(
  defineComponent({
    name: 'MarkdownIcon',
    props: { size: { type: Number, default: 18 } },
    setup(props) {
      return () =>
        h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 24 24',
            width: props.size,
            height: props.size,
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          },
          [
            // 外框:圆角矩形
            h('rect', { x: 2, y: 5, width: 20, height: 14, rx: 2 }),
            // 框内:M 的左竖
            h('path', { d: 'M6 15V9l3 3 3-3v6' }),
            // M 的右半 + 向下箭头(官方 logo 造型)
            h('path', { d: 'M15 9v6' }),
            h('path', { d: 'm13 13 2 2 2-2' }),
          ],
        )
    },
  }),
)

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
  ctx: ProEditorContext & { prepareInsert?: () => void }
  /** 图片上传函数。传入则显示「上传图片」按钮 */
  uploadImage?: UploadImage
  /** 是否全屏(控制全屏图标切换) */
  isFullscreen?: boolean
  /** 是否预览态(控制预览图标切换) */
  isPreview?: boolean
}>()

const emit = defineEmits<{
  'toggle-fullscreen': []
  'toggle-preview': []
}>()

const ctx = computed(() => props.ctx)

/**
 * 插入类操作前的预处理:若编辑器从未获得焦点(用户没点进去过),
 * 先把光标定位到文档末尾,避免内容插到开头用户看不到。
 */
function prepareInsert() {
  ctx.value.prepareInsert?.()
}

// 隐藏的图片选择 input
const imageInput = ref<HTMLInputElement | null>(null)
function triggerImageUpload() {
  prepareInsert()
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

// 网络图片:弹窗输入 URL → setImage 插入(对标飞书「网络图片」入口)
const urlDialogVisible = ref(false)
const imageUrl = ref('')
function isSupportedImageUrl(url: string) {
  try {
    const parsed = new URL(url, 'http://tiptap-vue-pro.local')
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
function openUrlDialog() {
  prepareInsert()
  imageUrl.value = ''
  urlDialogVisible.value = true
}
function confirmUrlImage() {
  const url = imageUrl.value.trim()
  if (!url) {
    urlDialogVisible.value = false
    return
  }
  if (!isSupportedImageUrl(url)) {
    ctx.value.notify('请输入有效的图片地址', 'warning')
    return
  }
  ctx.value.commands.setImage(url)
  urlDialogVisible.value = false
}

// ---- Markdown 导入 / 导出 ----
// 导入:选 .md 文件 → 读文本 → ctx.importMarkdown 写入编辑器
// 导出:ctx.getMarkdown → Blob 下载为 .md 文件
// 复用「图片上传」的隐藏 input 模式
const mdInput = ref<HTMLInputElement | null>(null)
function triggerImportMarkdown() {
  mdInput.value?.click()
}
async function onMdSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许重复选同一文件
  if (!file) return
  try {
    const text = await file.text()
    ctx.value.importMarkdown(text)
    ctx.value.notify('已导入 Markdown', 'success')
  } catch {
    ctx.value.notify('导入失败:无法读取该文件', 'error')
  }
}

function exportMarkdown() {
  const md = ctx.value.getMarkdown()
  if (!md) {
    ctx.value.notify('当前未启用 Markdown 能力,无法导出', 'warning')
    return
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `content-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// dropdown 命令分派
function onMarkdownCommand(cmd: string) {
  if (cmd === 'import') triggerImportMarkdown()
  else if (cmd === 'export') exportMarkdown()
}

// ---- 打印 ----
// 隔离打印:把编辑器 HTML 写进一个隐藏 iframe,只打印它,避免污染宿主页面。
// iframe 卸载时机:load 后调 print();print() 返回后(用户已确认/取消)再移除。
// 兼容 Safari:用 onload 触发 print,而非 setTimeout;部分引擎要 setTimeout 才稳定,二者并用。
function printContent() {
  const html = ctx.value.getHTML()
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document!
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>打印</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;padding:24px;line-height:1.6}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px}pre{background:#f5f7fa;padding:12px;border-radius:4px;overflow-x:auto}code{background:#f5f7fa;padding:1px 4px;border-radius:3px}blockquote{border-left:3px solid #ddd;padding-left:1em;color:#666}</style>
</head><body>${html}</body></html>`)
  doc.close()
  const cleanup = () => iframe.remove()
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(cleanup, 500)
  }
}

// ---- 表格网格选择器 ----
const TABLE_MAX_ROWS = 8
const TABLE_MAX_COLS = 10
const tableHover = ref({ rows: 1, cols: 1 })
const tableDropdown = ref<{ handleClose?: () => void } | null>(null)
function resetTableHover() {
  tableHover.value = { rows: 1, cols: 1 }
}
// ElDropdown 的 @command 占位:网格点击走 cell 的 @click,这里不做 command 路由
function onTableInsert(_cmd?: unknown) {
  void _cmd
  prepareInsert()
  ctx.value.commands.insertTable(tableHover.value.rows, tableHover.value.cols)
  tableDropdown.value?.handleClose?.()
}

const currentCodeBlockLanguage = computed(
  () => (ctx.value.editor.value?.getAttributes('codeBlock') as { language?: CodeBlockLanguage })?.language ?? 'plaintext',
)
const currentCodeBlockLabel = computed(() => codeBlockLanguageLabel(currentCodeBlockLanguage.value))
function onCodeBlockLanguage(language: string) {
  ctx.value.commands.codeBlock(language as CodeBlockLanguage)
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
// 文字预设色:40 色,按灰阶 + 9 个色系组织(每色系 4 深浅),
// 覆盖主流编辑器(飞书/语雀)常用色,空字符串 = 清除
const PRESET_COLORS = [
  // 灰阶
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  // 红
  '#e03131', '#e8590c', '#f08c00', '#fcc419',
  // 橙黄
  '#d9480f', '#f76707', '#fa5252', '#ff6b6b',
  // 绿
  '#2f9e44', '#40c057', '#82c91e', '#a9e34b',
  // 青
  '#0c8599', '#1098ad', '#15aabf', '#22b8cf',
  // 蓝
  '#1864ab', '#1971c2', '#228be6', '#4dabf7',
  // 紫
  '#5f3dc4', '#6741d9', '#7048e8', '#9775fa',
  // 粉
  '#a61e4d', '#c2255c', '#d6336c', '#f06595',
  // 棕
  '#5c2f14', '#7b4019', '#a0522d', '#c08456',
]

// 背景高亮预设:32 色,各色系的浅色变体(适合做背景)
const PRESET_HIGHLIGHTS = [
  '#fff3bf', '#ffe8cc', '#ffe066', '#fab005',
  '#ffc9c9', '#ffa8a8', '#ff8787', '#fa5252',
  '#d3f9d8', '#b2f2bb', '#8ce99a', '#40c057',
  '#c3fae8', '#96f2d7', '#63e6be', '#0ca678',
  '#d0ebff', '#a5d8ff', '#74c0fc', '#1c7ed6',
  '#e5dbff', '#d0bfff', '#b197fc', '#7048e8',
  '#fcc2d7', '#faa2c1', '#f783ac', '#d6336c',
  '#fff0f6', '#ffdeeb', '#fcc2d7', '#e64980',
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

// ---- 自定义 hex 输入 ----
// 简单校验:#fff 或 #ffffff(不区分大小写)
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const customColor = ref('')
const customHighlight = ref('')

function applyCustomColor() {
  const v = customColor.value.trim()
  if (HEX_RE.test(v)) {
    selectColor(v)
  }
}
function applyCustomHighlight() {
  const v = customHighlight.value.trim()
  if (HEX_RE.test(v)) {
    selectHighlight(v)
  }
}

// ---- 文本对齐 ----
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

// 链接弹窗
// 根因:弹窗打开/确认时编辑器已失焦,ProseMirror 的 selection 在 v3 失焦后
// 不可靠,chain 内部 .focus() 也不保证恢复到正确位置 → 空选区下 setLink
// 只写 stored mark、不产生可见文本 →「点了确定没反应」。
// 修复:打开时保存绝对位置 from/to,确认时用 insertContentAt({from,to}, ...)
// 直接按位置写入,完全绕开 focus/selection 恢复。
const linkDialogVisible = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const linkNewTab = ref(true)
// 打开弹窗瞬间的选区绝对位置快照(不受后续失焦影响)
let savedFrom = 0
let savedTo = 0
let savedEmpty = true
let savedInLink = false

function openLinkDialog() {
  const ed = ctx.value.editor.value
  if (!ed) return
  // 用户从未点进编辑器时,先把光标移到文档末尾,否则会插到开头
  prepareInsert()
  // 快照当前 selection 的绝对位置
  const { from, to, empty } = ed.state.selection
  savedFrom = from
  savedTo = to
  savedEmpty = empty
  savedInLink = ed.isActive('link')
  const attrs = ed.getAttributes('link') as { href?: string } | undefined
  linkUrl.value = attrs?.href ?? ''
  // 选区有文字时,预填进「文字」框;光标状态留空
  linkText.value = !empty
    ? ed.state.doc.textBetween(from, to, ' ')
    : ''
  linkNewTab.value = true
  linkDialogVisible.value = true
}

function confirmLink() {
  const ed = ctx.value.editor.value
  if (!ed) return
  const href = linkUrl.value.trim()
  const text = linkText.value.trim()
  const target = linkNewTab.value ? '_blank' : '_self'
  const range = { from: savedFrom, to: savedTo }

  // 没填链接
  if (!href) {
    if (savedInLink) {
      // 当前在链接上 → 移除
      ctx.value.commands.setLink('', { target, range })
      ctx.value.notify('已移除链接', 'success')
    } else {
      // 既没填链接、也没选中已有链接 → 提示用户
      ctx.value.notify('请填写链接地址', 'warning')
      return
    }
    linkDialogVisible.value = false
    return
  }

  // 简单校验:带协议(http/https/mailto/tel)或明显的域名
  if (!/^(https?:|mailto:|tel:)/i.test(href) && !/\.[a-z]{2,}/i.test(href)) {
    ctx.value.notify('链接格式不正确,请输入完整网址(如 https://example.com)', 'warning')
    return
  }

  if (savedEmpty || text) {
    // 光标(无选区)或填了文字 → 用 insertLinkText 按位置插入/替换
    ctx.value.commands.insertLinkText(href, text, { target, range })
  } else {
    // 有选区但没填文字 → 仅给原文套链接(保留原文)
    ctx.value.commands.setLink(href, { target, range })
  }
  linkDialogVisible.value = false
}
</script>

<template>
  <div class="tvp-toolbar">
    <!-- 撤销/重做 -->
    <ElTooltip content="撤销" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.undo()"><Undo2 :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="重做" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.redo()"><Redo2 :size="18" /></ElButton>
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
          <ElDropdownItem :command="0">
            <span class="tvp-heading-preview">正文</span>
          </ElDropdownItem>
          <ElDropdownItem :command="1">
            <span class="tvp-heading-preview tvp-h1">标题 1</span>
          </ElDropdownItem>
          <ElDropdownItem :command="2">
            <span class="tvp-heading-preview tvp-h2">标题 2</span>
          </ElDropdownItem>
          <ElDropdownItem :command="3">
            <span class="tvp-heading-preview tvp-h3">标题 3</span>
          </ElDropdownItem>
          <ElDropdownItem :command="4">
            <span class="tvp-heading-preview tvp-h4">标题 4</span>
          </ElDropdownItem>
          <ElDropdownItem :command="5">
            <span class="tvp-heading-preview tvp-h5">标题 5</span>
          </ElDropdownItem>
          <ElDropdownItem :command="6">
            <span class="tvp-heading-preview tvp-h6">标题 6</span>
          </ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>

    <span class="tvp-divider" />

    <!-- 格式化 -->
    <ElTooltip content="加粗" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('bold') ? 'primary' : 'default'"
        @click="ctx.commands.bold()"
      ><Bold :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="斜体" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('italic') ? 'primary' : 'default'"
        @click="ctx.commands.italic()"
      ><Italic :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="删除线" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('strike') ? 'primary' : 'default'"
        @click="ctx.commands.strike()"
      ><Strikethrough :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="下划线" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('underline') ? 'primary' : 'default'"
        @click="ctx.commands.underline()"
      ><Underline :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="行内代码" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        aria-label="行内代码"
        :type="ctx.isActive('code') ? 'primary' : 'default'"
        @click="ctx.commands.code()"
      ><Code :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="上标" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        aria-label="上标"
        :type="ctx.isActive('superscript') ? 'primary' : 'default'"
        @click="ctx.commands.superscript()"
      ><Superscript :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="下标" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        aria-label="下标"
        :type="ctx.isActive('subscript') ? 'primary' : 'default'"
        @click="ctx.commands.subscript()"
      ><Subscript :size="18" /></ElButton>
    </ElTooltip>

    <!-- 文字颜色 -->
    <ElDropdown trigger="click">
      <ElButton text class="tvp-icon-btn">
        <Type :size="18" :style="{ color: currentColor || 'inherit' }" />
      </ElButton>
      <template #dropdown>
        <div class="tvp-color-panel">
          <div
            class="tvp-color-clear"
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
          <div class="tvp-color-custom">
            <input
              v-model="customColor"
              class="tvp-hex-input"
              placeholder="#000000"
              @keyup.enter="applyCustomColor"
            />
          </div>
        </div>
      </template>
    </ElDropdown>

    <!-- 背景高亮 -->
    <ElDropdown trigger="click">
      <ElButton text class="tvp-icon-btn">
        <Highlighter :size="16" :style="{ color: currentHighlight || 'inherit' }" />
      </ElButton>
      <template #dropdown>
        <div class="tvp-color-panel">
          <div
            class="tvp-color-clear"
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
          <div class="tvp-color-custom">
            <input
              v-model="customHighlight"
              class="tvp-hex-input"
              placeholder="#ffff00"
              @keyup.enter="applyCustomHighlight"
            />
          </div>
        </div>
      </template>
    </ElDropdown>

    <!-- 文本对齐 -->
    <ElDropdown trigger="click" @command="onAlign">
      <ElButton text class="tvp-icon-btn">
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
    <ElTooltip content="无序列表" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('bulletList') ? 'primary' : 'default'"
        @click="ctx.commands.bulletList()"
      ><List :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="有序列表" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('orderedList') ? 'primary' : 'default'"
        @click="ctx.commands.orderedList()"
      ><ListOrdered :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="任务列表" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('taskList') ? 'primary' : 'default'"
        @click="ctx.commands.taskList()"
      ><ListChecks :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip content="引用" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        :type="ctx.isActive('blockquote') ? 'primary' : 'default'"
        @click="ctx.commands.blockquote()"
      ><Quote :size="18" /></ElButton>
    </ElTooltip>
    <ElTooltip :content="`代码块:${currentCodeBlockLabel}`" placement="top" :show-after="300">
      <ElDropdown trigger="click" @command="onCodeBlockLanguage">
        <ElButton
          text
          class="tvp-icon-btn"
          aria-label="代码块"
          :type="ctx.isActive('codeBlock') ? 'primary' : 'default'"
        ><Code :size="18" /></ElButton>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem
              v-for="language in CODE_BLOCK_LANGUAGES"
              :key="language.value"
              :command="language.value"
            >
              <Code :size="15" />
              <span style="margin-left: 6px">{{ language.label }}</span>
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </ElTooltip>
    <ElTooltip content="分割线" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.hr()"><Minus :size="18" /></ElButton>
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 链接 -->
    <ElTooltip content="链接" placement="top" :show-after="300">
      <ElButton
        text
        class="tvp-icon-btn"
        aria-label="链接"
        :type="ctx.isActive('link') ? 'primary' : 'default'"
        @click="openLinkDialog"
      ><Link :size="18" /></ElButton>
    </ElTooltip>

    <!-- 图片上传 -->
    <ElTooltip v-if="uploadImage" content="上传图片" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" aria-label="上传图片" @click="triggerImageUpload"><ImagePlus :size="18" /></ElButton>
    </ElTooltip>
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      class="tvp-image-input"
      @change="onImageSelected"
    />

    <!-- 网络图片:输入 URL 插入 -->
    <ElTooltip content="网络图片" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" aria-label="网络图片" @click="openUrlDialog"><Link2 :size="18" /></ElButton>
    </ElTooltip>
    <ElDialog v-model="urlDialogVisible" title="插入网络图片" width="420px" append-to-body>
      <ElInput
        v-model="imageUrl"
        placeholder="请输入图片地址 https://..."
        @keyup.enter="confirmUrlImage"
      />
      <template #footer>
        <ElButton @click="urlDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="confirmUrlImage">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 表格(网格选择器) -->
    <ElTooltip content="插入表格" placement="top" :show-after="300">
      <ElDropdown ref="tableDropdown" trigger="click" @command="onTableInsert">
        <ElButton text class="tvp-icon-btn"><Table :size="18" /></ElButton>
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
    <ElTooltip content="清除格式" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.clearFormat()"><Eraser :size="18" /></ElButton>
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 打印 -->
    <ElTooltip content="打印" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" @click="printContent"><Printer :size="18" /></ElButton>
    </ElTooltip>

    <!-- Markdown:导入 / 导出(合并到一个 dropdown,对齐飞书/语雀) -->
    <ElTooltip content="导入 / 导出 Markdown" placement="top" :show-after="300">
      <ElDropdown trigger="click" @command="onMarkdownCommand">
        <ElButton text class="tvp-icon-btn"><MarkdownIcon :size="18" /></ElButton>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="import"><FileUp :size="15" /> 导入 Markdown</ElDropdownItem>
            <ElDropdownItem command="export"><FileDown :size="15" /> 导出 Markdown</ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </ElTooltip>
    <input
      ref="mdInput"
      type="file"
      accept=".md,.markdown,text/markdown,text/plain"
      class="tvp-image-input"
      @change="onMdSelected"
    />

    <!-- 视图模式:与其他功能按钮并列排列,用分隔符分区 -->
    <span class="tvp-divider" />

    <!-- 预览(只读切换) -->
    <ElTooltip :content="isPreview ? '编辑' : '预览'" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" :aria-label="isPreview ? '编辑' : '预览'" @click="emit('toggle-preview')">
        <component :is="isPreview ? Pencil : Eye" :size="18" />
      </ElButton>
    </ElTooltip>

    <!-- 全屏 -->
    <ElTooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="top" :show-after="300">
      <ElButton text class="tvp-icon-btn" :aria-label="isFullscreen ? '退出全屏' : '全屏'" @click="emit('toggle-fullscreen')">
        <component :is="isFullscreen ? Minimize2 : Maximize2" :size="18" />
      </ElButton>
    </ElTooltip>

    <!-- 链接弹窗(ElDialog) -->
    <ElDialog
      v-model="linkDialogVisible"
      title="插入链接"
      width="440px"
      append-to-body
      :close-on-click-modal="true"
    >
      <div class="tvp-link-form">
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">文字</label>
          <ElInput
            v-model="linkText"
            placeholder="显示的文字(留空则用链接地址)"
            clearable
          />
        </div>
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">链接</label>
          <ElInput
            v-model="linkUrl"
            placeholder="https://example.com"
            clearable
            @keyup.enter="confirmLink"
          />
        </div>
        <div class="tvp-link-form__row tvp-link-form__row--check">
          <ElCheckbox v-model="linkNewTab">在新窗口打开</ElCheckbox>
        </div>
      </div>
      <template #footer>
        <ElButton @click="linkDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="confirmLink">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/*
 * 纯图标按钮:统一为 32×32 正方形击中区。
 *
 * 为什么:Element Plus 的 .el-button 默认 padding: 8px 15px,
 * 塞一个 16px 图标进去会得到 ≈46×32 的横向长方形,图标偏左、
 * 右侧大块留白,视觉松散。Notion / 飞书 / 语雀 / Google Docs
 * 的工具栏图标按钮都是正方形击中区,这是业界事实标准。
 *
 * 这里只约束「纯图标」按钮(无文字/无复合内容),带文字的
 * 标题/颜色/对齐按钮仍按内容自适应宽度。
 */
.tvp-toolbar :deep(.el-button.tvp-icon-btn) {
  width: 32px;
  height: 32px;
  padding: 0;
}

/*
 * 干掉 Element Plus 自带的 .el-button + .el-button { margin-left: 12px }。
 * 工具栏是 flex 容器,margin-left 不会在换行处被清除,导致折到第二行的
 * 第一个按钮仍带着 12px 左缩进、两行起点对不齐。改用容器的 gap 统一
 * 控制间距,gap 不受换行影响,两行起点天然对齐。对工具栏内所有按钮生效。
 */
.tvp-toolbar :deep(.el-button + .el-button) {
  margin-left: 0;
}

.tvp-toolbar {
  /* 移动端:横向滚动,避免折成多行占地方 */
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  background: var(--el-fill-color-blank, #fff);
  /* 隐藏滚动条但保留滚动 */
  scrollbar-width: thin;
}

/* 桌面端(sm ≥640):工具栏恢复折行,空间够时更整齐 */
@media (min-width: 640px) {
  .tvp-toolbar {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}

/* 隐藏的图片选择 input */
.tvp-image-input {
  display: none;
}

/* 标题级别下拉项:克制的小幅字号差异 + 字重区分,看清层级但不撑爆菜单 */
.tvp-heading-preview {
  display: inline-block;
  font-size: 13px;
  font-weight: 400;
}

.tvp-h1 { font-size: 15px; font-weight: 700; }
.tvp-h2 { font-size: 14px; font-weight: 700; }
.tvp-h3 { font-size: 13px; font-weight: 600; }
.tvp-h4 { font-size: 13px; font-weight: 600; }
.tvp-h5 { font-size: 12px; font-weight: 600; }
.tvp-h6 { font-size: 12px; font-weight: 500; }

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

.tvp-color-panel {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 8px;
  width: 244px;
}

.tvp-color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--el-border-color, #dcdfe6);
  font-size: 12px;
  line-height: 22px;
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

/* 清除颜色按钮:色板顶部占满宽度的文字行 */
.tvp-color-clear {
  grid-column: 1 / -1;
  padding: 4px 8px;
  margin-bottom: 2px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  text-align: center;
}

.tvp-color-clear:hover {
  background: var(--el-fill-color-light, #f5f7fa);
}

.tvp-color-clear.is-active {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

/* 自定义 hex 输入区:在色板下方占满宽度 */
.tvp-color-custom {
  grid-column: 1 / -1;
  margin-top: 4px;
}

.tvp-hex-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  outline: none;
  color: var(--el-text-color-regular, #606266);
}

.tvp-hex-input:focus {
  border-color: var(--el-color-primary, #409eff);
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

/* 链接弹窗表单 */
.tvp-link-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tvp-link-form__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tvp-link-form__label {
  flex-shrink: 0;
  width: 36px;
  font-size: 14px;
  color: var(--el-text-color-regular, #606266);
}

.tvp-link-form__row--check {
  padding-left: 46px;
}
</style>
