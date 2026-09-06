<script setup lang="ts">
/**
 * Naive 适配的表格行/列抓手(飞书式)。
 * 覆盖层引擎在 core 的 useTableGripOverlay,本组件只负责 Naive UI
 * 数据驱动的 NDropdown 菜单(options + renderLabel)与样式。
 */
import { onMounted, onBeforeUnmount, watch, h, type VNode } from 'vue'
import { NDropdown } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { useTableGripOverlay, type ProEditorContext, type ProEditorDebugLogFn } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  scrollContainer: HTMLElement | null
  /** adapter 层开发者诊断日志 */
  debugLog?: ProEditorDebugLogFn
}>()
const emit = defineEmits<{
  'menu-open-change': [open: boolean]
}>()

const {
  hasEditor, hoverRow, hoverCol, activeGripPos,
  rowMenuShow, colMenuShow, rowMenuIndex, colMenuIndex,
  onRowGripEnter, onColGripEnter, lockRowGripTarget, lockColGripTarget,
  onRowMenuShow, onColMenuShow,
  runRowCmd: runRowCommand, runColCmd: runColCommand,
  setup, teardown, refresh,
} = useTableGripOverlay({
  getEditor: () => props.editor,
  getScrollContainer: () => props.scrollContainer,
  getContext: () => props.ctx,
  debugLog: (channel, event, payload, level, error) =>
    props.debugLog?.(channel, event, payload, level, error),
  onMenuOpenChange: (open) => emit('menu-open-change', open),
})

// 菜单 options(Naive 用数据驱动)
const iconMap: Record<string, unknown> = {
  addUp: Plus, addDown: Plus, addLeft: Plus, addRight: Plus,
  moveUp: ArrowUp, moveDown: ArrowDown, moveLeft: ArrowUp, moveRight: ArrowDown,
  delete: Trash2,
}
const rowOptions: DropdownOption[] = [
  { key: 'addUp', label: '在上方插入' },
  { key: 'addDown', label: '在下方插入' },
  { type: 'divider' },
  { key: 'moveUp', label: '上移' },
  { key: 'moveDown', label: '下移' },
  { type: 'divider' },
  { key: 'delete', label: '删除' },
]
const colOptions: DropdownOption[] = [
  { key: 'addLeft', label: '在左侧插入' },
  { key: 'addRight', label: '在右侧插入' },
  { type: 'divider' },
  { key: 'moveLeft', label: '左移' },
  { key: 'moveRight', label: '右移' },
  { type: 'divider' },
  { key: 'delete', label: '删除' },
]
function renderLabel(opt: DropdownOption): VNode {
  const Icon = iconMap[opt.key as string] ?? Plus
  const isRotated = opt.key === 'moveLeft' || opt.key === 'moveRight'
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;line-height:1;vertical-align:middle;' }, [
    h(Icon as typeof Plus, { size: 14, style: isRotated ? 'display:block;flex:0 0 auto;transform:rotate(-90deg)' : 'display:block;flex:0 0 auto;' }),
    opt.label as string,
  ])
}

// NDropdown @select 传 key: string | number,引擎命令收 string
function runRowCmd(key: string | number) {
  runRowCommand(String(key))
}
function runColCmd(key: string | number) {
  runColCommand(String(key))
}

onMounted(setup)
onBeforeUnmount(teardown)
watch(() => [props.editor, props.scrollContainer], () => { teardown(); setup() })
watch(() => props.ctx.tableState.value.tablePos, refresh)
</script>

<template>
  <template v-if="hasEditor">
    <!-- 行抓手(表格左外侧)-->
    <div
      v-for="row in activeGripPos.rows"
      :key="'row-' + row.index"
      class="tvp-table-grip tvp-table-grip--row"
      :class="{ 'is-active': row.index === hoverRow || row.index === rowMenuIndex }"
      :style="{ left: row.left + 'px', top: row.top + 'px', height: row.height + 'px' }"
      @mouseenter="onRowGripEnter(row.index)"
      @mousedown.stop="lockRowGripTarget(row.index)"
    >
      <NDropdown trigger="click" :show="rowMenuShow && rowMenuIndex === row.index" @update:show="(visible: boolean) => onRowMenuShow(visible, row.index)" placement="right-start" :options="rowOptions" :render-label="renderLabel" @select="runRowCmd">
        <span class="tvp-table-grip__icon" aria-label="行操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
      </NDropdown>
    </div>

    <!-- 列抓手(表格上外侧)-->
    <div
      v-for="col in activeGripPos.cols"
      :key="'col-' + col.index"
      class="tvp-table-grip tvp-table-grip--col"
      :class="{ 'is-active': col.index === hoverCol || col.index === colMenuIndex }"
      :style="{ left: col.left + 'px', top: col.top + 'px', width: col.width + 'px' }"
      @mouseenter="onColGripEnter(col.index)"
      @mousedown.stop="lockColGripTarget(col.index)"
    >
      <NDropdown trigger="click" :show="colMenuShow && colMenuIndex === col.index" @update:show="(visible: boolean) => onColMenuShow(visible, col.index)" placement="top-start" :options="colOptions" :render-label="renderLabel" @select="runColCmd">
        <span class="tvp-table-grip__icon" aria-label="列操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
      </NDropdown>
    </div>
  </template>
</template>

<style scoped>
.tvp-table-grip {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s, color 0.15s;
}
/* 图标颜色强制指定,避免 NDropdown 触发器样式或继承把图标吃掉 */
.tvp-table-grip__icon {
  display: grid;
  grid-template-columns: repeat(2, 2.5px);
  grid-template-rows: repeat(2, 2.5px);
  gap: 3px;
  place-content: center;
  width: 28px;
  height: 28px;
  color: #595959;
  opacity: 0;
  transition: opacity 0.12s, color 0.15s;
}
.tvp-table-grip__dot {
  width: 2.5px;
  height: 2.5px;
  border-radius: 999px;
  background: currentColor;
}
.tvp-table-grip.is-active .tvp-table-grip__icon {
  opacity: 1;
}
/* NDropdown 的 trigger 只包住 4 点附近,但比点阵本身大,降低点击精度要求。 */
.tvp-table-grip :deep(.n-dropdown-trigger) {
  width: 28px;
  height: 28px;
}
.tvp-table-grip:hover {
  background: transparent;
}
.tvp-table-grip:hover .tvp-table-grip__icon {
  color: var(--n-primary-color, #18a058);
}
.tvp-table-grip--row {
  width: 22px;
  background: transparent;
}
.tvp-table-grip--row:hover {
  background: transparent;
}
.tvp-table-grip--col {
  height: 22px;
  background: transparent;
}
.tvp-table-grip--col:hover {
  background: transparent;
}
</style>
