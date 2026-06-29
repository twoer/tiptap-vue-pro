<script setup lang="ts">
import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import { AntButton, AntTooltip, AntDivider } from './antDesignPrimitives'
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

/**
 * 图片气泡菜单:选中图片(NodeSelection)时浮现的工具条(对标飞书)。
 *
 * 与文字 BubbleMenu 的区别:shouldShow 判断当前选区是否「选中了图片节点」
 * (NodeSelection 且 node.type.name === 'image'),文字选区不弹、图片选中才弹。
 *
 * 工具条分组:
 *   [小][中][大][原始] | [左][中][右] | [题注] [替换] [删除]
 *
 * 替换:复用 uploadImage 走文件选择,拿到新 url 后 setImage,
 *   保留原图的尺寸/对齐(只换 src)。
 * 题注:聚焦到 NodeView 渲染的题注 input。
 */
const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  uploadImage?: UploadImage
  editorBehaviorOptions?: EditorBehaviorOptions
}>()

const rootEl = ref<HTMLElement | null>(null)
const resolvedEditorBehaviorOptions = computed(() => resolveEditorBehaviorOptions(props.editorBehaviorOptions))
const IMAGE_ACCEPT = computed(() => resolvedEditorBehaviorOptions.value.image.accept)

// 当前选中图片的属性(用于高亮当前对齐/尺寸态)
const activeAlign = computed<ImageAlign>(() => {
  void props.editor
  const attrs = currentImageAttrs.value
  return (attrs?.align as ImageAlign) ?? 'center'
})

// 读当前选中图片节点的全部属性;selectionTick 变化时重算
const selectionTick = ref(0)
const currentImageAttrs = computed(() => {
  void selectionTick.value
  const ed = props.editor
  if (!ed) return null
  const sel = ed.state.selection as { node?: { type: { name: string }; attrs: Record<string, unknown> } }
  // NodeSelection 才有 node
  if (sel.node && sel.node.type.name === 'image') {
    return sel.node.attrs
  }
  return null
})

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
      // 仅图片节点选中时显示
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

// ---- 操作 ----
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
  // 点击按钮瞬间 AntButton 会抢占焦点(activeElement=BUTTON),同步 focus(input) 被覆盖。
  // rAF + setTimeout 双延时:覆盖按钮 click 同步/异步的焦点抢占,确保焦点落到 caption input。
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

// 替换图片:隐藏 input 选文件 → 走 uploadImage → setImage 换 src(保留尺寸/对齐)
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
  // 记下原图属性,替换后恢复尺寸/对齐
  const oldAttrs = currentImageAttrs.value
  try {
    const url = await props.uploadImage(file)
    if (url) {
      ed.chain()
        .focus()
        .updateAttributes('image', { src: url })
        .run()
      void oldAttrs
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
    <AntTooltip content="小(25%)" placement="top" :show-after="300">
      <AntButton text class="tvp-img-bubble__label" @click="setSize('small')">小</AntButton>
    </AntTooltip>
    <AntTooltip content="中(50%)" placement="top" :show-after="300">
      <AntButton text class="tvp-img-bubble__label" @click="setSize('medium')">中</AntButton>
    </AntTooltip>
    <AntTooltip content="大(75%)" placement="top" :show-after="300">
      <AntButton text class="tvp-img-bubble__label" @click="setSize('large')">大</AntButton>
    </AntTooltip>
    <AntTooltip content="原始尺寸" placement="top" :show-after="300">
      <AntButton text class="tvp-img-bubble__label" @click="setSize('original')">原始</AntButton>
    </AntTooltip>

    <AntDivider direction="vertical" />

    <!-- 对齐 -->
    <AntTooltip content="左对齐" placement="top" :show-after="300">
      <AntButton text aria-label="左对齐" :type="activeAlign === 'left' ? 'primary' : 'default'" @click="setAlign('left')">
        <AlignLeft :size="16" />
      </AntButton>
    </AntTooltip>
    <AntTooltip content="居中" placement="top" :show-after="300">
      <AntButton text aria-label="居中" :type="activeAlign === 'center' ? 'primary' : 'default'" @click="setAlign('center')">
        <AlignCenter :size="16" />
      </AntButton>
    </AntTooltip>
    <AntTooltip content="右对齐" placement="top" :show-after="300">
      <AntButton text aria-label="右对齐" :type="activeAlign === 'right' ? 'primary' : 'default'" @click="setAlign('right')">
        <AlignRight :size="16" />
      </AntButton>
    </AntTooltip>

    <AntDivider direction="vertical" />

    <!-- 题注 / 替换 / 删除。题注按钮 tabindex=-1 避免点击后抢焦点,保证 focusCaption 能成功聚焦到 caption input -->
    <AntTooltip content="编辑题注" placement="top" :show-after="300">
      <AntButton text tabindex="-1" aria-label="编辑题注" @click="focusCaption" @mousedown.prevent><MessageSquarePlus :size="16" /></AntButton>
    </AntTooltip>
    <AntTooltip v-if="uploadImage" content="替换图片" placement="top" :show-after="300">
      <AntButton text aria-label="替换图片" @click="triggerReplace"><ImagePlus :size="16" /></AntButton>
    </AntTooltip>
    <AntTooltip v-model:visible="deleteTooltipVisible" content="删除图片" placement="top" :show-after="300" :persistent="false">
      <AntButton text aria-label="删除图片" @mousedown.prevent.stop="deleteTooltipVisible = false" @click="remove"><Trash2 :size="16" /></AntButton>
    </AntTooltip>

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
  background: var(--tvp-ant-bg-color-overlay, var(--tvp-ant-bg-color, #fff));
  border: 1px solid var(--tvp-ant-border-color-light, var(--tvp-ant-border-color, #dcdfe6));
  border-radius: 6px;
  box-shadow: var(--tvp-ant-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.12));
  color: var(--tvp-ant-text-color-regular, #606266);
  /* 位置变化(图片加载完尺寸稳定后重定位)平滑过渡,避免「先下面后跳上面」的突兀感 */
  transition: top 0.15s ease-out, left 0.15s ease-out;
}

.tvp-img-bubble :deep(.tvp-ant-button) {
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
  color: var(--tvp-ant-text-color-regular, #606266);
}

.tvp-img-bubble :deep(.tvp-ant-button.is-text:not(.is-disabled):hover),
.tvp-img-bubble :deep(.tvp-ant-button.is-text:not(.is-disabled):focus) {
  color: var(--tvp-ant-color-primary, #409eff);
  background: var(--tvp-ant-color-primary-light-9, #ecf5ff);
}

.tvp-img-bubble :deep(.tvp-ant-button--primary.is-text),
.tvp-img-bubble :deep(.tvp-ant-button--primary.is-text:not(.is-disabled):hover),
.tvp-img-bubble :deep(.tvp-ant-button--primary.is-text:not(.is-disabled):focus) {
  color: var(--tvp-ant-color-primary, #409eff);
  background: var(--tvp-ant-color-primary-light-9, #ecf5ff);
}

/* 尺寸预设用文字按钮,稍紧凑 */
.tvp-img-bubble :deep(.tvp-img-bubble__label) {
  min-width: 28px;
  font-size: 13px;
}

/* 分隔符留出间距 */
.tvp-img-bubble :deep(.tvp-ant-divider--vertical) {
  margin: 0 4px;
  border-left-color: var(--tvp-ant-border-color-light, #e4e7ed);
}

/* 隐藏的文件选择 input */
.tvp-image-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
