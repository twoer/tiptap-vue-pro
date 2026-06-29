<script setup lang="ts">
/**
 * Naive UI 适配的工具栏。
 *
 * 与 EP 版 Toolbar.vue 功能完全对等:撤销/重做、标题、格式化、文字颜色/背景高亮、
 * 对齐、列表/任务列表/引用/代码块/分割线、链接、图片上传、表格网格、清除格式、
 * 打印、Markdown 导入导出、全屏/预览。
 *
 * 命令直接调 ctx.commands.xxx(),消息提示走 ctx.notify(由 ProEditorNaive 注入)。
 *
 * 与 EP 的差异主要在组件映射:
 * - NDropdown 用 options 数据驱动(EP 用插槽模板)
 * - 颜色色板 / 表格网格用 NPopover + 自绘(复刻 EP 的预设色 + 网格选择器)
 * - 链接弹窗用 NModal(EP 用 ElDialog)
 */
import { computed, ref, h, defineComponent, markRaw } from 'vue'
import {
  NButton,
  NTooltip,
  NDropdown,
  NPopover,
  NModal,
  NInput,
  NCheckbox,
  type DropdownOption,
} from 'naive-ui'
import {
  Undo2, Redo2, ChevronDown,
  Bold, Italic, Strikethrough, Underline,
  Superscript, Subscript,
  Type, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentDecrease, IndentIncrease,
  List, ListOrdered, ListChecks,
  Quote, Code, Minus,
  Link, ImagePlus, Link2, Table,
  FileDown, FileUp,
  Eraser, Printer,
  Maximize2, Minimize2, Eye, Pencil,
} from 'lucide-vue-next'
import { CODE_BLOCK_LANGUAGES, DEFAULT_TOOLBAR, codeBlockLanguageLabel, normalizeToolbarConfig } from 'tiptap-vue-pro-core'
import type { CodeBlockLanguage, ProEditorContext, ToolbarConfig, ToolbarProp, UploadImage } from 'tiptap-vue-pro-core'

/**
 * Markdown 官方 logo。与 EP 版一致,内联 SVG,暴露 size 属性。
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
            h('rect', { x: 2, y: 5, width: 20, height: 14, rx: 2 }),
            h('path', { d: 'M6 15V9l3 3 3-3v6' }),
            h('path', { d: 'M15 9v6' }),
            h('path', { d: 'm13 13 2 2 2-2' }),
          ],
        )
    },
  }),
)

const props = withDefaults(
  defineProps<{
    ctx: ProEditorContext & { prepareInsert?: () => void }
    /** 图片上传函数。传入则显示「上传图片」按钮 */
    uploadImage?: UploadImage
    /** 是否全屏 */
    isFullscreen?: boolean
    /** 是否预览态 */
    isPreview?: boolean
    /** 工具栏配置。false 表示不渲染内置按钮 */
    toolbar?: ToolbarProp
  }>(),
  {
    toolbar: undefined,
  },
)

const emit = defineEmits<{
  'toggle-fullscreen': []
  'toggle-preview': []
}>()

function toggleFullscreen() {
  emit('toggle-fullscreen')
}

function togglePreview() {
  emit('toggle-preview')
}

const ctx = computed(() => props.ctx)
const FALLBACK_TOOLBAR: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'strike', 'underline', 'code', 'superscript', 'subscript'],
  ['color', 'highlight'],
  ['align', 'decreaseIndent', 'increaseIndent'],
  ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'hr'],
  ['link', 'image', 'table'],
  ['clearFormat'],
  ['markdown', 'print', 'fullscreen', 'preview'],
]
const toolbarGroups = computed(() => {
  if (props.toolbar === false) return []
  const source = props.toolbar ?? (DEFAULT_TOOLBAR.length > 0 ? DEFAULT_TOOLBAR : FALLBACK_TOOLBAR)
  const normalized = normalizeToolbarConfig(source)
  return normalized.length > 0 || source.length === 0
    ? normalized
    : source.map((group) => [...group])
})

/**
 * 插入类操作前的预处理:若编辑器从未获得焦点,先把光标定位到文档末尾。
 */
function prepareInsert() {
  ctx.value.prepareInsert?.()
}

