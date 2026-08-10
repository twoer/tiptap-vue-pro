<script setup lang="ts">
import { computed, ref, h, defineComponent, markRaw, type Component } from 'vue'
import { AntButton, AntTooltip, AntDropdown, AntDropdownMenu, AntDropdownItem, AntModal, AntInput, AntCheckbox, AntSlider } from './antDesignPrimitives'
import {
  Undo2, Redo2, ChevronDown,
  Bold, Italic, Strikethrough, Underline,
  Superscript, Subscript,
  Type, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentDecrease, IndentIncrease,
  List, ListOrdered, ListChecks,
  Quote, Code, Minus,
  Link, ImagePlus, Link2, Table, Workflow,
  Video, File,
  FileDown, FileUp,
  Eraser, Search, Printer,
  Maximize2, Minimize2, Eye, Pencil,
  Plus, Ellipsis,
} from 'lucide-vue-next'
import {
  DEFAULT_TOOLBAR,
  codeBlockLanguageIcon,
  codeBlockLanguageLabel,
  getActiveHeadingLevel,
  getActiveTextAlign,
  getCommandLabel,
  isToolbarCommandActive,
  normalizeToolbarConfig,
  resolveToolbarLayout,
  resolveToolbarCompactActions,
  resolveLocale,
  resolveEditorBehaviorOptions,
  resolveToolbarOptions,
  runToolbarCommand,
  useImageCropController,
  useToolbarDocumentActions,
  useToolbarImageUrlController,
  useToolbarLinkController,
  useToolbarResourceInputs,
  TOOLBAR_ALIGN_OPTIONS,
  TOOLBAR_HEADING_OPTIONS,
  TOOLBAR_MARKDOWN_OPTIONS,
} from 'tiptap-vue-pro-core'
import type {
  CodeBlockLanguage,
  HorizontalRuleVariant,
  ProEditorContext,
  ToolbarBuiltinKey,
  ToolbarCompactMenuId,
  ToolbarCommandPayload,
  ToolbarConfig,
  ToolbarLayoutMode,
  ToolbarHeadingLevel,
  ToolbarHorizontalRuleOption,
  ToolbarMarkdownAction,
  ToolbarOptions,
  ToolbarProp,
  ToolbarTextAlign,
  UploadAsset,
  UploadImage,
  EditorBehaviorOptions,
  LocaleKey,
  ProEditorDebugLogFn,
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
 * 渲染成 Ant Design Vue 按钮组。
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
    /** 视频、音频、文件上传函数。传入则显示「上传」菜单 */
    uploadAsset?: UploadAsset
    /** 是否全屏(控制全屏图标切换) */
    isFullscreen?: boolean
    /** 是否预览态(控制预览图标切换) */
    isPreview?: boolean
    /** 是否使用暗色菜单主题 */
    dark?: boolean
    /** 工具栏配置。false 表示不渲染内置按钮 */
    toolbar?: ToolbarProp
    /** 工具栏布局模式 */
    toolbarLayout?: ToolbarLayoutMode
    /** 工具栏选项配置。用于覆盖菜单数据、表格网格、Markdown 和打印等预设 */
    toolbarOptions?: ToolbarOptions
    /** 编辑器行为配置。用于覆盖链接、表格、图片等默认行为 */
    editorBehaviorOptions?: EditorBehaviorOptions
    /** adapter 层开发者诊断日志 */
    debugLog?: ProEditorDebugLogFn
  }>(),
  {
    toolbar: undefined,
    toolbarLayout: 'classic',
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
const fallbackT = resolveLocale().t
function t(key: LocaleKey, paramsOrFallback?: Record<string, string | number> | string) {
  return ctx.value.t?.(key, paramsOrFallback) ?? fallbackT(key, paramsOrFallback)
}
function commandLabel(id: ToolbarBuiltinKey) {
  return t(`command.${id}` as LocaleKey, getCommandLabel(id))
}
function commandActive(id: ToolbarBuiltinKey, payload?: ToolbarCommandPayload) {
  return isToolbarCommandActive(ctx.value, id, payload)
}
function runCommand(id: ToolbarBuiltinKey, payload?: ToolbarCommandPayload) {
  props.debugLog?.('adapter', 'toolbar-click', { command: id })
  runToolbarCommand(ctx.value, id, payload)
}
const FALLBACK_TOOLBAR: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'strike', 'code', 'superscript', 'subscript'],
  ['color', 'highlight', 'clearFormat'],
  ['align', 'decreaseIndent', 'increaseIndent'],
  ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'],
  ['link', 'image', 'attachment', 'table', 'mermaid', 'hr'],
  ['findReplace', 'markdown', 'print'],
  ['preview', 'fullscreen'],
]
const normalizedToolbar = computed(() => {
  if (props.toolbar === false) return []
  const source = props.toolbar ?? (DEFAULT_TOOLBAR.length > 0 ? DEFAULT_TOOLBAR : FALLBACK_TOOLBAR)
  const normalized = normalizeToolbarConfig(source)
  return normalized.length > 0 || source.length === 0
    ? normalized
    : source.map((group) => [...group])
})
const toolbarLayout = computed(() => resolveToolbarLayout(normalizedToolbar.value, props.toolbarLayout))
const toolbarGroups = computed(() => toolbarLayout.value.groups)
const compactMenus = computed(() => toolbarLayout.value.menus)
const compactTrailing = computed(() => toolbarLayout.value.trailing)

/**
 * 插入类操作前的预处理:若编辑器从未获得焦点(用户没点进去过),
 * 先把光标定位到文档末尾,避免内容插到开头用户看不到。
 */
function prepareInsert() {
  ctx.value.prepareInsert?.()
}

