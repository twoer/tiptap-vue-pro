<script setup lang="ts">
import { computed, ref, h, defineComponent, markRaw } from 'vue'
import { ElButton, ElTooltip, ElDropdown, ElDropdownMenu, ElDropdownItem, ElDialog, ElInput, ElCheckbox } from 'element-plus'
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
 * - 编辑器命令通过 core command registry 分发
 * - 标题用 dropdown(多级),其余用 button
 *
 * active 响应性:依赖 ctx.isActive,工具栏组件本身在 EditorContent
 * 的父组件里会随 selectionUpdate 重渲染(通过 :key 或 watch 触发)。
 */
const props = withDefaults(
  defineProps<{
    ctx: ProEditorContext & { prepareInsert?: () => void }
    /** 图片上传函数。传入则显示「上传图片」按钮 */
    uploadImage?: UploadImage
    /** 是否全屏(控制全屏图标切换) */
    isFullscreen?: boolean
    /** 是否预览态(控制预览图标切换) */
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
  await importMarkdownFile(ctx.value, file)
}

function exportMarkdown() {
  exportMarkdownFile(ctx.value, {
    filename: resolvedToolbarOptions.value.markdown.exportFilename,
  })
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
  printEditorContent(ctx.value.getHTML(), resolvedToolbarOptions.value.print)
}

// ---- 表格网格选择器 ----
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
const currentCodeBlockLabel = computed(
  () =>
    CODE_BLOCK_LANGUAGE_OPTIONS.value.find((language) => language.value === currentCodeBlockLanguage.value)?.label
    ?? codeBlockLanguageLabel(currentCodeBlockLanguage.value),
)
function onCodeBlockLanguage(language: string) {
  runCommand('codeBlock', language as CodeBlockLanguage)
}

// 当前标题级别(用于 dropdown 显示)
const headingLabel = computed(() => {
  const level = getActiveHeadingLevel(ctx.value)
  return level > 0 ? `H${level}` : '正文'
})

// 标题 dropdown 命令
function onHeading(level: number) {
  runCommand('heading', level)
}
function headingPreviewClass(level: ToolbarHeadingLevel) {
  return level === 0 ? 'tvp-heading-preview' : `tvp-heading-preview tvp-h${level}`
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

// 当前文字色(从选区的 textStyle mark 读取)
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
// 当前高亮色
const currentHighlight = computed(
  () => (ctx.value.editor.value?.getAttributes('highlight') as { color?: string })?.color ?? '',
)

function selectColor(color: string) {
  runCommand('color', color)
}
function selectHighlight(color: string) {
  runCommand('highlight', color)
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
  return ALIGN_ICONS[getActiveTextAlign(ctx.value)]
})
function onAlign(align: string) {
  runCommand('align', align)
}
function alignOptionIcon(align: ToolbarTextAlign) {
  return ALIGN_ICONS[align]
}
function markdownOptionIcon(action: ToolbarMarkdownAction) {
  return action === 'import' ? FileUp : FileDown
}

const currentFontLabel = computed(
  () => FONT_FAMILIES.value.find((font) => font.value === currentTextStyle.value.fontFamily)?.label ?? '字体',
)
const currentFontSizeLabel = computed(() => currentTextStyle.value.fontSize || '字号')
const currentLineHeightLabel = computed(() => currentTextStyle.value.lineHeight || '行高')

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
        <ElTooltip v-if="item === 'undo'" :content="commandLabel('undo')" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('undo')" @click="runCommand('undo')"><Undo2 :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'redo'" :content="commandLabel('redo')" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('redo')" @click="runCommand('redo')"><Redo2 :size="18" /></ElButton>
        </ElTooltip>

        <ElDropdown v-else-if="item === 'heading'" trigger="click" @command="onHeading">
          <ElButton text :aria-label="commandLabel('heading')">
            {{ headingLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="heading in TOOLBAR_HEADING_OPTIONS"
                :key="heading.level"
                :command="heading.level"
              >
                <span :class="headingPreviewClass(heading.level)">{{ heading.label }}</span>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>

        <ElDropdown v-else-if="item === 'fontFamily'" trigger="click" @command="(value: string) => runCommand('fontFamily', value)">
          <ElButton text :aria-label="commandLabel('fontFamily')">
            {{ currentFontLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="font in FONT_FAMILIES"
                :key="font.label"
                :command="font.value"
              >
                <span class="tvp-menu-check">{{ currentTextStyle.fontFamily === font.value ? '✓' : '' }}</span>
                <span :style="{ fontFamily: font.value || undefined }">{{ font.label }}</span>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>

        <ElDropdown v-else-if="item === 'fontSize'" trigger="click" @command="(value: string) => runCommand('fontSize', value)">
          <ElButton text :aria-label="commandLabel('fontSize')">
            {{ currentFontSizeLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="size in FONT_SIZES"
                :key="size || 'default-size'"
                :command="size"
              >
                {{ size || '默认字号' }}
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>

        <ElDropdown v-else-if="item === 'lineHeight'" trigger="click" @command="(value: string) => runCommand('lineHeight', value)">
          <ElButton text :aria-label="commandLabel('lineHeight')">
            {{ currentLineHeightLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="lineHeight in LINE_HEIGHTS"
                :key="lineHeight || 'default-line-height'"
                :command="lineHeight"
              >
                {{ lineHeight || '默认行高' }}
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>

        <ElTooltip v-else-if="item === 'bold'" :content="commandLabel('bold')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('bold')"
            :type="commandActive('bold') ? 'primary' : 'default'"
            @click="runCommand('bold')"
          ><Bold :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'italic'" :content="commandLabel('italic')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('italic')"
            :type="commandActive('italic') ? 'primary' : 'default'"
            @click="runCommand('italic')"
          ><Italic :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'strike'" :content="commandLabel('strike')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('strike')"
            :type="commandActive('strike') ? 'primary' : 'default'"
            @click="runCommand('strike')"
          ><Strikethrough :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'underline'" :content="commandLabel('underline')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('underline')"
            :type="commandActive('underline') ? 'primary' : 'default'"
            @click="runCommand('underline')"
          ><Underline :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'code'" :content="commandLabel('code')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('code')"
            :type="commandActive('code') ? 'primary' : 'default'"
            @click="runCommand('code')"
          ><Code :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'superscript'" :content="commandLabel('superscript')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('superscript')"
            :type="commandActive('superscript') ? 'primary' : 'default'"
            @click="runCommand('superscript')"
          ><Superscript :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'subscript'" :content="commandLabel('subscript')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('subscript')"
            :type="commandActive('subscript') ? 'primary' : 'default'"
            @click="runCommand('subscript')"
          ><Subscript :size="18" /></ElButton>
        </ElTooltip>

        <ElDropdown v-else-if="item === 'color'" trigger="click">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('color')">
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

        <ElDropdown v-else-if="item === 'highlight'" trigger="click">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('highlight')">
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

        <ElDropdown v-else-if="item === 'align'" trigger="click" @command="onAlign">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('align')">
            <component :is="alignIcon" :size="16" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="align in TOOLBAR_ALIGN_OPTIONS"
                :key="align.value"
                :command="align.value"
              >
                <span class="tvp-menu-item">
                  <component :is="alignOptionIcon(align.value)" :size="16" />{{ align.label }}
                </span>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>

        <ElTooltip v-else-if="item === 'decreaseIndent'" :content="commandLabel('decreaseIndent')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('decreaseIndent')"
            @click="runCommand('decreaseIndent')"
          ><IndentDecrease :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'increaseIndent'" :content="commandLabel('increaseIndent')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('increaseIndent')"
            @click="runCommand('increaseIndent')"
          ><IndentIncrease :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'bulletList'" :content="commandLabel('bulletList')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('bulletList')"
            :type="commandActive('bulletList') ? 'primary' : 'default'"
            @click="runCommand('bulletList')"
          ><List :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'orderedList'" :content="commandLabel('orderedList')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('orderedList')"
            :type="commandActive('orderedList') ? 'primary' : 'default'"
            @click="runCommand('orderedList')"
          ><ListOrdered :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'taskList'" :content="commandLabel('taskList')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('taskList')"
            :type="commandActive('taskList') ? 'primary' : 'default'"
            @click="runCommand('taskList')"
          ><ListChecks :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'blockquote'" :content="commandLabel('blockquote')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('blockquote')"
            :type="commandActive('blockquote') ? 'primary' : 'default'"
            @click="runCommand('blockquote')"
          ><Quote :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'codeBlock'" :content="`${commandLabel('codeBlock')}:${currentCodeBlockLabel}`" placement="top" :show-after="300">
          <ElDropdown trigger="click" @command="onCodeBlockLanguage">
            <ElButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('codeBlock')"
              :type="commandActive('codeBlock') ? 'primary' : 'default'"
            ><Code :size="18" /></ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem
                  v-for="language in CODE_BLOCK_LANGUAGE_OPTIONS"
                  :key="language.value"
                  :command="language.value"
                >
                  <span class="tvp-menu-item"><Code :size="15" />{{ language.label }}</span>
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'hr'" :content="commandLabel('hr')" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('hr')" @click="runCommand('hr')"><Minus :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'link'" :content="commandLabel('link')" placement="top" :show-after="300">
          <ElButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('link')"
            :type="ctx.isActive('link') ? 'primary' : 'default'"
            @click="openLinkDialog"
          ><Link :size="18" /></ElButton>
        </ElTooltip>

        <template v-else-if="item === 'image'">
          <ElTooltip v-if="uploadImage" content="上传图片" placement="top" :show-after="300">
            <ElButton text class="tvp-icon-btn" aria-label="上传图片" @click="triggerImageUpload"><ImagePlus :size="18" /></ElButton>
          </ElTooltip>
          <ElTooltip content="网络图片" placement="top" :show-after="300">
            <ElButton text class="tvp-icon-btn" aria-label="网络图片" @click="openUrlDialog"><Link2 :size="18" /></ElButton>
          </ElTooltip>
        </template>

        <ElTooltip v-else-if="item === 'table'" :content="commandLabel('table')" placement="top" :show-after="300">
          <ElDropdown ref="tableDropdown" trigger="click" @command="onTableInsert">
            <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('table')"><Table :size="18" /></ElButton>
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

        <ElTooltip v-else-if="item === 'clearFormat'" :content="commandLabel('clearFormat')" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('clearFormat')" @click="runCommand('clearFormat')"><Eraser :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'markdown'" :content="commandLabel('markdown')" placement="top" :show-after="300">
          <ElDropdown trigger="click" @command="onMarkdownCommand">
            <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('markdown')"><MarkdownIcon :size="18" /></ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem
                  v-for="option in TOOLBAR_MARKDOWN_OPTIONS"
                  :key="option.value"
                  :command="option.value"
                >
                  <span class="tvp-menu-item">
                    <component :is="markdownOptionIcon(option.value)" :size="15" />{{ option.label }}
                  </span>
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'print'" :content="commandLabel('print')" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="commandLabel('print')" @click="printContent"><Printer :size="18" /></ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'fullscreen'" :content="isFullscreen ? '退出全屏' : '全屏'" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
            <component :is="isFullscreen ? Minimize2 : Maximize2" :size="18" />
          </ElButton>
        </ElTooltip>

        <ElTooltip v-else-if="item === 'preview'" :content="isPreview ? '编辑' : '预览'" placement="top" :show-after="300">
          <ElButton text class="tvp-icon-btn" :aria-label="isPreview ? '编辑' : '预览'" @click="togglePreview">
            <component :is="isPreview ? Pencil : Eye" :size="18" />
          </ElButton>
        </ElTooltip>
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

    <input
      ref="mdInput"
      type="file"
      :accept="MARKDOWN_IMPORT_ACCEPT"
      class="tvp-image-input"
      @change="onMdSelected"
    />

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
  width: 100%;
  max-width: 100%;
  min-width: 0;
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

.tvp-menu-check {
  display: inline-block;
  width: 14px;
  color: var(--el-color-primary, #409eff);
}

.tvp-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