// 隐藏的图片选择 input(复用 EP 的隐藏 input 模式)
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
  input.value = ''
}

// 网络图片:弹窗输入 URL → setImage 插入(与 EP 版对等)
const urlModalVisible = ref(false)
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
  urlModalVisible.value = true
}
function confirmUrlImage() {
  const url = imageUrl.value.trim()
  if (!url) {
    urlModalVisible.value = false
    return
  }
  if (!isSupportedImageUrl(url)) {
    ctx.value.notify('请输入有效的图片地址', 'warning')
    return false
  }
  ctx.value.commands.setImage(url)
  urlModalVisible.value = false
}

// ---- Markdown 导入 / 导出 ----
const mdInput = ref<HTMLInputElement | null>(null)
function triggerImportMarkdown() {
  mdInput.value?.click()
}
async function onMdSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
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

// ---- 打印 ----(实现同 EP:隔离 iframe 打印,避免污染宿主页)
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
const tablePopover = ref(false)
function resetTableHover() {
  tableHover.value = { rows: 1, cols: 1 }
}
function onTableInsert() {
  prepareInsert()
  ctx.value.commands.insertTable(tableHover.value.rows, tableHover.value.cols)
  tablePopover.value = false
}

const currentCodeBlockLanguage = computed(
  () => (ctx.value.editor.value?.getAttributes('codeBlock') as { language?: CodeBlockLanguage })?.language ?? 'plaintext',
)
const currentCodeBlockLabel = computed(() => codeBlockLanguageLabel(currentCodeBlockLanguage.value))
const codeBlockPopover = ref(false)
function onCodeBlockSelect(language: CodeBlockLanguage) {
  ctx.value.commands.codeBlock(language)
  codeBlockPopover.value = false
}

// ---- 标题级别 dropdown ----
// 当前标题级别(用于 dropdown 显示)
const headingLabel = computed(() => {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (ctx.value.isActive('heading', { level })) return `H${level}`
  }
  return '正文'
})

// NDropdown 的 options:用 render-label 渲染不同字号的标题预览
const headingOptions: DropdownOption[] = [
  { label: '正文', key: 0 },
  { label: '标题 1', key: 1 },
  { label: '标题 2', key: 2 },
  { label: '标题 3', key: 3 },
  { label: '标题 4', key: 4 },
  { label: '标题 5', key: 5 },
  { label: '标题 6', key: 6 },
]
const HEADING_PREVIEW_STYLES: Record<number, { fontSize: string; fontWeight: number }> = {
  0: { fontSize: '13px', fontWeight: 400 },
  1: { fontSize: '15px', fontWeight: 700 },
  2: { fontSize: '14px', fontWeight: 700 },
  3: { fontSize: '13px', fontWeight: 600 },
  4: { fontSize: '13px', fontWeight: 600 },
  5: { fontSize: '12px', fontWeight: 600 },
  6: { fontSize: '12px', fontWeight: 500 },
}
function headingPreviewStyle(level: number | string) {
  return HEADING_PREVIEW_STYLES[Number(level)] ?? HEADING_PREVIEW_STYLES[0]
}
function renderHeadingLabel(opt: DropdownOption) {
  const level = opt.key as number
  const style = headingPreviewStyle(level)
  return h('span', { class: `tvp-heading-preview tvp-h${level}`, style }, opt.label as string)
}
function onHeadingSelect(key: string | number) {
  ctx.value.commands.toggleHeading(Number(key) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}
// ---- 颜色选择器(复刻 EP 预设色板)----
const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  '#e03131', '#e8590c', '#f08c00', '#fcc419',
  '#d9480f', '#f76707', '#fa5252', '#ff6b6b',
  '#2f9e44', '#40c057', '#82c91e', '#a9e34b',
  '#0c8599', '#1098ad', '#15aabf', '#22b8cf',
  '#1864ab', '#1971c2', '#228be6', '#4dabf7',
  '#5f3dc4', '#6741d9', '#7048e8', '#9775fa',
  '#a61e4d', '#c2255c', '#d6336c', '#f06595',
  '#5c2f14', '#7b4019', '#a0522d', '#c08456',
]
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
const FONT_FAMILIES = [
  { label: '默认字体', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times New Roman', value: '"Times New Roman"' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Monospace', value: 'monospace' },
]
const FONT_SIZES = ['', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '64px', '72px', '96px']
const LINE_HEIGHTS = ['', '1', '1.2', '1.4', '1.6', '1.8', '2']