const {
  visible: imageCropVisible,
  objectUrl: imageCropUrl,
  preview: imageCropPreview,
  image: imageCropImg,
  zoom: imageCropZoom,
  imageStyle: imageCropImageStyle,
  openQueue: openImageCropQueue,
  cancel: cancelImageCrop,
  clampPan: clampImageCropPan,
  onPointerDown: onImageCropPointerDown,
  onPointerMove: onImageCropPointerMove,
  onPointerUp: onImageCropPointerUp,
  confirm: confirmImageCrop,
  skip: skipImageCrop,
} = useImageCropController({
  getCropOptions: () => IMAGE_CROP.value,
  uploadImage: (file) => ctx.value.commands.uploadAndInsertImage(file),
  notifyCropFailed: () => ctx.value.notify(t('notify.imageCropFailed'), 'warning'),
  debugLog: (...args) => props.debugLog?.(...args),
})

const {
  imageInput,
  videoInput,
  fileInput,
  triggerImageUpload,
  triggerVideoUpload,
  triggerFileUpload,
  onImageSelected,
  onVideoSelected,
  onFileSelected,
} = useToolbarResourceInputs({
  prepareInsert,
  getImageMultiple: () => IMAGE_MULTIPLE.value,
  getVideoMultiple: () => VIDEO_MULTIPLE.value,
  getFileMultiple: () => FILE_MULTIPLE.value,
  isImageCropEnabled: () => IMAGE_CROP.value.enabled,
  openImageCrop: openImageCropQueue,
  uploadImage: (file) => ctx.value.commands.uploadAndInsertImage(file),
  uploadVideo: (file) => ctx.value.commands.uploadAndInsertVideo(file),
  uploadFile: (file) => ctx.value.commands.uploadAndInsertFile(file),
})

function onAttachmentCommand(command: string | number | object) {
  props.debugLog?.('adapter', 'dropdown-command', { menu: 'attachment', command })
  if (command === 'video') triggerVideoUpload()
  else if (command === 'file') triggerFileUpload()
}

const {
  visible: urlDialogVisible,
  url: imageUrl,
  open: openUrlDialog,
  confirm: confirmUrlImage,
} = useToolbarImageUrlController({
  getContext: () => ctx.value,
  prepareInsert,
  debugLog: (...args) => props.debugLog?.(...args),
})

function onImageCommand(command: string | number | object) {
  props.debugLog?.('adapter', 'dropdown-command', { menu: 'image', command })
  if (command === 'upload') triggerImageUpload()
  else if (command === 'url') openUrlDialog()
}

const {
  markdownInput: mdInput,
  onMarkdownSelected: onMdSelected,
  runMarkdownAction: onMarkdownCommand,
  printContent,
} = useToolbarDocumentActions({
  getContext: () => ctx.value,
  getToolbarOptions: () => resolvedToolbarOptions.value,
})

