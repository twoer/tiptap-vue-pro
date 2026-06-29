<script setup lang="ts">
/**
 * Naive UI 适配的工具栏。
 *
 * 功能覆盖:撤销/重做、标题、格式化、文字颜色/背景高亮、
 * 对齐、列表/任务列表/引用/代码块/分割线、链接、图片上传、表格网格、清除格式、
 * 打印、Markdown 导入导出、全屏/预览。
 *
 * 编辑器命令通过 core command registry 分发,消息提示走 ctx.notify(由 ProEditorNaive 注入)。
 *
 * 组件全部使用 Naive UI:
 * - NDropdown 用 options 数据驱动
 * - 颜色色板 / 表格网格用 NPopover + 自绘
 * - 链接弹窗用 NModal
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
import {
  DEFAULT_TOOLBAR,
  codeBlockLanguageLabel,
  exportMarkdownFile,
  getActiveHeadingLevel,
  getActiveTextAlign,
  getCommandLabel,
  importMarkdownFile,
  isToolbarCommandActive,
  normalizeToolbarConfig,
  printEditorContent,
  resolveEditorBehaviorOptions,
  resolveToolbarOptions,
  runToolbarCommand,
  TOOLBAR_ALIGN_OPTIONS,
  TOOLBAR_HEADING_OPTIONS,
  TOOLBAR_HEADING_PREVIEW_STYLES,
  TOOLBAR_MARKDOWN_OPTIONS,
} from 'tiptap-vue-pro-core'
import type {
  CodeBlockLanguage,
  ProEditorContext,
  ToolbarBuiltinKey,
  ToolbarCommandPayload,
  ToolbarConfig,
  ToolbarHeadingLevel,
  ToolbarMarkdownAction,
  ToolbarOptions,
  ToolbarProp,
  ToolbarTextAlign,
  UploadImage,
  EditorBehaviorOptions,
} from 'tiptap-vue-pro-core'

/**
 * Markdown 官方 logo。内联 SVG,暴露 size 属性。
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
    /** 工具栏选项配置。用于覆盖菜单数据、表格网格、Markdown 和打印等预设 */
    toolbarOptions?: ToolbarOptions
    /** 编辑器行为配置。用于覆盖链接、表格、图片等默认行为 */
    editorBehaviorOptions?: EditorBehaviorOptions
  }>(),
  {
    toolbar: undefined,
    toolbarOptions: undefined,
    editorBehaviorOptions: undefined,
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
function commandLabel(id: ToolbarBuiltinKey) {
  return getCommandLabel(id)
}
function commandActive(id: ToolbarBuiltinKey, payload?: ToolbarCommandPayload) {
  return isToolbarCommandActive(ctx.value, id, payload)
}
function runCommand(id: ToolbarBuiltinKey, payload?: ToolbarCommandPayload) {
  runToolbarCommand(ctx.value, id, payload)
}
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

// 隐藏的图片选择 input。
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

// 网络图片:弹窗输入 URL 后用 setImage 插入。
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
  await importMarkdownFile(ctx.value, file)
}

function exportMarkdown() {
  exportMarkdownFile(ctx.value, {
    filename: resolvedToolbarOptions.value.markdown.exportFilename,
  })
}

// ---- 打印 ----(隔离 iframe 打印,避免污染宿主页)
function printContent() {
  printEditorContent(ctx.value.getHTML(), resolvedToolbarOptions.value.print)
}

// ---- 表格网格选择器 ----
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
const currentCodeBlockLabel = computed(
  () =>
    CODE_BLOCK_LANGUAGE_OPTIONS.value.find((language) => language.value === currentCodeBlockLanguage.value)?.label
    ?? codeBlockLanguageLabel(currentCodeBlockLanguage.value),
)
const codeBlockOptions = computed<DropdownOption[]>(() => CODE_BLOCK_LANGUAGE_OPTIONS.value.map((language) => ({
  label: language.label,
  key: language.value,
})))
function renderCodeBlockLabel(opt: DropdownOption) {
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
    h(Code, { size: 15 }),
    opt.label as string,
  ])
}
function onCodeBlockSelect(key: string | number) {
  runCommand('codeBlock', key as CodeBlockLanguage)
}