const currentColor = computed(
  () => (ctx.value.editor.value?.getAttributes('textStyle') as { color?: string })?.color ?? '',
)
const currentTextStyle = computed(
  () =>
    (ctx.value.editor.value?.getAttributes('textStyle') as {
      fontFamily?: string
      fontSize?: string
      lineHeight?: string
    }) ?? {},
)
const currentHighlight = computed(
  () => (ctx.value.editor.value?.getAttributes('highlight') as { color?: string })?.color ?? '',
)

function selectColor(color: string) {
  ctx.value.commands.setColor(color)
}
function selectHighlight(color: string) {
  ctx.value.commands.toggleHighlight(color)
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const customColor = ref('')
const customHighlight = ref('')
function applyCustomColor() {
  const v = customColor.value.trim()
  if (HEX_RE.test(v)) selectColor(v)
}
function applyCustomHighlight() {
  const v = customHighlight.value.trim()
  if (HEX_RE.test(v)) selectHighlight(v)
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
const alignOptions: DropdownOption[] = [
  { label: '左对齐', key: 'left' },
  { label: '居中', key: 'center' },
  { label: '右对齐', key: 'right' },
  { label: '两端对齐', key: 'justify' },
]
function renderAlignLabel(opt: DropdownOption) {
  const map: Record<string, typeof AlignLeft> = {
    left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify,
  }
  const Icon = map[opt.key as string]
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
    h(Icon, { size: 16 }),
    opt.label as string,
  ])
}
function onAlignSelect(key: string | number) {
  ctx.value.commands.align(key as 'left' | 'center' | 'right' | 'justify')
}

const currentFontLabel = computed(
  () => FONT_FAMILIES.find((font) => font.value === currentTextStyle.value.fontFamily)?.label ?? '字体',
)
const currentFontSizeLabel = computed(() => currentTextStyle.value.fontSize || '字号')
const currentLineHeightLabel = computed(() => currentTextStyle.value.lineHeight || '行高')

const fontFamilyOptions: DropdownOption[] = FONT_FAMILIES.map((font) => ({
  label: font.label,
  key: font.value,
  fontFamily: font.value,
}))
const fontSizeOptions: DropdownOption[] = FONT_SIZES.map((size) => ({
  label: size || '默认字号',
  key: size,
}))
const lineHeightOptions: DropdownOption[] = LINE_HEIGHTS.map((lineHeight) => ({
  label: lineHeight || '默认行高',
  key: lineHeight,
}))
function renderFontFamilyLabel(opt: DropdownOption) {
  return h('span', { style: { fontFamily: (opt.fontFamily as string) || undefined } }, opt.label as string)
}
function onFontFamilySelect(key: string | number) {
  ctx.value.commands.setFontFamily(String(key))
}
function onFontSizeSelect(key: string | number) {
  ctx.value.commands.setFontSize(String(key))
}
function onLineHeightSelect(key: string | number) {
  ctx.value.commands.setLineHeight(String(key))
}

// ---- Markdown dropdown ----
const mdOptions: DropdownOption[] = [
  { key: 'import', label: '导入 Markdown' },
  { key: 'export', label: '导出 Markdown' },
]
function renderMdLabel(opt: DropdownOption) {
  const Icon = opt.key === 'import' ? FileUp : FileDown
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
    h(Icon, { size: 15 }),
    opt.label as string,
  ])
}
function onMdSelect(key: string | number) {
  if (key === 'import') triggerImportMarkdown()
  else if (key === 'export') exportMarkdown()
}

// ---- 链接弹窗 ----
// 逻辑与 EP 版一致:打开时保存选区绝对位置,确认时按位置写入(绕开失焦导致的 selection 漂移)。
const linkDialogVisible = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const linkNewTab = ref(true)
let savedFrom = 0
let savedTo = 0
let savedEmpty = true
let savedInLink = false

