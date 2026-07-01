<script setup lang="ts">
/**
 * Naive 适配的图片气泡菜单:选中图片(NodeSelection)时浮现(对标飞书)。
 *
 * 能力与其他 adapter 完全对等,组件全部使用 Naive UI。
 * shouldShow 判断当前是否「选中图片节点」,文字选区不弹、图片选中才弹。
 * 工具条:[小][中][大][原始] | [左][中][右] | [题注] [替换] [删除]
 */
import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import { NButton, NTooltip, NDivider } from 'naive-ui'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImagePlus,
  Trash2,
  MessageSquarePlus,
} from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type {
  ProEditorContext,
  UploadImage,
  ImageAlign,
  ImageSizePreset,
  EditorBehaviorOptions,
} from 'tiptap-vue-pro-core'
import {
  notifyImageFileValidationFailure,
  resolveEditorBehaviorOptions,
  useEditorPluginRegistration,
  validateImageFile,
} from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  uploadImage?: UploadImage
  editorBehaviorOptions?: EditorBehaviorOptions
}>()

const rootEl = ref<HTMLElement | null>(null)
const resolvedEditorBehaviorOptions = computed(() => resolveEditorBehaviorOptions(props.editorBehaviorOptions))
const IMAGE_ACCEPT = computed(() => resolvedEditorBehaviorOptions.value.image.accept)

// 当前选中图片的对齐(高亮态)
const selectionTick = ref(0)
const currentImageAttrs = computed(() => {
  void selectionTick.value
  const ed = props.editor
  if (!ed) return null
  const sel = ed.state.selection as { node?: { type: { name: string }; attrs: Record<string, unknown> } }
  if (sel.node && sel.node.type.name === 'image') {
    return sel.node.attrs
  }
  return null
})
const activeAlign = computed<ImageAlign>(() => (currentImageAttrs.value?.align as ImageAlign) ?? 'center')

function getSelectedImageVirtualElement() {
  const ed = props.editor
  const sel = ed?.state.selection as { from?: number; node?: { type: { name: string } } } | undefined
  if (!ed || sel?.from == null || sel.node?.type.name !== 'image') return null

  const node = ed.view.nodeDOM(sel.from) as HTMLElement | null
  const imageNode = node?.classList.contains('tvp-img-node')
    ? node
    : node?.querySelector?.('.tvp-img-node') as HTMLElement | null
  const anchor = (imageNode?.querySelector('.tvp-img-resizable') as HTMLElement | null) ?? imageNode
  if (!anchor) return null

  return {
    getBoundingClientRect: () => anchor.getBoundingClientRect(),
    getClientRects: () => [anchor.getBoundingClientRect()],
  }
}

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proImageBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proImageBubbleMenu',
    editor: ed,
    element,
    updateDelay: 0,
    options: {
      onShow: () => {
        element.style.visibility = 'hidden'
      },
    },
    getReferencedVirtualElement: getSelectedImageVirtualElement,
    shouldShow: ({ state }) => {
      const sel = state.selection as { node?: { type: { name: string } } }
      return !!sel.node && sel.node.type.name === 'image'
    },
  }),
  onRegistered: (ed) => {
    const selectionUpdateHandler = () => {
      selectionTick.value++
    }
    ed.on('selectionUpdate', selectionUpdateHandler)
    return () => ed.off('selectionUpdate', selectionUpdateHandler)
  },
})

function refreshSelectionState() {
  selectionTick.value++
}

onBeforeUnmount(() => {
  if (removeTimer) window.clearTimeout(removeTimer)
})

function setAlign(align: ImageAlign) {
  props.ctx.commands.setImageAlign(align)
  refreshSelectionState()
}

function setSize(preset: ImageSizePreset) {
  props.ctx.commands.setImageSize(preset)
  refreshSelectionState()
}

function focusCaption() {
  const ed = props.editor
  if (!ed) return
  const doFocus = () => {
    const selectedNode = ed.view.nodeDOM(ed.state.selection.from) as HTMLElement | null
    const node = selectedNode?.querySelector('.tvp-img-caption') as HTMLInputElement | null
    node?.focus()
    node?.select()
  }
  requestAnimationFrame(() => {
    doFocus()
    setTimeout(doFocus, 0)
  })
}

const replaceInput = ref<HTMLInputElement | null>(null)
const deleteTooltipVisible = ref(false)
const DELETE_AFTER_TOOLTIP_MS = 240
let removeTimer: number | null = null

function triggerReplace() {
  replaceInput.value?.click()
}
async function onReplaceSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.uploadImage) return
  const ed = props.editor
  if (!ed) return
  const validationFailure = validateImageFile(file, resolvedEditorBehaviorOptions.value.image)
  if (validationFailure) {
    notifyImageFileValidationFailure(props.ctx, validationFailure)
    return
  }
  try {
    const url = await props.uploadImage(file)
    if (url) {
      ed.chain().focus().updateAttributes('image', { src: url }).run()
    } else {
      props.ctx.notify(props.ctx.t('notify.imageUploadFailed'), 'error')
    }
  } catch {
    props.ctx.notify(props.ctx.t('notify.imageUploadFailed'), 'error')
  }
}