// ---- 标题级别 dropdown ----
// 当前标题级别(用于 dropdown 显示)
const headingLabel = computed(() => {
  const level = getActiveHeadingLevel(ctx.value)
  return level > 0 ? `H${level}` : '正文'
})

// NDropdown 的 options:用 render-label 渲染不同字号的标题预览
const headingOptions: DropdownOption[] = TOOLBAR_HEADING_OPTIONS.map((heading) => ({
  label: heading.label,
  key: heading.level,
}))
function headingPreviewStyle(level: number | string) {
  return TOOLBAR_HEADING_PREVIEW_STYLES[Number(level) as ToolbarHeadingLevel] ?? TOOLBAR_HEADING_PREVIEW_STYLES[0]
}
function renderHeadingLabel(opt: DropdownOption) {
  const level = opt.key as number
  const style = headingPreviewStyle(level)
  return h('span', { class: `tvp-heading-preview tvp-h${level}`, style }, opt.label as string)
}
function onHeadingSelect(key: string | number) {
  runCommand('heading', key)
}
// ---- 颜色选择器 ----
const resolvedToolbarOptions = computed(() => resolveToolbarOptions(props.toolbarOptions))
const PRESET_COLORS = computed(() => resolvedToolbarOptions.value.colors)
const PRESET_HIGHLIGHTS = computed(() => resolvedToolbarOptions.value.highlights)
const FONT_FAMILIES = computed(() => resolvedToolbarOptions.value.fontFamilies)
const FONT_SIZES = computed(() => resolvedToolbarOptions.value.fontSizes)
const LINE_HEIGHTS = computed(() => resolvedToolbarOptions.value.lineHeights)
const CODE_BLOCK_LANGUAGE_OPTIONS = computed(() => resolvedToolbarOptions.value.codeBlockLanguages)
const TABLE_MAX_ROWS = computed(() => resolvedToolbarOptions.value.tableGrid.maxRows)
const TABLE_MAX_COLS = computed(() => resolvedToolbarOptions.value.tableGrid.maxCols)
const MARKDOWN_IMPORT_ACCEPT = computed(() => resolvedToolbarOptions.value.markdown.importAccept)
const resolvedEditorBehaviorOptions = computed(() => resolveEditorBehaviorOptions(props.editorBehaviorOptions))
const IMAGE_ACCEPT = computed(() => resolvedEditorBehaviorOptions.value.image.accept)
const LINK_DEFAULT_TARGET = computed(() => resolvedEditorBehaviorOptions.value.link.defaultTarget)

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
  runCommand('color', color)
}
function selectHighlight(color: string) {
  runCommand('highlight', color)
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
  return ALIGN_ICONS[getActiveTextAlign(ctx.value)]
})
const alignOptions: DropdownOption[] = TOOLBAR_ALIGN_OPTIONS.map((align) => ({
  label: align.label,
  key: align.value,
}))
function renderAlignLabel(opt: DropdownOption) {
  const map: Record<ToolbarTextAlign, typeof AlignLeft> = {
    left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify,
  }
  const Icon = map[opt.key as ToolbarTextAlign]
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
    h(Icon, { size: 16 }),
    opt.label as string,
  ])
}
function onAlignSelect(key: string | number) {
  runCommand('align', key)
}

const currentFontLabel = computed(
  () => FONT_FAMILIES.value.find((font) => font.value === currentTextStyle.value.fontFamily)?.label ?? '字体',
)
const currentFontSizeLabel = computed(() => currentTextStyle.value.fontSize || '字号')
const currentLineHeightLabel = computed(() => currentTextStyle.value.lineHeight || '行高')

const fontFamilyOptions = computed<DropdownOption[]>(() => FONT_FAMILIES.value.map((font) => ({
  label: font.label,
  key: font.value,
  fontFamily: font.value,
})))
const fontSizeOptions = computed<DropdownOption[]>(() => FONT_SIZES.value.map((size) => ({
  label: size || '默认字号',
  key: size,
})))
const lineHeightOptions = computed<DropdownOption[]>(() => LINE_HEIGHTS.value.map((lineHeight) => ({
  label: lineHeight || '默认行高',
  key: lineHeight,
})))
function renderFontFamilyLabel(opt: DropdownOption) {
  return h('span', { style: { fontFamily: (opt.fontFamily as string) || undefined } }, opt.label as string)
}
function onFontFamilySelect(key: string | number) {
  runCommand('fontFamily', key)
}
function onFontSizeSelect(key: string | number) {
  runCommand('fontSize', key)
}
function onLineHeightSelect(key: string | number) {
  runCommand('lineHeight', key)
}