function openLinkDialog() {
  const ed = ctx.value.editor.value
  if (!ed) return
  prepareInsert()
  const { from, to, empty } = ed.state.selection
  savedFrom = from
  savedTo = to
  savedEmpty = empty
  savedInLink = ed.isActive('link')
  const attrs = ed.getAttributes('link') as { href?: string } | undefined
  linkUrl.value = attrs?.href ?? ''
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

  if (!href) {
    if (savedInLink) {
      ctx.value.commands.setLink('', { target, range })
      ctx.value.notify('已移除链接', 'success')
    } else {
      ctx.value.notify('请填写链接地址', 'warning')
      return
    }
    linkDialogVisible.value = false
    return
  }

  if (!/^(https?:|mailto:|tel:)/i.test(href) && !/\.[a-z]{2,}/i.test(href)) {
    ctx.value.notify('链接格式不正确,请输入完整网址(如 https://example.com)', 'warning')
    return
  }

  if (savedEmpty || text) {
    ctx.value.commands.insertLinkText(href, text, { target, range })
  } else {
    ctx.value.commands.setLink(href, { target, range })
  }
  linkDialogVisible.value = false
}
</script>

<template>
  <div class="tvp-toolbar">
    <slot
      name="before"
      :ctx="ctx"
      :is-fullscreen="isFullscreen"
      :is-preview="isPreview"
      :toggle-fullscreen="toggleFullscreen"
      :toggle-preview="togglePreview"
    />

    <template v-for="(group, groupIndex) in toolbarGroups" :key="groupIndex">
      <span v-if="groupIndex > 0" class="tvp-divider" />

      <template v-for="item in group" :key="item">
        <NTooltip v-if="item === 'undo'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" aria-label="撤销" @click="ctx.commands.undo()"><Undo2 :size="18" /></NButton>
          </template>
          撤销
        </NTooltip>

        <NTooltip v-else-if="item === 'redo'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" aria-label="重做" @click="ctx.commands.redo()"><Redo2 :size="18" /></NButton>
          </template>
          重做
        </NTooltip>

        <NTooltip v-else-if="item === 'heading'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="headingOptions"
                :render-label="renderHeadingLabel"
                @select="onHeadingSelect"
              >
                <NButton text class="tvp-select-btn tvp-select-btn--heading" aria-label="标题">
                  {{ headingLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          标题
        </NTooltip>

        <NTooltip v-else-if="item === 'fontFamily'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="fontFamilyOptions"
                :render-label="renderFontFamilyLabel"
                @select="onFontFamilySelect"
              >
                <NButton text class="tvp-select-btn tvp-select-btn--font" aria-label="字体">
                  {{ currentFontLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          字体
        </NTooltip>

        <NTooltip v-else-if="item === 'fontSize'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="fontSizeOptions"
                @select="onFontSizeSelect"
              >
                <NButton text class="tvp-select-btn tvp-select-btn--size" aria-label="字号">
                  {{ currentFontSizeLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          字号
        </NTooltip>

        <NTooltip v-else-if="item === 'lineHeight'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="lineHeightOptions"
                @select="onLineHeightSelect"
              >
                <NButton text class="tvp-select-btn tvp-select-btn--line-height" aria-label="行高">
                  {{ currentLineHeightLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          行高
        </NTooltip>

        <NTooltip v-else-if="item === 'bold'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="加粗"
              :type="ctx.isActive('bold') ? 'primary' : 'default'"
              @click="ctx.commands.bold()"
            ><Bold :size="18" /></NButton>
          </template>
          加粗
        </NTooltip>

        <NTooltip v-else-if="item === 'italic'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="斜体"
              :type="ctx.isActive('italic') ? 'primary' : 'default'"
              @click="ctx.commands.italic()"
            ><Italic :size="18" /></NButton>
          </template>
          斜体
        </NTooltip>

        <NTooltip v-else-if="item === 'strike'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="删除线"
              :type="ctx.isActive('strike') ? 'primary' : 'default'"
              @click="ctx.commands.strike()"
            ><Strikethrough :size="18" /></NButton>
          </template>
          删除线
        </NTooltip>

        <NTooltip v-else-if="item === 'underline'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="下划线"
              :type="ctx.isActive('underline') ? 'primary' : 'default'"
              @click="ctx.commands.underline()"
            ><Underline :size="18" /></NButton>
          </template>
          下划线
        </NTooltip>

        <NTooltip v-else-if="item === 'code'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="行内代码"
              :type="ctx.isActive('code') ? 'primary' : 'default'"
              @click="ctx.commands.code()"
            ><Code :size="18" /></NButton>
          </template>
          行内代码
        </NTooltip>

        <NTooltip v-else-if="item === 'superscript'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="上标"
              :type="ctx.isActive('superscript') ? 'primary' : 'default'"
              @click="ctx.commands.superscript()"
            ><Superscript :size="18" /></NButton>
          </template>
          上标
        </NTooltip>

        <NTooltip v-else-if="item === 'subscript'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="下标"
              :type="ctx.isActive('subscript') ? 'primary' : 'default'"
              @click="ctx.commands.subscript()"
            ><Subscript :size="18" /></NButton>
          </template>
          下标
        </NTooltip>

        <NTooltip v-else-if="item === 'color'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NPopover trigger="click" placement="bottom" :width="260">
                <template #trigger>
                  <NButton text class="tvp-icon-btn" aria-label="文字颜色">
                    <Type :size="18" :style="{ color: currentColor || 'inherit' }" />
                  </NButton>
                </template>
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
              </NPopover>
            </span>
          </template>
          文字颜色
        </NTooltip>

        <NTooltip v-else-if="item === 'highlight'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NPopover trigger="click" placement="bottom" :width="260">
                <template #trigger>
                  <NButton text class="tvp-icon-btn" aria-label="背景高亮">
                    <Highlighter :size="16" :style="{ color: currentHighlight || 'inherit' }" />
                  </NButton>
                </template>
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
              </NPopover>
            </span>
          </template>
          背景高亮
        </NTooltip>

        <NTooltip v-else-if="item === 'align'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="alignOptions"
                :render-label="renderAlignLabel"
                @select="onAlignSelect"
              >
                <NButton text class="tvp-icon-btn" aria-label="文本对齐">
                  <component :is="alignIcon" :size="16" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          文本对齐
        </NTooltip>

        <NTooltip v-else-if="item === 'decreaseIndent'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="减少缩进"
              @click="ctx.commands.decreaseIndent()"
            ><IndentDecrease :size="18" /></NButton>
          </template>
          减少缩进
        </NTooltip>

        <NTooltip v-else-if="item === 'increaseIndent'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="增加缩进"
              @click="ctx.commands.increaseIndent()"
            ><IndentIncrease :size="18" /></NButton>
          </template>
          增加缩进
        </NTooltip>

        <NTooltip v-else-if="item === 'bulletList'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="无序列表"
              :type="ctx.isActive('bulletList') ? 'primary' : 'default'"
              @click="ctx.commands.bulletList()"
            ><List :size="18" /></NButton>
          </template>
          无序列表
        </NTooltip>

        <NTooltip v-else-if="item === 'orderedList'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="有序列表"
              :type="ctx.isActive('orderedList') ? 'primary' : 'default'"
              @click="ctx.commands.orderedList()"
            ><ListOrdered :size="18" /></NButton>
          </template>
          有序列表
        </NTooltip>

        <NTooltip v-else-if="item === 'taskList'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="任务列表"
              :type="ctx.isActive('taskList') ? 'primary' : 'default'"
              @click="ctx.commands.taskList()"
            ><ListChecks :size="18" /></NButton>
          </template>
          任务列表
        </NTooltip>

        <NTooltip v-else-if="item === 'blockquote'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="引用"
              :type="ctx.isActive('blockquote') ? 'primary' : 'default'"
              @click="ctx.commands.blockquote()"
            ><Quote :size="18" /></NButton>
          </template>
          引用
        </NTooltip>

        <NTooltip v-else-if="item === 'codeBlock'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NPopover v-model:show="codeBlockPopover" trigger="click" placement="bottom" :show-arrow="false">
                <template #trigger>
                  <NButton
                    text
                    class="tvp-icon-btn"
                    aria-label="代码块"
                    :type="ctx.isActive('codeBlock') ? 'primary' : 'default'"
                  ><Code :size="18" /></NButton>
                </template>
                <div class="tvp-code-language-menu">
                  <button
                    v-for="language in CODE_BLOCK_LANGUAGES"
                    :key="language.value"
                    type="button"
                    class="tvp-code-language-menu__item"
                    :class="{ 'is-active': currentCodeBlockLanguage === language.value }"
                    @click="onCodeBlockSelect(language.value)"
                  >
                    <Code :size="15" />
                    <span>{{ language.label }}</span>
                  </button>
                </div>
              </NPopover>
            </span>
          </template>
          代码块: {{ currentCodeBlockLabel }}
        </NTooltip>

        <NTooltip v-else-if="item === 'hr'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" aria-label="分割线" @click="ctx.commands.hr()"><Minus :size="18" /></NButton>
          </template>
          分割线
        </NTooltip>

        <NTooltip v-else-if="item === 'link'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              aria-label="链接"
              :type="ctx.isActive('link') ? 'primary' : 'default'"
              @click="openLinkDialog"
            ><Link :size="18" /></NButton>
          </template>
          链接
        </NTooltip>

        <template v-else-if="item === 'image'">
          <NTooltip v-if="uploadImage" placement="top" :show-arrow="false">
            <template #trigger>
              <NButton text class="tvp-icon-btn" aria-label="上传图片" @click="triggerImageUpload"><ImagePlus :size="18" /></NButton>
            </template>
            上传图片
          </NTooltip>
          <NTooltip placement="top" :show-arrow="false">
            <template #trigger>
              <NButton text class="tvp-icon-btn" aria-label="网络图片" @click="openUrlDialog"><Link2 :size="18" /></NButton>
            </template>
            网络图片
          </NTooltip>
        </template>

        <NTooltip v-else-if="item === 'table'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NPopover v-model:show="tablePopover" trigger="click" placement="bottom">
                <template #trigger>
                  <NButton text class="tvp-icon-btn" aria-label="插入表格"><Table :size="18" /></NButton>
                </template>
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
              </NPopover>
            </span>
          </template>
          插入表格
        </NTooltip>

        <NTooltip v-else-if="item === 'clearFormat'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" aria-label="清除格式" @click="ctx.commands.clearFormat()"><Eraser :size="18" /></NButton>
          </template>
          清除格式
        </NTooltip>

        <NTooltip v-else-if="item === 'markdown'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="mdOptions"
                :render-label="renderMdLabel"
                @select="onMdSelect"
              >
                <NButton text class="tvp-icon-btn" aria-label="导入 / 导出 Markdown"><MarkdownIcon :size="18" /></NButton>
              </NDropdown>
            </span>
          </template>
          导入 / 导出 Markdown
        </NTooltip>

        <NTooltip v-else-if="item === 'print'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" aria-label="打印" @click="printContent"><Printer :size="18" /></NButton>
          </template>
          打印
        </NTooltip>

        <NTooltip v-else-if="item === 'fullscreen'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" :aria-label="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
              <component :is="isFullscreen ? Minimize2 : Maximize2" :size="18" />
            </NButton>
          </template>
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </NTooltip>

        <NTooltip v-else-if="item === 'preview'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" :aria-label="isPreview ? '编辑' : '预览'" @click="togglePreview">
              <component :is="isPreview ? Pencil : Eye" :size="18" />
            </NButton>
          </template>
          {{ isPreview ? '编辑' : '预览' }}
        </NTooltip>
      </template>
    </template>

    <slot
      name="after"
      :ctx="ctx"
      :is-fullscreen="isFullscreen"
      :is-preview="isPreview"
      :toggle-fullscreen="toggleFullscreen"
      :toggle-preview="togglePreview"
    />

    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      class="tvp-image-input"
      @change="onImageSelected"
    />

    <NModal
      v-model:show="urlModalVisible"
      preset="dialog"
      title="插入网络图片"
      positive-text="确定"
      negative-text="取消"
      :show-icon="false"
      @positive-click="confirmUrlImage"
    >
      <NInput
        v-model:value="imageUrl"
        placeholder="请输入图片地址 https://..."
        @keyup.enter="confirmUrlImage"
      />
    </NModal>

    <input
      ref="mdInput"
      type="file"
      accept=".md,.markdown,text/markdown,text/plain"
      class="tvp-image-input"
      @change="onMdSelected"
    />

    <!-- 链接弹窗(NModal)-->
    <NModal
      v-model:show="linkDialogVisible"
      preset="card"
      title="插入链接"
      style="width: 460px; max-width: 92vw;"
      :mask-closable="true"
    >
      <div class="tvp-link-form">
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">文字</label>
          <NInput
            v-model:value="linkText"
            placeholder="显示的文字(留空则用链接地址)"
            clearable
          />
        </div>
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">链接</label>
          <NInput
            v-model:value="linkUrl"
            placeholder="https://example.com"
            clearable
            @keyup.enter="confirmLink"
          />
        </div>
        <div class="tvp-link-form__row tvp-link-form__row--check">
          <NCheckbox v-model:checked="linkNewTab">在新窗口打开</NCheckbox>
        </div>
      </div>
      <template #footer>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <NButton @click="linkDialogVisible = false">取消</NButton>
          <NButton type="primary" @click="confirmLink">确定</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
/*
 * 纯图标按钮:统一为 32×32 正方形击中区(与 EP 版对齐,业界事实标准)。
 * Naive 的 NButton 默认 padding 较大,这里约束纯图标按钮。
 */
.tvp-toolbar .tvp-icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

.tvp-tooltip-trigger {
  display: inline-flex;
  align-items: center;
}

.tvp-toolbar .tvp-select-btn {
  height: 32px;
  min-width: 0;
  padding: 0 4px;
  font-size: 14px;
}

.tvp-toolbar .tvp-select-btn--heading {
  width: 50px;
}

.tvp-toolbar .tvp-select-btn--font,
.tvp-toolbar .tvp-select-btn--size,
.tvp-toolbar .tvp-select-btn--line-height {
  width: 58px;
}

.tvp-select-btn :deep(.n-button__content) {
  min-width: 0;
  gap: 1px;
  overflow: hidden;
  white-space: nowrap;
}

.tvp-toolbar {
  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--n-border-color, #e4e7ed);
  background: var(--n-color, #fff);
  scrollbar-width: thin;
}

@media (min-width: 640px) {
  .tvp-toolbar {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}

.tvp-image-input {
  display: none;
}

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
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 2px;
  cursor: pointer;
  background: var(--n-color, #fff);
  transition: background 0.1s;
}
.tvp-table-grid__cell.is-active {
  background: var(--n-primary-color, #18a058);
  border-color: var(--n-primary-color, #18a058);
}
.tvp-table-grid__label {
  text-align: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--n-text-color-3, #909399);
}

.tvp-code-language-menu {
  display: grid;
  min-width: 168px;
  padding: 4px;
}

.tvp-code-language-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--n-text-color, #303133);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tvp-code-language-menu__item:hover,
.tvp-code-language-menu__item.is-active {
  background: var(--n-fill-color-light, #f5f7fa);
  color: var(--n-primary-color, #18a058);
}

/* 颜色选择器 */
.tvp-color-panel {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 4px;
}
.tvp-color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--n-border-color, #dcdfe6);
  transition: transform 0.1s;
}
.tvp-color-swatch:hover {
  transform: scale(1.1);
}
.tvp-color-swatch.is-active {
  outline: 2px solid var(--n-primary-color, #18a058);
  outline-offset: 1px;
}
.tvp-color-clear {
  grid-column: 1 / -1;
  padding: 4px 8px;
  margin-bottom: 2px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--n-text-color-2, #606266);
  text-align: center;
}
.tvp-color-clear:hover {
  background: var(--n-color-hover, #f5f7fa);
}
.tvp-color-clear.is-active {
  color: var(--n-primary-color, #18a058);
  background: var(--n-color-hover, #ecf5ff);
}
.tvp-color-custom {
  grid-column: 1 / -1;
  margin-top: 4px;
}
.tvp-hex-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  border: 1px solid var(--n-border-color, #dcdfe6);
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  outline: none;
  color: var(--n-text-color-2, #606266);
  background: var(--n-color, #fff);
}
.tvp-hex-input:focus {
  border-color: var(--n-primary-color, #18a058);
}

.tvp-divider {
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--n-border-color, #dcdfe6);
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
  color: var(--n-text-color-2, #606266);
}
.tvp-link-form__row--check {
  padding-left: 46px;
}
</style>