async function remove() {
  deleteTooltipVisible.value = false
  await nextTick()
  if (removeTimer) window.clearTimeout(removeTimer)
  removeTimer = window.setTimeout(() => {
    props.ctx.commands.removeImage()
    removeTimer = null
  }, DELETE_AFTER_TOOLTIP_MS)
}
</script>

<template>
  <div ref="rootEl" class="tvp-img-bubble" style="visibility: hidden">
    <!-- 尺寸预设 -->
    <!-- 尺寸预设。统一 size(默认 medium),由 :deep 样式约束为正方形,避免 small 与图标按钮高度不一 -->
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('small')">{{ ctx.t('image.size.small') }}</NButton>
      </template>
      {{ ctx.t('image.size.smallTooltip') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('medium')">{{ ctx.t('image.size.medium') }}</NButton>
      </template>
      {{ ctx.t('image.size.mediumTooltip') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('large')">{{ ctx.t('image.size.large') }}</NButton>
      </template>
      {{ ctx.t('image.size.largeTooltip') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('original')">{{ ctx.t('image.size.original') }}</NButton>
      </template>
      {{ ctx.t('image.size.originalTooltip') }}
    </NTooltip>

    <NDivider vertical />

    <!-- 对齐 -->
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="ctx.t('image.align.left')" :type="activeAlign === 'left' ? 'primary' : 'default'" @click="setAlign('left')">
          <AlignLeft :size="16" />
        </NButton>
      </template>
      {{ ctx.t('image.align.left') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="ctx.t('image.align.center')" :type="activeAlign === 'center' ? 'primary' : 'default'" @click="setAlign('center')">
          <AlignCenter :size="16" />
        </NButton>
      </template>
      {{ ctx.t('image.align.center') }}
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="ctx.t('image.align.right')" :type="activeAlign === 'right' ? 'primary' : 'default'" @click="setAlign('right')">
          <AlignRight :size="16" />
        </NButton>
      </template>
      {{ ctx.t('image.align.right') }}
    </NTooltip>

    <NDivider vertical />

    <!-- 题注 / 替换 / 删除 -->
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="ctx.t('image.caption')" @click="focusCaption" @mousedown.prevent><MessageSquarePlus :size="16" /></NButton>
      </template>
      {{ ctx.t('image.caption') }}
    </NTooltip>
    <NTooltip v-if="uploadImage" trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="ctx.t('image.replace')" @click="triggerReplace"><ImagePlus :size="16" /></NButton>
      </template>
      {{ ctx.t('image.replace') }}
    </NTooltip>
    <NTooltip v-model:show="deleteTooltipVisible" trigger="hover" placement="top">
      <template #trigger>
        <NButton text :aria-label="ctx.t('image.delete')" @mousedown.prevent.stop="deleteTooltipVisible = false" @click="remove"><Trash2 :size="16" /></NButton>
      </template>
      {{ ctx.t('image.delete') }}
    </NTooltip>

    <input
      ref="replaceInput"
      type="file"
      :accept="IMAGE_ACCEPT"
      class="tvp-image-input"
      @change="onReplaceSelected"
    />
  </div>
</template>

<style scoped>
.tvp-img-bubble {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  width: max-content;
  padding: 4px;
  background: var(--n-popover-color, var(--n-color, #fff));
  border: 1px solid var(--n-border-color, #efeff5);
  border-radius: 6px;
  box-shadow: var(--n-box-shadow, 0 2px 12px rgba(0, 0, 0, 0.12));
  color: var(--n-text-color-2, #303133);
}

/*
 * 统一所有按钮为 28x28 正方形击中区,图标 16px。
 * 关键:文字按钮(小/中/大/原始)和图标按钮必须等高,否则工具条参差不齐显丑。
 * 用 :deep() 穿透 NButton 的 scoped 边界,统一 padding/height/min-width。
 */
.tvp-img-bubble :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  padding: 0;
  line-height: 1;
  color: var(--n-text-color-2, #303133);
}

.tvp-img-bubble :deep(.n-button svg) {
  display: block;
  flex: 0 0 auto;
}

.tvp-img-bubble :deep(.n-button:hover),
.tvp-img-bubble :deep(.n-button:focus) {
  color: var(--n-primary-color, #18a058);
  background: var(--n-color-hover, rgba(24, 160, 88, 0.1));
}

.tvp-img-bubble :deep(.n-button.n-button--primary-type),
.tvp-img-bubble :deep(.n-button.n-button--primary-type:hover),
.tvp-img-bubble :deep(.n-button.n-button--primary-type:focus) {
  color: var(--n-primary-color, #18a058);
  background: var(--n-primary-color-suppl, rgba(24, 160, 88, 0.12));
}

/* 文字按钮(尺寸预设)略宽,容下两个汉字,但仍保持 28px 高度对齐 */
.tvp-img-bubble :deep(.n-button .n-button__content) {
  font-size: 13px;
}

/* 分隔符:细一点,高度与按钮对齐 */
.tvp-img-bubble :deep(.n-divider--vertical) {
  margin: 0 4px;
  height: 18px;
  width: 1px;
  background: var(--n-border-color, #efeff5);
}

.tvp-image-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