// ---- 表格网格选择器 ----
const tableHover = ref({ rows: 1, cols: 1 })
const tableDropdownVisible = ref(false)
function resetTableHover() {
  tableHover.value = { rows: 1, cols: 1 }
}
// AntDropdown 的 @command 占位:网格点击走 cell 的 @click,这里不做 command 路由
function onTableInsert(_cmd?: unknown) {
  void _cmd
  prepareInsert()
  ctx.value.commands.insertTable(tableHover.value.rows, tableHover.value.cols)
  tableDropdownVisible.value = false
  resetTableHover()
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

function horizontalRuleLabel(option: ToolbarHorizontalRuleOption) {
  return t(`toolbar.hr.${option.value}` as LocaleKey, option.label)
}

function onHorizontalRule(variant: string) {
  prepareInsert()
  runCommand('hr', variant as HorizontalRuleVariant)
}

// 当前标题级别(用于 dropdown 显示)
const headingLabel = computed(() => {
  const level = getActiveHeadingLevel(ctx.value)
  return level > 0 ? `H${level}` : t('toolbar.heading.body')
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
const FONT_FAMILIES = computed(() =>
  resolvedToolbarOptions.value.fontFamilies.map((font) =>
    font.value === ''
      ? { ...font, label: t('toolbar.fontFamily.default') }
      : font,
  ),
)
const FONT_SIZES = computed(() => resolvedToolbarOptions.value.fontSizes)
const LINE_HEIGHTS = computed(() => resolvedToolbarOptions.value.lineHeights)
const CODE_BLOCK_LANGUAGE_OPTIONS = computed(() => resolvedToolbarOptions.value.codeBlockLanguages)
const CODE_BLOCK_LANGUAGE_MENU_OPTIONS = computed(() => CODE_BLOCK_LANGUAGE_OPTIONS.value.map((language) => ({
  ...language,
  icon: codeBlockLanguageIcon(language.value),
})))
const HORIZONTAL_RULE_OPTIONS = computed(() => resolvedToolbarOptions.value.horizontalRules)
const TABLE_MAX_ROWS = computed(() => resolvedToolbarOptions.value.tableGrid.maxRows)
const TABLE_MAX_COLS = computed(() => resolvedToolbarOptions.value.tableGrid.maxCols)
const MARKDOWN_IMPORT_ACCEPT = computed(() => resolvedToolbarOptions.value.markdown.importAccept)
const resolvedEditorBehaviorOptions = computed(() => resolveEditorBehaviorOptions(props.editorBehaviorOptions))
const IMAGE_ACCEPT = computed(() => resolvedEditorBehaviorOptions.value.image.accept)
const IMAGE_MULTIPLE = computed(() => resolvedEditorBehaviorOptions.value.image.multiple)
const IMAGE_ALLOW_URL = computed(() => resolvedEditorBehaviorOptions.value.image.allowUrl)
const IMAGE_CROP = computed(() => resolvedEditorBehaviorOptions.value.image.crop)
const HAS_IMAGE_UPLOAD = computed(() => Boolean(props.uploadImage))
const SHOW_IMAGE_BUTTON = computed(() => HAS_IMAGE_UPLOAD.value || IMAGE_ALLOW_URL.value)
const SHOW_IMAGE_DROPDOWN = computed(() => HAS_IMAGE_UPLOAD.value && IMAGE_ALLOW_URL.value)
const VIDEO_ACCEPT = computed(() => resolvedEditorBehaviorOptions.value.media.video.accept)
const VIDEO_MULTIPLE = computed(() => resolvedEditorBehaviorOptions.value.media.video.multiple)
const FILE_ACCEPT = computed(() => resolvedEditorBehaviorOptions.value.media.file.accept)
const FILE_MULTIPLE = computed(() => resolvedEditorBehaviorOptions.value.media.file.multiple)
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
const HEADING_OPTIONS = computed(() =>
  TOOLBAR_HEADING_OPTIONS.map((heading) => ({
    ...heading,
    label: heading.level === 0
      ? t('toolbar.heading.body')
      : t('toolbar.heading.level', { level: heading.level }),
  })),
)
const ALIGN_OPTIONS = computed(() =>
  TOOLBAR_ALIGN_OPTIONS.map((align) => ({
    ...align,
    label: t(`toolbar.align.${align.value}` as LocaleKey),
  })),
)
const MARKDOWN_OPTIONS = computed(() =>
  TOOLBAR_MARKDOWN_OPTIONS.map((option) => ({
    ...option,
    label: t(`toolbar.markdown.${option.value}` as LocaleKey),
  })),
)

interface CompactMenuAction {
  key: string
  item: ToolbarBuiltinKey
  label: string
  icon: Component
}

function compactMenuLabel(id: ToolbarCompactMenuId) {
  return t(`toolbar.compact.${id}` as LocaleKey)
}

function compactMenuIcon(id: ToolbarCompactMenuId): Component {
  if (id === 'format') return Type
  if (id === 'list') return List
  if (id === 'insert') return Plus
  return Ellipsis
}

function compactItemIcon(item: ToolbarBuiltinKey): Component {
  const icons: Partial<Record<ToolbarBuiltinKey, Component>> = {
    strike: Strikethrough,
    code: Code,
    superscript: Superscript,
    subscript: Subscript,
    clearFormat: Eraser,
    decreaseIndent: IndentDecrease,
    increaseIndent: IndentIncrease,
    bulletList: List,
    orderedList: ListOrdered,
    taskList: ListChecks,
    blockquote: Quote,
    image: ImagePlus,
    attachment: File,
    mermaid: Workflow,
    hr: Minus,
    findReplace: Search,
    markdown: MarkdownIcon,
    print: Printer,
  }
  return icons[item] ?? Ellipsis
}

function compactMenuActions(items: ToolbarBuiltinKey[]): CompactMenuAction[] {
  return resolveToolbarCompactActions(items, {
    hasImageUpload: HAS_IMAGE_UPLOAD.value,
    allowImageUrl: IMAGE_ALLOW_URL.value,
    hasAssetUpload: Boolean(props.uploadAsset),
    horizontalRules: HORIZONTAL_RULE_OPTIONS.value,
    markdown: TOOLBAR_MARKDOWN_OPTIONS,
  }).map((action) => {
    if (action.item === 'image') {
      return {
        ...action,
        label: t(action.payload === 'upload' ? 'toolbar.image.upload' : 'toolbar.image.url'),
        icon: action.payload === 'upload' ? ImagePlus : Link2,
      }
    }
    if (action.item === 'attachment') {
      return {
        ...action,
        label: t(action.payload === 'video' ? 'toolbar.attachment.video' : 'toolbar.attachment.file'),
        icon: action.payload === 'video' ? Video : File,
      }
    }
    if (action.item === 'hr') {
      const option = HORIZONTAL_RULE_OPTIONS.value.find(({ value }) => value === action.payload)
      return { ...action, label: `${commandLabel('hr')} · ${option ? horizontalRuleLabel(option) : action.payload}`, icon: Minus }
    }
    if (action.item === 'markdown') {
      const markdownAction = action.payload as ToolbarMarkdownAction
      return { ...action, label: t(`toolbar.markdown.${markdownAction}` as LocaleKey), icon: markdownOptionIcon(markdownAction) }
    }
    return { ...action, label: commandLabel(action.item), icon: compactItemIcon(action.item) }
  })
}
const visibleCompactMenus = computed(() =>
  compactMenus.value.filter((menu) => compactMenuActions(menu.items).length > 0),
)

function onCompactMenuCommand(command: string | number | object) {
  const [item, payload] = String(command).split(':') as [ToolbarBuiltinKey, string | undefined]
  if (item === 'image') return onImageCommand(payload ?? '')
  if (item === 'attachment') return onAttachmentCommand(payload ?? '')
  if (item === 'hr') return onHorizontalRule(payload ?? 'solid')
  if (item === 'markdown') return onMarkdownCommand(payload as ToolbarMarkdownAction)
  if (item === 'mermaid') prepareInsert()
  runCommand(item)
}

const currentFontLabel = computed(
  () => FONT_FAMILIES.value.find((font) => font.value === currentTextStyle.value.fontFamily)?.label ?? commandLabel('fontFamily'),
)
const currentFontSizeLabel = computed(() => currentTextStyle.value.fontSize || commandLabel('fontSize'))
const currentLineHeightLabel = computed(() => currentTextStyle.value.lineHeight || commandLabel('lineHeight'))

const {
  visible: linkDialogVisible,
  url: linkUrl,
  text: linkText,
  newTab: linkNewTab,
  open: openLinkDialog,
  confirm: confirmLink,
  cancel: cancelLink,
} = useToolbarLinkController({
  getContext: () => ctx.value,
  prepareInsert,
  getDefaultTarget: () => LINK_DEFAULT_TARGET.value,
  debugLog: (...args) => props.debugLog?.(...args),
})
</script>

<template>
  <div class="tvp-toolbar" :class="`is-${toolbarLayout.mode}`">
    <slot
      name="before"
      :ctx="ctx"
      :is-fullscreen="isFullscreen"
      :is-preview="isPreview"
      :toggle-fullscreen="toggleFullscreen"
      :toggle-preview="togglePreview"
    />

    <span
      v-for="(group, groupIndex) in toolbarGroups"
      :key="groupIndex"
      class="tvp-toolbar-section"
    >
      <span v-if="groupIndex > 0" class="tvp-divider" />
      <span class="tvp-toolbar-group">
        <template v-for="item in group" :key="item">
        <AntTooltip v-if="item === 'undo'" :content="commandLabel('undo')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('undo')" @click="runCommand('undo')"><Undo2 :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'redo'" :content="commandLabel('redo')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('redo')" @click="runCommand('redo')"><Redo2 :size="16" /></AntButton>
        </AntTooltip>

        <AntDropdown v-else-if="item === 'heading'" trigger="click" @command="onHeading">
          <AntButton text class="tvp-select-btn tvp-select-btn--heading" :aria-label="commandLabel('heading')">
            {{ headingLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </AntButton>
          <template #dropdown>
            <AntDropdownMenu>
              <AntDropdownItem
                v-for="heading in HEADING_OPTIONS"
                :key="heading.level"
                :command="heading.level"
              >
                <span :class="headingPreviewClass(heading.level)">{{ heading.label }}</span>
              </AntDropdownItem>
            </AntDropdownMenu>
          </template>
        </AntDropdown>

        <AntDropdown v-else-if="item === 'fontFamily'" trigger="click" @command="(value: string) => runCommand('fontFamily', value)">
          <AntButton text :aria-label="commandLabel('fontFamily')">
            {{ currentFontLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </AntButton>
          <template #dropdown>
            <AntDropdownMenu>
              <AntDropdownItem
                v-for="font in FONT_FAMILIES"
                :key="font.label"
                :command="font.value"
              >
                <span class="tvp-menu-item">
                  <span class="tvp-menu-check">{{ currentTextStyle.fontFamily === font.value ? '✓' : '' }}</span>
                  <span :style="{ fontFamily: font.value || undefined }">{{ font.label }}</span>
                </span>
              </AntDropdownItem>
            </AntDropdownMenu>
          </template>
        </AntDropdown>

        <AntDropdown v-else-if="item === 'fontSize'" trigger="click" @command="(value: string) => runCommand('fontSize', value)">
          <AntButton text :aria-label="commandLabel('fontSize')">
            {{ currentFontSizeLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </AntButton>
          <template #dropdown>
            <AntDropdownMenu>
              <AntDropdownItem
                v-for="size in FONT_SIZES"
                :key="size || 'default-size'"
                :command="size"
              >
                {{ size || t('toolbar.fontSize.default') }}
              </AntDropdownItem>
            </AntDropdownMenu>
          </template>
        </AntDropdown>

        <AntDropdown v-else-if="item === 'lineHeight'" trigger="click" @command="(value: string) => runCommand('lineHeight', value)">
          <AntButton text :aria-label="commandLabel('lineHeight')">
            {{ currentLineHeightLabel }}
            <ChevronDown :size="14" class="tvp-caret" />
          </AntButton>
          <template #dropdown>
            <AntDropdownMenu>
              <AntDropdownItem
                v-for="lineHeight in LINE_HEIGHTS"
                :key="lineHeight || 'default-line-height'"
                :command="lineHeight"
              >
                {{ lineHeight || t('toolbar.lineHeight.default') }}
              </AntDropdownItem>
            </AntDropdownMenu>
          </template>
        </AntDropdown>

        <AntTooltip v-else-if="item === 'bold'" :content="commandLabel('bold')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('bold')"
            :type="commandActive('bold') ? 'primary' : 'default'"
            @click="runCommand('bold')"
          ><Bold :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'italic'" :content="commandLabel('italic')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('italic')"
            :type="commandActive('italic') ? 'primary' : 'default'"
            @click="runCommand('italic')"
          ><Italic :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'strike'" :content="commandLabel('strike')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('strike')"
            :type="commandActive('strike') ? 'primary' : 'default'"
            @click="runCommand('strike')"
          ><Strikethrough :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'underline'" :content="commandLabel('underline')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('underline')"
            :type="commandActive('underline') ? 'primary' : 'default'"
            @click="runCommand('underline')"
          ><Underline :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'code'" :content="commandLabel('code')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('code')"
            :type="commandActive('code') ? 'primary' : 'default'"
            @click="runCommand('code')"
          ><Code :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'superscript'" :content="commandLabel('superscript')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('superscript')"
            :type="commandActive('superscript') ? 'primary' : 'default'"
            @click="runCommand('superscript')"
          ><Superscript :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'subscript'" :content="commandLabel('subscript')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('subscript')"
            :type="commandActive('subscript') ? 'primary' : 'default'"
            @click="runCommand('subscript')"
          ><Subscript :size="16" /></AntButton>
        </AntTooltip>

        <AntDropdown v-else-if="item === 'color'" trigger="click">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('color')">
            <Type :size="16" :style="{ color: currentColor || 'inherit' }" />
          </AntButton>
          <template #dropdown>
            <div class="tvp-color-panel">
              <div
                class="tvp-color-clear"
                :class="{ 'is-active': currentColor === '' }"
                @click="selectColor('')"
              >{{ t('toolbar.color.default') }}</div>
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
        </AntDropdown>

        <AntDropdown v-else-if="item === 'highlight'" trigger="click">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('highlight')">
            <Highlighter :size="16" :style="{ color: currentHighlight || 'inherit' }" />
          </AntButton>
          <template #dropdown>
            <div class="tvp-color-panel">
              <div
                class="tvp-color-clear"
                :class="{ 'is-active': currentHighlight === '' }"
                @click="selectHighlight('')"
              >{{ t('toolbar.highlight.none') }}</div>
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
        </AntDropdown>

        <AntDropdown v-else-if="item === 'align'" trigger="click" @command="onAlign">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('align')">
            <component :is="alignIcon" :size="16" />
          </AntButton>
          <template #dropdown>
            <AntDropdownMenu>
              <AntDropdownItem
                v-for="align in ALIGN_OPTIONS"
                :key="align.value"
                :command="align.value"
              >
                <span class="tvp-menu-item">
                  <component :is="alignOptionIcon(align.value)" :size="16" />{{ align.label }}
                </span>
              </AntDropdownItem>
            </AntDropdownMenu>
          </template>
        </AntDropdown>

        <AntTooltip v-else-if="item === 'decreaseIndent'" :content="commandLabel('decreaseIndent')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('decreaseIndent')"
            @click="runCommand('decreaseIndent')"
          ><IndentDecrease :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'increaseIndent'" :content="commandLabel('increaseIndent')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('increaseIndent')"
            @click="runCommand('increaseIndent')"
          ><IndentIncrease :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'bulletList'" :content="commandLabel('bulletList')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('bulletList')"
            :type="commandActive('bulletList') ? 'primary' : 'default'"
            @click="runCommand('bulletList')"
          ><List :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'orderedList'" :content="commandLabel('orderedList')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('orderedList')"
            :type="commandActive('orderedList') ? 'primary' : 'default'"
            @click="runCommand('orderedList')"
          ><ListOrdered :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'taskList'" :content="commandLabel('taskList')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('taskList')"
            :type="commandActive('taskList') ? 'primary' : 'default'"
            @click="runCommand('taskList')"
          ><ListChecks :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'blockquote'" :content="commandLabel('blockquote')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('blockquote')"
            :type="commandActive('blockquote') ? 'primary' : 'default'"
            @click="runCommand('blockquote')"
          ><Quote :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'codeBlock'" :content="`${commandLabel('codeBlock')}:${currentCodeBlockLabel}`" placement="top" :show-after="300">
          <AntDropdown trigger="click" overlayClassName="tvp-ant-code-language-dropdown" @command="onCodeBlockLanguage">
            <AntButton
              text
              class="tvp-icon-btn"
              :aria-label="commandLabel('codeBlock')"
              :type="commandActive('codeBlock') ? 'primary' : 'default'"
            ><Code :size="16" /></AntButton>
            <template #dropdown>
              <AntDropdownMenu :theme="props.dark ? 'dark' : 'light'">
                <AntDropdownItem
                  v-for="language in CODE_BLOCK_LANGUAGE_MENU_OPTIONS"
                  :key="language.value"
                  :command="language.value"
                >
                  <span class="tvp-menu-item">
                    <svg
                      v-if="language.icon"
                      class="tvp-code-block-language-icon"
                      :viewBox="language.icon.viewBox"
                      :data-toolbar-language-icon="language.value"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        v-for="part in language.icon.parts"
                        :key="part.d"
                        :d="part.d"
                        :fill="part.fill"
                        :stroke="part.stroke"
                      />
                    </svg>
                    <Code v-else :size="15" aria-hidden="true" />
                    <span>{{ language.label }}</span>
                  </span>
                </AntDropdownItem>
              </AntDropdownMenu>
            </template>
          </AntDropdown>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'hr'" :content="commandLabel('hr')" placement="top" :show-after="300">
          <AntDropdown trigger="click" @command="onHorizontalRule">
            <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('hr')"><Minus :size="16" /></AntButton>
            <template #dropdown>
              <AntDropdownMenu>
                <AntDropdownItem
                  v-for="option in HORIZONTAL_RULE_OPTIONS"
                  :key="option.value"
                  :command="option.value"
                >
                  <span class="tvp-hr-menu-item">
                    <span class="tvp-hr-menu-item__preview" :data-variant="option.value" />
                    {{ horizontalRuleLabel(option) }}
                  </span>
                </AntDropdownItem>
              </AntDropdownMenu>
            </template>
          </AntDropdown>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'link'" :content="commandLabel('link')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="commandLabel('link')"
            :type="ctx.isActive('link') ? 'primary' : 'default'"
            @click="openLinkDialog"
          ><Link :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'image' && SHOW_IMAGE_DROPDOWN" :content="commandLabel('image')" placement="top" :show-after="300">
          <AntDropdown trigger="click" @command="onImageCommand">
            <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('image')"><ImagePlus :size="16" /></AntButton>
            <template #dropdown>
              <AntDropdownMenu>
                <AntDropdownItem v-if="uploadImage" command="upload">
                  <span class="tvp-menu-item"><ImagePlus :size="15" />{{ t('toolbar.image.upload') }}</span>
                </AntDropdownItem>
                <AntDropdownItem command="url">
                  <span class="tvp-menu-item"><Link2 :size="15" />{{ t('toolbar.image.url') }}</span>
                </AntDropdownItem>
              </AntDropdownMenu>
            </template>
          </AntDropdown>
        </AntTooltip>
        <AntTooltip v-else-if="item === 'image' && SHOW_IMAGE_BUTTON" :content="HAS_IMAGE_UPLOAD ? t('toolbar.image.upload') : t('toolbar.image.url')" placement="top" :show-after="300">
          <AntButton
            text
            class="tvp-icon-btn"
            :aria-label="HAS_IMAGE_UPLOAD ? t('toolbar.image.upload') : t('toolbar.image.url')"
            @click="HAS_IMAGE_UPLOAD ? triggerImageUpload() : openUrlDialog()"
          ><ImagePlus :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'attachment' && uploadAsset" :content="commandLabel('attachment')" placement="top" :show-after="300">
          <AntDropdown trigger="click" @command="onAttachmentCommand">
            <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('attachment')"><File :size="16" /></AntButton>
            <template #dropdown>
              <AntDropdownMenu>
                <AntDropdownItem command="video">
                  <span class="tvp-menu-item"><Video :size="15" />{{ t('toolbar.attachment.video') }}</span>
                </AntDropdownItem>
                <AntDropdownItem command="file">
                  <span class="tvp-menu-item"><File :size="15" />{{ t('toolbar.attachment.file') }}</span>
                </AntDropdownItem>
              </AntDropdownMenu>
            </template>
          </AntDropdown>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'table'" :content="commandLabel('table')" placement="top" :show-after="300">
          <AntDropdown v-model:visible="tableDropdownVisible" trigger="click" @command="onTableInsert">
            <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('table')"><Table :size="16" /></AntButton>
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
          </AntDropdown>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'mermaid'" :content="commandLabel('mermaid')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('mermaid')" @click="ctx.prepareInsert?.(); runCommand('mermaid')"><Workflow :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'clearFormat'" :content="commandLabel('clearFormat')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('clearFormat')" @click="runCommand('clearFormat')"><Eraser :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'findReplace'" :content="commandLabel('findReplace')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('findReplace')" @click="runCommand('findReplace')"><Search :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'markdown'" :content="commandLabel('markdown')" placement="top" :show-after="300">
          <AntDropdown trigger="click" @command="onMarkdownCommand">
            <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('markdown')"><MarkdownIcon :size="16" /></AntButton>
            <template #dropdown>
              <AntDropdownMenu>
                <AntDropdownItem
                  v-for="option in MARKDOWN_OPTIONS"
                  :key="option.value"
                  :command="option.value"
                >
                  <span class="tvp-menu-item">
                    <component :is="markdownOptionIcon(option.value)" :size="15" />{{ option.label }}
                  </span>
                </AntDropdownItem>
              </AntDropdownMenu>
            </template>
          </AntDropdown>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'print'" :content="commandLabel('print')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="commandLabel('print')" @click="printContent"><Printer :size="16" /></AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'fullscreen'" :content="isFullscreen ? t('toolbar.fullscreen.exit') : commandLabel('fullscreen')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="isFullscreen ? t('toolbar.fullscreen.exit') : commandLabel('fullscreen')" @click="toggleFullscreen">
            <component :is="isFullscreen ? Minimize2 : Maximize2" :size="16" />
          </AntButton>
        </AntTooltip>

        <AntTooltip v-else-if="item === 'preview'" :content="isPreview ? t('toolbar.preview.edit') : commandLabel('preview')" placement="top" :show-after="300">
          <AntButton text class="tvp-icon-btn" :aria-label="isPreview ? t('toolbar.preview.edit') : commandLabel('preview')" @click="togglePreview">
            <component :is="isPreview ? Pencil : Eye" :size="16" />
          </AntButton>
        </AntTooltip>
        </template>
      </span>
    </span>

    <span
      v-for="(menu, menuIndex) in visibleCompactMenus"
      :key="`compact-${menu.id}`"
      class="tvp-toolbar-section"
    >
      <span v-if="toolbarGroups.length > 0 || menuIndex > 0" class="tvp-divider" />
      <AntDropdown
        trigger="click"
        overlay-class-name="tvp-ant-compact-toolbar-dropdown"
        @command="onCompactMenuCommand"
      >
        <AntButton
          text
          class="tvp-compact-menu-trigger"
          :aria-label="compactMenuLabel(menu.id)"
          :data-toolbar-menu="menu.id"
        >
          <component :is="compactMenuIcon(menu.id)" :size="16" />
          <span>{{ compactMenuLabel(menu.id) }}</span>
          <ChevronDown :size="13" />
        </AntButton>
        <template #dropdown>
          <AntDropdownMenu :theme="dark ? 'dark' : 'light'">
            <AntDropdownItem
              v-for="action in compactMenuActions(menu.items)"
              :key="action.key"
              :command="action.key"
              :class="{ 'is-active': commandActive(action.item) }"
            >
              <span class="tvp-menu-item tvp-compact-menu-item">
                <component :is="action.icon" :size="16" />
                <span>{{ action.label }}</span>
              </span>
            </AntDropdownItem>
          </AntDropdownMenu>
        </template>
      </AntDropdown>
    </span>

    <span v-if="compactTrailing.length > 0" class="tvp-toolbar-trailing">
      <AntTooltip
        v-if="compactTrailing.includes('preview')"
        :content="isPreview ? t('toolbar.preview.edit') : commandLabel('preview')"
        placement="top"
        :show-after="300"
      >
        <AntButton text class="tvp-icon-btn" :aria-label="isPreview ? t('toolbar.preview.edit') : commandLabel('preview')" @click="togglePreview">
          <component :is="isPreview ? Pencil : Eye" :size="16" />
        </AntButton>
      </AntTooltip>
      <AntTooltip
        v-if="compactTrailing.includes('fullscreen')"
        :content="isFullscreen ? t('toolbar.fullscreen.exit') : commandLabel('fullscreen')"
        placement="top"
        :show-after="300"
      >
        <AntButton text class="tvp-icon-btn" :aria-label="isFullscreen ? t('toolbar.fullscreen.exit') : commandLabel('fullscreen')" @click="toggleFullscreen">
          <component :is="isFullscreen ? Minimize2 : Maximize2" :size="16" />
        </AntButton>
      </AntTooltip>
    </span>

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
      :multiple="IMAGE_MULTIPLE"
      class="tvp-image-input"
      @change="onImageSelected"
    />

    <input
      ref="videoInput"
      type="file"
      :accept="VIDEO_ACCEPT"
      :multiple="VIDEO_MULTIPLE"
      class="tvp-image-input"
      @change="onVideoSelected"
    />

    <input
      ref="fileInput"
      type="file"
      :accept="FILE_ACCEPT"
      :multiple="FILE_MULTIPLE"
      class="tvp-image-input"
      @change="onFileSelected"
    />

    <AntModal v-model="urlDialogVisible" :title="t('toolbar.image.urlDialogTitle')" width="420px" append-to-body>
      <AntInput
        v-model="imageUrl"
        :placeholder="t('toolbar.image.urlPlaceholder')"
        @keyup.enter="confirmUrlImage"
      />
      <template #footer>
        <AntButton @click="urlDialogVisible = false">{{ t('toolbar.action.cancel') }}</AntButton>
        <AntButton type="primary" @click="confirmUrlImage">{{ t('toolbar.action.confirm') }}</AntButton>
      </template>
    </AntModal>

    <AntModal
      v-model="imageCropVisible"
      :title="t('image.crop.title')"
      width="520px"
      append-to-body
      :mask-closable="false"
      @update:model-value="(show) => { if (!show) cancelImageCrop() }"
    >
      <div class="tvp-image-crop">
        <div
          ref="imageCropPreview"
          class="tvp-image-crop__preview"
          :style="{ aspectRatio: String(IMAGE_CROP.aspectRatio) }"
          @pointerdown="onImageCropPointerDown"
          @pointermove="onImageCropPointerMove"
          @pointerup="onImageCropPointerUp"
          @pointercancel="onImageCropPointerUp"
          @lostpointercapture="onImageCropPointerUp"
        >
          <img
            v-if="imageCropUrl"
            ref="imageCropImg"
            :src="imageCropUrl"
            :style="imageCropImageStyle"
            draggable="false"
            alt=""
            @load="clampImageCropPan()"
          >
        </div>
        <p class="tvp-image-crop__hint">{{ t('image.crop.hint') }}</p>
        <label class="tvp-image-crop__slider">
          <span>{{ t('image.crop.zoom') }}</span>
          <AntSlider v-model="imageCropZoom" :min="1" :max="3" :step="0.1" />
        </label>
      </div>
      <template #footer>
        <AntButton @click="cancelImageCrop">{{ t('toolbar.action.cancel') }}</AntButton>
        <AntButton @click="skipImageCrop">{{ t('image.crop.skip') }}</AntButton>
        <AntButton type="primary" @click="confirmImageCrop">{{ t('image.crop.confirm') }}</AntButton>
      </template>
    </AntModal>

    <input
      ref="mdInput"
      type="file"
      :accept="MARKDOWN_IMPORT_ACCEPT"
      class="tvp-image-input"
      @change="onMdSelected"
    />

    <!-- 链接弹窗(AntModal) -->
    <AntModal
      v-model="linkDialogVisible"
      :title="t('toolbar.link.dialogTitle')"
      width="440px"
      append-to-body
      :close-on-click-modal="true"
    >
      <div class="tvp-link-form">
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">{{ t('toolbar.link.textLabel') }}</label>
          <AntInput
            v-model="linkText"
            :placeholder="t('toolbar.link.textPlaceholder')"
            clearable
          />
        </div>
        <div class="tvp-link-form__row">
          <label class="tvp-link-form__label">{{ t('toolbar.link.hrefLabel') }}</label>
          <AntInput
            v-model="linkUrl"
            placeholder="https://example.com"
            clearable
            @keyup.enter="confirmLink"
          />
        </div>
        <div class="tvp-link-form__row tvp-link-form__row--check">
          <AntCheckbox v-model="linkNewTab">{{ t('toolbar.link.openInNewWindow') }}</AntCheckbox>
        </div>
      </div>
      <template #footer>
        <AntButton @click="cancelLink">{{ t('toolbar.action.cancel') }}</AntButton>
        <AntButton type="primary" @click="confirmLink">{{ t('toolbar.action.confirm') }}</AntButton>
      </template>
    </AntModal>
  </div>
</template>

<style scoped>
/* Ant 的默认按钮 token 不感知编辑器局部暗色变量,在 toolbar 内显式桥接。 */
.tvp-toolbar :deep(.tvp-ant-button) {
  color: var(--tvp-ant-text-color-regular, rgba(0, 0, 0, 0.88));
}

.tvp-toolbar :deep(.tvp-ant-button:not(.tvp-ant-button--primary):not(:disabled):not(.ant-btn-disabled):hover),
.tvp-toolbar :deep(.tvp-ant-button:not(.tvp-ant-button--primary):not(:disabled):not(.ant-btn-disabled):focus-visible) {
  color: var(--tvp-ant-text-color-primary, rgba(0, 0, 0, 0.88));
  background: var(--tvp-ant-fill-color-light, rgba(0, 0, 0, 0.06));
}

.tvp-toolbar :deep(.tvp-ant-button:disabled),
.tvp-toolbar :deep(.tvp-ant-button.ant-btn-disabled) {
  color: var(--tvp-ant-text-color-disabled, rgba(0, 0, 0, 0.25));
}

.tvp-toolbar :deep(.tvp-ant-button svg) {
  color: inherit;
}

/*
 * 纯图标按钮:统一为 32×32 正方形击中区。
 *
 * 为什么:Ant Design Vue 的 .tvp-ant-button 默认 padding: 8px 15px,
 * 塞一个 16px 图标进去会得到 ≈46×32 的横向长方形,图标偏左、
 * 右侧大块留白,视觉松散。Notion / 飞书 / 语雀 / Google Docs
 * 的工具栏图标按钮都是正方形击中区,这是业界事实标准。
 *
 * 这里只约束「纯图标」按钮(无文字/无复合内容),带文字的
 * 标题/颜色/对齐按钮仍按内容自适应宽度。
 */
.tvp-toolbar :deep(.tvp-ant-button.tvp-icon-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-width: 32px;
  max-width: 32px;
  height: 32px;
  flex: 0 0 32px;
  box-sizing: border-box;
  padding: 0;
  line-height: 1;
}

.tvp-toolbar :deep(.tvp-ant-button.tvp-icon-btn:focus-visible) {
  outline: 2px solid var(--tvp-ant-color-primary, #1677ff);
  outline-offset: 1px;
}

.tvp-toolbar :deep(.tvp-ant-button--primary.tvp-icon-btn) {
  border-color: transparent;
  background: var(--tvp-ant-color-primary-light-9, #e6f4ff);
  box-shadow: inset 0 0 0 2px var(--tvp-ant-fill-color-blank, #fff);
  color: var(--tvp-ant-color-primary, #1677ff);
}

.tvp-toolbar :deep(.tvp-ant-button--primary.tvp-icon-btn:hover) {
  border-color: transparent;
  background: var(--tvp-ant-color-primary-light-8, #bae0ff);
  color: var(--tvp-ant-color-primary, #1677ff);
}

.tvp-toolbar :deep(.tvp-ant-button:hover) {
  box-shadow: inset 0 0 0 2px var(--tvp-ant-fill-color-blank, #fff);
}

.tvp-toolbar :deep(.tvp-ant-button.tvp-icon-btn > span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  line-height: 1;
}

.tvp-toolbar :deep(.tvp-ant-button.tvp-icon-btn svg) {
  display: block;
  flex: none;
}

/*
 * 干掉 Ant Design Vue 自带的 .tvp-ant-button + .tvp-ant-button { margin-left: 12px }。
 * 工具栏是 flex 容器,margin-left 不会在换行处被清除,导致折到第二行的
 * 第一个按钮仍带着 12px 左缩进、两行起点对不齐。改用容器的 gap 统一
 * 控制间距,gap 不受换行影响,两行起点天然对齐。对工具栏内所有按钮生效。
 */
.tvp-toolbar :deep(.tvp-ant-button + .tvp-ant-button) {
  margin-left: 0;
}

.tvp-toolbar :deep(.tvp-ant-button:not(.tvp-icon-btn) > span) {
  display: inline-flex;
  align-items: center;
}

.tvp-toolbar :deep(.tvp-ant-button:not(.tvp-icon-btn)) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.tvp-toolbar :deep(.tvp-ant-button:not(.tvp-icon-btn) svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-toolbar :deep(.tvp-ant-button.tvp-select-btn--heading) {
  width: 56px;
  min-width: 56px;
  max-width: 56px;
  flex: 0 0 56px;
  padding: 0 4px;
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
  border-bottom: 1px solid var(--tvp-ant-border-color-light, #e4e7ed);
  background: var(--tvp-ant-fill-color-blank, #fff);
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

.tvp-toolbar-section,
.tvp-toolbar-group,
.tvp-toolbar-trailing {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.tvp-toolbar-trailing {
  min-width: 66px;
  flex: 1 0 auto;
  justify-content: flex-end;
}

.tvp-toolbar :deep(.tvp-ant-button.tvp-compact-menu-trigger) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px;
  font-size: 13px;
}

.tvp-compact-menu-item {
  min-width: 116px;
}

:global(.tvp-ant-compact-toolbar-dropdown .ant-dropdown-menu-item.is-active) {
  color: var(--tvp-ant-color-primary, #1677ff);
  background: var(--tvp-ant-color-primary-light-9, #e6f4ff);
}

/* 隐藏的图片选择 input */
.tvp-image-input {
  display: none;
}

.tvp-image-crop {
  display: grid;
  gap: 12px;
}

.tvp-image-crop__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  touch-action: none;
  border: 1px solid var(--tvp-ant-border-color-light, #e4e7ed);
  border-radius: 6px;
  background: var(--tvp-ant-fill-color-light, #f5f7fa);
}

.tvp-image-crop__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center;
  user-select: none;
  pointer-events: none;
}

.tvp-image-crop__hint {
  margin: 0;
  color: var(--tvp-ant-text-color-secondary, #606266);
  font-size: 12px;
  line-height: 1.5;
}

.tvp-image-crop__slider {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  font-size: 13px;
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
  color: var(--tvp-ant-color-primary, #409eff);
}

.tvp-menu-item {
  display: inline-flex;
  min-width: 88px;
  align-items: center;
  gap: 6px;
  line-height: 1;
  vertical-align: middle;
}

.tvp-menu-item svg {
  display: block;
  flex: 0 0 auto;
}

.tvp-code-block-language-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

:global(.tvp-ant-code-language-dropdown .ant-dropdown-menu) {
  max-height: 328px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

:global(.tvp-ant-code-language-dropdown .ant-dropdown-menu-dark) {
  background: #1d1e1f;
  border: 1px solid #414243;
}

:global(.tvp-ant-code-language-dropdown .ant-dropdown-menu-dark .tvp-ant-dropdown-menu__item) {
  color: #cfd3dc;
}

:global(.tvp-ant-code-language-dropdown .ant-dropdown-menu-dark .tvp-ant-dropdown-menu__item:hover) {
  color: #e5eaf3;
  background: #303030;
}

:global(.tvp-ant-code-language-dropdown) {
  z-index: 2200 !important;
}

/* 表格网格选择器 */
.tvp-table-grid {
  padding: 8px;
  user-select: none;
  background: var(--tvp-ant-bg-color-overlay, var(--tvp-ant-bg-color, #fff));
  border: 1px solid var(--tvp-ant-border-color-light, var(--tvp-ant-border-color, #dcdfe6));
  border-radius: 6px;
  box-shadow: var(--tvp-ant-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.12));
}

.tvp-table-grid__row {
  display: flex;
}

.tvp-table-grid__cell {
  width: 18px;
  height: 18px;
  margin: 1px;
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 2px;
  cursor: pointer;
  background: var(--tvp-ant-fill-color-blank, #fff);
  transition: background 0.1s;
}

.tvp-table-grid__cell.is-active {
  background: var(--tvp-ant-color-primary, #409eff);
  border-color: var(--tvp-ant-color-primary, #409eff);
}

.tvp-table-grid__label {
  text-align: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--tvp-ant-text-color-secondary, #909399);
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
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  font-size: 12px;
  line-height: 22px;
  text-align: center;
  color: var(--tvp-ant-text-color-secondary, #909399);
  transition: transform 0.1s;
}

.tvp-color-swatch:hover {
  transform: scale(1.1);
}

.tvp-color-swatch.is-active {
  outline: 2px solid var(--tvp-ant-color-primary, #409eff);
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
  color: var(--tvp-ant-text-color-regular, #606266);
  text-align: center;
}

.tvp-color-clear:hover {
  background: var(--tvp-ant-fill-color-light, #f5f7fa);
}

.tvp-color-clear.is-active {
  color: var(--tvp-ant-color-primary, #409eff);
  background: var(--tvp-ant-color-primary-light-9, #ecf5ff);
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
  border: 1px solid var(--tvp-ant-border-color, #dcdfe6);
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  outline: none;
  color: var(--tvp-ant-text-color-regular, #606266);
}

.tvp-hex-input:focus {
  border-color: var(--tvp-ant-color-primary, #409eff);
}

.tvp-divider {
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--tvp-ant-border-color, #dcdfe6);
}

.tvp-caret {
  margin-left: 0;
  font-size: 10px;
  opacity: 0.6;
}

.tvp-hr-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 98px;
  line-height: 1;
}

.tvp-hr-menu-item__preview {
  display: inline-block;
  flex: 0 0 auto;
  width: 42px;
  border-top: 1.5px solid var(--tvp-ant-text-color-secondary, #606266);
}

.tvp-hr-menu-item__preview[data-variant='thick'] {
  border-top-width: 3px;
}

.tvp-hr-menu-item__preview[data-variant='dashed'] {
  border-top-style: dashed;
}

.tvp-hr-menu-item__preview[data-variant='dotted'] {
  border-top-style: dotted;
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
  color: var(--tvp-ant-text-color-regular, #606266);
}

.tvp-link-form__row--check {
  padding-left: 46px;
}
</style>
