<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElTooltip, ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

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
}>()

const ctx = computed(() => props.ctx)

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
    <ElTooltip content="撤销" placement="bottom">
      <ElButton :icon="'←'" text @click="ctx.commands.undo()" :disabled="false" />
    </ElTooltip>
    <ElTooltip content="重做" placement="bottom">
      <ElButton :icon="'→'" text @click="ctx.commands.redo()" />
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 标题级别 dropdown -->
    <ElDropdown trigger="click" @command="onHeading">
      <ElButton text>
        {{ headingLabel }}
        <span class="tvp-caret">▾</span>
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
    <ElTooltip content="加粗" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('bold') ? 'primary' : 'default'"
        @click="ctx.commands.bold()"
      >B</ElButton>
    </ElTooltip>
    <ElTooltip content="斜体" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('italic') ? 'primary' : 'default'"
        @click="ctx.commands.italic()"
      ><i>I</i></ElButton>
    </ElTooltip>
    <ElTooltip content="删除线" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('strike') ? 'primary' : 'default'"
        @click="ctx.commands.strike()"
      ><s>S</s></ElButton>
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 列表 -->
    <ElTooltip content="无序列表" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('bulletList') ? 'primary' : 'default'"
        @click="ctx.commands.bulletList()"
      >• ☰</ElButton>
    </ElTooltip>
    <ElTooltip content="有序列表" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('orderedList') ? 'primary' : 'default'"
        @click="ctx.commands.orderedList()"
      >1. ☰</ElButton>
    </ElTooltip>
    <ElTooltip content="引用" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('blockquote') ? 'primary' : 'default'"
        @click="ctx.commands.blockquote()"
      >❝</ElButton>
    </ElTooltip>
    <ElTooltip content="代码块" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('codeBlock') ? 'primary' : 'default'"
        @click="ctx.commands.codeBlock()"
      >&lt;/&gt;</ElButton>
    </ElTooltip>
    <ElTooltip content="分割线" placement="bottom">
      <ElButton text @click="ctx.commands.hr()">―</ElButton>
    </ElTooltip>

    <span class="tvp-divider" />

    <!-- 链接 -->
    <ElTooltip content="链接" placement="bottom">
      <ElButton
        text
        :type="ctx.isActive('link') ? 'primary' : 'default'"
        @click="openLinkDialog"
      >🔗</ElButton>
    </ElTooltip>

    <!-- 表格 -->
    <ElTooltip content="插入表格" placement="bottom">
      <ElButton text @click="ctx.commands.insertTable()">▦</ElButton>
    </ElTooltip>

    <!-- 链接弹窗(MVP 简化版,后续换 ElDialog 组件) -->
    <teleport to="body">
      <div v-if="linkDialogVisible" class="tvp-link-dialog-mask" @click.self="linkDialogVisible = false">
        <div class="tvp-link-dialog">
          <div class="tvp-link-dialog__title">插入链接</div>
          <input
            v-model="linkUrl"
            class="tvp-link-dialog__input"
            type="url"
            placeholder="https://example.com"
            @keyup.enter="confirmLink"
          />
          <div class="tvp-link-dialog__actions">
            <ElButton size="small" @click="linkDialogVisible = false">取消</ElButton>
            <ElButton size="small" type="primary" @click="confirmLink">确定</ElButton>
          </div>
        </div>
      </div>
    </teleport>
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

/* 链接弹窗(简化版,MVP 不依赖 ElDialog 以减少样式耦合) */
.tvp-link-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.tvp-link-dialog {
  background: var(--el-bg-color, #fff);
  border-radius: 6px;
  padding: 16px;
  width: 360px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.tvp-link-dialog__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary, #303133);
}

.tvp-link-dialog__input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.tvp-link-dialog__input:focus {
  border-color: var(--el-color-primary, #409eff);
}

.tvp-link-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
