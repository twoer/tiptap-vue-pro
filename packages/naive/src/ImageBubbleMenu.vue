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
import { resolveEditorBehaviorOptions, useEditorPluginRegistration } from 'tiptap-vue-pro-core'

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

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proImageBubbleMenu',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proImageBubbleMenu',
    editor: ed,
    element,
    updateDelay: 100,
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
  try {
    const url = await props.uploadImage(file)
    if (url) {
      ed.chain().focus().updateAttributes('image', { src: url }).run()
    } else {
      props.ctx.notify('图片上传失败', 'error')
    }
  } catch {
    props.ctx.notify('图片上传失败', 'error')
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
        <NButton text @click="setSize('small')">小</NButton>
      </template>
      小(25%)
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('medium')">中</NButton>
      </template>
      中(50%)
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('large')">大</NButton>
      </template>
      大(75%)
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text @click="setSize('original')">原始</NButton>
      </template>
      原始尺寸
    </NTooltip>

    <NDivider vertical />

    <!-- 对齐 -->
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text aria-label="左对齐" :type="activeAlign === 'left' ? 'primary' : 'default'" @click="setAlign('left')">
          <AlignLeft :size="16" />
        </NButton>
      </template>
      左对齐
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text aria-label="居中" :type="activeAlign === 'center' ? 'primary' : 'default'" @click="setAlign('center')">
          <AlignCenter :size="16" />
        </NButton>
      </template>
      居中
    </NTooltip>
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text aria-label="右对齐" :type="activeAlign === 'right' ? 'primary' : 'default'" @click="setAlign('right')">
          <AlignRight :size="16" />
        </NButton>
      </template>
      右对齐
    </NTooltip>

    <NDivider vertical />

    <!-- 题注 / 替换 / 删除 -->
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton text aria-label="编辑题注" @click="focusCaption" @mousedown.prevent><MessageSquarePlus :size="16" /></NButton>
      </template>
      编辑题注
    </NTooltip>
    <NTooltip v-if="uploadImage" trigger="hover" placement="top">
      <template #trigger>
        <NButton text aria-label="替换图片" @click="triggerReplace"><ImagePlus :size="16" /></NButton>
      </template>
      替换图片
    </NTooltip>
    <NTooltip v-model:show="deleteTooltipVisible" trigger="hover" placement="top">
      <template #trigger>
        <NButton text aria-label="删除图片" @mousedown.prevent.stop="deleteTooltipVisible = false" @click="remove"><Trash2 :size="16" /></NButton>
      </template>
      删除图片
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
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--n-popover-color, var(--n-color, #fff));
  border: 1px solid var(--n-border-color, #efeff5);
  border-radius: 6px;
  box-shadow: var(--n-box-shadow, 0 2px 12px rgba(0, 0, 0, 0.12));
  color: var(--n-text-color-2, #303133);
  /* 位置变化平滑过渡,避免图片加载完重定位时的突兀跳动 */
  transition: top 0.15s ease-out, left 0.15s ease-out;
}

/*
 * 统一所有按钮为 28x28 正方形击中区,图标 16px。
 * 关键:文字按钮(小/中/大/原始)和图标按钮必须等高,否则工具条参差不齐显丑。
 * 用 :deep() 穿透 NButton 的 scoped 边界,统一 padding/height/min-width。
 */
.tvp-img-bubble :deep(.n-button) {
  height: 28px;
  min-width: 28px;
  padding: 0;
  color: var(--n-text-color-2, #303133);
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
