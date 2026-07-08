<script setup lang="ts">
import { ref, onBeforeUnmount, computed, type CSSProperties } from 'vue'
import { ElButton, ElDropdown, ElDropdownMenu, ElDropdownItem, ElTooltip, ElIcon } from 'element-plus'
import {
  Combine, Split,
  TableProperties, Trash2,
} from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import type { ProEditorContext } from 'tiptap-vue-pro-core'

/**
 * 表格气泡菜单:光标进入表格单元格时,浮在表格上方的操作工具条。
 *
 * 为什么单独做一个气泡(而不是放顶部工具栏):
 * 表格常出现在文档任意位置(尤其底部),放顶部工具栏意味着用户要上下滚动才能操作,
 * 极反人类。Notion / 飞书 / Google Docs 都用「就近浮窗」——操作入口贴着表格本身。
 *
 * 实现要点:
 * - 表格选区是 CellSelection,不完全等同文字选区。这里直接根据 tableState
 *   和 selectedCell DOM 自定位,避免通用 BubbleMenuPlugin 把浮层定位到文字选区。
 * - 与文字气泡互斥:文字气泡的 shouldShow 增加 !inTable 条件(见 BubbleMenu.vue)。
 *
 * UI 设计:一排常用按钮(增删行列,最常用,一步到位)+ 末尾一个「更多」下拉
 * (合并/拆分/表头切换/删除整表,低频操作收起,避免工具条过宽)。
 */
const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  /** 抓手下拉菜单打开时临时隐藏,避免两个表格菜单叠在一起 */
  suppress?: boolean
}>()

const rootEl = ref<HTMLElement | null>(null)
const moreMenuShow = ref(false)
let destructiveTimer: number | null = null
const RUN_AFTER_POPPER_CLOSE_MS = 240

// 更多操作下拉的命令类型
type TableOp =
  | 'mergeCells' | 'splitCell'
  | 'toggleHeaderRow' | 'toggleHeaderColumn'
  | 'deleteTable'

function clearDestructiveTimer() {
  if (destructiveTimer != null) {
    window.clearTimeout(destructiveTimer)
    destructiveTimer = null
  }
}

function run(op: TableOp) {
  moreMenuShow.value = false
  if (op === 'deleteTable') {
    clearDestructiveTimer()
    destructiveTimer = window.setTimeout(() => {
      props.ctx.commands.deleteTable()
      destructiveTimer = null
    }, RUN_AFTER_POPPER_CLOSE_MS)
    return
  }
  props.ctx.commands[op]()
}

// 更多操作下拉项:只剩表头/删除整表(始终可用)。
// 合并/拆分改成按需出现的独立按钮(见模板),不藏下拉里——选中多格才弹「合并」,
// 光标在被合并单元格才弹「拆分」,符合 Notion/飞书的「按需出现」交互。
const tableState = computed(() => props.ctx.tableState.value)
const bubbleVisible = computed(() => !props.suppress && (tableState.value.canMerge || tableState.value.canSplit))
const bubbleStyle = computed(() => getTableBubbleStyle(props.editor, bubbleVisible.value))
const moreOps = [
  { op: 'toggleHeaderRow' as TableOp, icon: TableProperties, text: '首行为表头' },
  { op: 'toggleHeaderColumn' as TableOp, icon: TableProperties, text: '首列为表头' },
  { op: 'deleteTable' as TableOp, icon: Trash2, text: '删除表格' },
]

function getTableBubbleStyle(ed: Editor | undefined, visible: boolean): CSSProperties | undefined {
  if (!ed?.view?.dom || !visible) return undefined
  const selectedCells = Array.from(ed.view.dom.querySelectorAll('td.selectedCell, th.selectedCell')) as HTMLElement[]
  let rect: { left: number; right: number; top: number }
  if (selectedCells.length) {
    const rects = selectedCells.map((cell) => cell.getBoundingClientRect())
    rect = {
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
      top: Math.min(...rects.map((r) => r.top)),
    }
  } else {
    const cursor = ed.view.coordsAtPos(ed.state.selection.from)
    rect = { left: cursor.left, right: cursor.right, top: cursor.top }
  }
  return {
    display: 'flex',
    position: 'fixed',
    left: `${(rect.left + rect.right) / 2}px`,
    top: `${Math.max(8, rect.top - 42)}px`,
    transform: 'translateX(-50%)',
  }
}

onBeforeUnmount(() => {
  clearDestructiveTimer()
})
</script>

<template>
  <div ref="rootEl" class="tvp-table-bubble" :style="bubbleStyle">
    <!-- 选区菜单:选中多格/合并格时浮现。增删行列交给抓手,这里只做合并/拆分 + 表头/删表 -->
    <ElTooltip :teleported="false" v-if="bubbleVisible && tableState.canMerge" content="合并单元格" placement="top" :show-after="400" :persistent="false">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.mergeCells()"><Combine :size="15" /></ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" v-if="bubbleVisible && tableState.canSplit" content="拆分单元格" placement="top" :show-after="400" :persistent="false">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.splitCell()"><Split :size="15" /></ElButton>
    </ElTooltip>

    <span v-if="bubbleVisible" class="tvp-table-bubble__sep" />

    <!-- 低频操作:表头/删除整表(始终可用,收进下拉)-->
    <ElDropdown
      v-model:visible="moreMenuShow"
      trigger="click"
      popper-class="tvp-table-bubble-dropdown"
      @command="run"
    >
      <ElButton text class="tvp-icon-btn tvp-table-bubble__more">
        <ElIcon><TableProperties :size="15" /></ElIcon>
      </ElButton>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem v-for="item in moreOps" :key="item.op" :command="item.op">
            <span class="tvp-menu-item"><component :is="item.icon" :size="15" />{{ item.text }}</span>
          </ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </div>
</template>

<style scoped>
.tvp-table-bubble {
  /* 默认隐藏;选中多格或合并格时由 bubbleStyle 设置 display:flex 和 fixed 定位。 */
  display: none;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

/*
 * 图标按钮统一正方形击中区(与顶部工具栏的 .tvp-icon-btn: 32×32 padding:0 对齐)。
 * 用 :deep() 穿透 scoped 作用域,命中 ElButton 生成的 .el-button。
 * 干掉 EP 自带 .el-button + .el-button { margin-left: 12px},改由容器 gap 统一控制间距。
 */
.tvp-table-bubble :deep(.el-button) {
  width: 32px;
  height: 32px;
  padding: 0;
  margin-left: 0;
}

.tvp-table-bubble__sep {
  display: inline-block;
  width: 1px;
  height: 16px;
  /* margin 与工具栏 .tvp-divider 对齐(0 4px) */
  margin: 0 4px;
  background: var(--el-border-color, #dcdfe6);
}

.tvp-table-bubble__more {
  /* 「更多」按钮稍微突出,提示有低频操作 */
  font-weight: 500;
}

.tvp-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
  vertical-align: middle;
}

.tvp-menu-item svg {
  display: block;
  flex: 0 0 auto;
}

:global(.tvp-table-bubble-dropdown .el-dropdown-menu) {
  min-width: 168px;
  padding: 6px 0;
}

:global(.tvp-table-bubble-dropdown .el-dropdown-menu__item) {
  height: 50px;
  min-height: 50px;
  padding: 0 20px;
  color: var(--el-text-color-regular, #606266);
  font-size: 14px;
  line-height: 22px;
}

:global(.tvp-table-bubble-dropdown .tvp-menu-item) {
  gap: 9px;
  line-height: 22px;
}
</style>