// ---- Markdown dropdown ----
const mdOptions: DropdownOption[] = TOOLBAR_MARKDOWN_OPTIONS.map((option) => ({
  key: option.value,
  label: option.label,
}))
function renderMdLabel(opt: DropdownOption) {
  const Icon = (opt.key as ToolbarMarkdownAction) === 'import' ? FileUp : FileDown
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
// 打开时保存选区绝对位置,确认时按位置写入(绕开失焦导致的 selection 漂移)。
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
  linkNewTab.value = LINK_DEFAULT_TARGET.value === '_blank'
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
            <NButton text class="tvp-icon-btn" :aria-label="commandLabel('undo')" @click="runCommand('undo')"><Undo2 :size="18" /></NButton>
          </template>
          {{ commandLabel('undo') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'redo'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" :aria-label="commandLabel('redo')" @click="runCommand('redo')"><Redo2 :size="18" /></NButton>
          </template>
          {{ commandLabel('redo') }}
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
                <NButton text class="tvp-select-btn tvp-select-btn--heading" :aria-label="commandLabel('heading')">
                  {{ headingLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('heading') }}
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
                <NButton text class="tvp-select-btn tvp-select-btn--font" :aria-label="commandLabel('fontFamily')">
                  {{ currentFontLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('fontFamily') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'fontSize'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="fontSizeOptions"
                @select="onFontSizeSelect"
              >
                <NButton text class="tvp-select-btn tvp-select-btn--size" :aria-label="commandLabel('fontSize')">
                  {{ currentFontSizeLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('fontSize') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'lineHeight'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="lineHeightOptions"
                @select="onLineHeightSelect"
              >
                <NButton text class="tvp-select-btn tvp-select-btn--line-height" :aria-label="commandLabel('lineHeight')">
                  {{ currentLineHeightLabel }}
                  <ChevronDown :size="14" class="tvp-caret" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('lineHeight') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'bold'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('bold')"
              :type="commandActive('bold') ? 'primary' : 'default'"
              @click="runCommand('bold')"
            ><Bold :size="18" /></NButton>
          </template>
          {{ commandLabel('bold') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'italic'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('italic')"
              :type="commandActive('italic') ? 'primary' : 'default'"
              @click="runCommand('italic')"
            ><Italic :size="18" /></NButton>
          </template>
          {{ commandLabel('italic') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'strike'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('strike')"
              :type="commandActive('strike') ? 'primary' : 'default'"
              @click="runCommand('strike')"
            ><Strikethrough :size="18" /></NButton>
          </template>
          {{ commandLabel('strike') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'underline'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('underline')"
              :type="commandActive('underline') ? 'primary' : 'default'"
              @click="runCommand('underline')"
            ><Underline :size="18" /></NButton>
          </template>
          {{ commandLabel('underline') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'code'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('code')"
              :type="commandActive('code') ? 'primary' : 'default'"
              @click="runCommand('code')"
            ><Code :size="18" /></NButton>
          </template>
          {{ commandLabel('code') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'superscript'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('superscript')"
              :type="commandActive('superscript') ? 'primary' : 'default'"
              @click="runCommand('superscript')"
            ><Superscript :size="18" /></NButton>
          </template>
          {{ commandLabel('superscript') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'subscript'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('subscript')"
              :type="commandActive('subscript') ? 'primary' : 'default'"
              @click="runCommand('subscript')"
            ><Subscript :size="18" /></NButton>
          </template>
          {{ commandLabel('subscript') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'color'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NPopover trigger="click" placement="bottom" :width="260">
                <template #trigger>
                  <NButton text class="tvp-icon-btn" :aria-label="commandLabel('color')">
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
          {{ commandLabel('color') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'highlight'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NPopover trigger="click" placement="bottom" :width="260">
                <template #trigger>
                  <NButton text class="tvp-icon-btn" :aria-label="commandLabel('highlight')">
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
          {{ commandLabel('highlight') }}
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
                <NButton text class="tvp-icon-btn" :aria-label="commandLabel('align')">
                  <component :is="alignIcon" :size="16" />
                </NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('align') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'decreaseIndent'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('decreaseIndent')"
              @click="runCommand('decreaseIndent')"
            ><IndentDecrease :size="18" /></NButton>
          </template>
          {{ commandLabel('decreaseIndent') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'increaseIndent'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('increaseIndent')"
              @click="runCommand('increaseIndent')"
            ><IndentIncrease :size="18" /></NButton>
          </template>
          {{ commandLabel('increaseIndent') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'bulletList'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('bulletList')"
              :type="commandActive('bulletList') ? 'primary' : 'default'"
              @click="runCommand('bulletList')"
            ><List :size="18" /></NButton>
          </template>
          {{ commandLabel('bulletList') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'orderedList'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('orderedList')"
              :type="commandActive('orderedList') ? 'primary' : 'default'"
              @click="runCommand('orderedList')"
            ><ListOrdered :size="18" /></NButton>
          </template>
          {{ commandLabel('orderedList') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'taskList'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('taskList')"
              :type="commandActive('taskList') ? 'primary' : 'default'"
              @click="runCommand('taskList')"
            ><ListChecks :size="18" /></NButton>
          </template>
          {{ commandLabel('taskList') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'blockquote'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('blockquote')"
              :type="commandActive('blockquote') ? 'primary' : 'default'"
              @click="runCommand('blockquote')"
            ><Quote :size="18" /></NButton>
          </template>
          {{ commandLabel('blockquote') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'codeBlock'" placement="top" :show-arrow="false">
          <template #trigger>
            <span class="tvp-tooltip-trigger">
              <NDropdown
                trigger="click"
                :options="codeBlockOptions"
                :render-label="renderCodeBlockLabel"
                @select="onCodeBlockSelect"
              >
                <NButton
                  text
                  class="tvp-icon-btn"
                  :aria-label="commandLabel('codeBlock')"
                  :type="commandActive('codeBlock') ? 'primary' : 'default'"
                ><Code :size="18" /></NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('codeBlock') }}: {{ currentCodeBlockLabel }}
        </NTooltip>

        <NTooltip v-else-if="item === 'hr'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" :aria-label="commandLabel('hr')" @click="runCommand('hr')"><Minus :size="18" /></NButton>
          </template>
          {{ commandLabel('hr') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'link'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('link')"
              :type="ctx.isActive('link') ? 'primary' : 'default'"
              @click="openLinkDialog"
            ><Link :size="18" /></NButton>
          </template>
          {{ commandLabel('link') }}
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
                  <NButton text class="tvp-icon-btn" :aria-label="commandLabel('table')"><Table :size="18" /></NButton>
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
          {{ commandLabel('table') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'clearFormat'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" :aria-label="commandLabel('clearFormat')" @click="runCommand('clearFormat')"><Eraser :size="18" /></NButton>
          </template>
          {{ commandLabel('clearFormat') }}
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
                <NButton text class="tvp-icon-btn" :aria-label="commandLabel('markdown')"><MarkdownIcon :size="18" /></NButton>
              </NDropdown>
            </span>
          </template>
          {{ commandLabel('markdown') }}
        </NTooltip>

        <NTooltip v-else-if="item === 'print'" placement="top" :show-arrow="false">
          <template #trigger>
            <NButton text class="tvp-icon-btn" :aria-label="commandLabel('print')" @click="printContent"><Printer :size="18" /></NButton>
          </template>
          {{ commandLabel('print') }}
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
      :accept="IMAGE_ACCEPT"
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
      :accept="MARKDOWN_IMPORT_ACCEPT"
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
 * 纯图标按钮:统一为 32×32 正方形击中区。
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

.tvp-toolbar .tvp-select-btn--size,
.tvp-toolbar .tvp-select-btn--line-height {
  width: 58px;
}

.tvp-toolbar .tvp-select-btn--font {
  width: 86px;
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
