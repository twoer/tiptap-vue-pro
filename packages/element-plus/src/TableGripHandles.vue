<script setup lang="ts">
/**
 * 表格行/列抓手(飞书式)。
 *
 * 交互:悬停某行 → 左外侧 ⋮⋮ 抓手;悬停某列 → 上方抓手;点击选中整行/列 + 弹菜单。
 * 覆盖层引擎(定位/hover 检测/选区落点/命令转发)在 core 的 useTableGripOverlay,
 * 本组件只负责 Element Plus 菜单渲染与样式。
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { useTableGripOverlay, type ProEditorContext, type ProEditorDebugLogFn } from 'tiptap-vue-pro-core'

const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
  /** 滚动容器(覆盖层相对它定位)。由主组件传入 tvp-content-wrap */
  scrollContainer: HTMLElement | null
  /** adapter 层开发者诊断日志 */
  debugLog?: ProEditorDebugLogFn
}>()
const emit = defineEmits<{
  'menu-open-change': [open: boolean]
}>()

// 抓手容器:引擎据它的 DOM 链探测 fixed 包含块祖先(transform/contain 等),
// 把视口坐标换算过去;display: contents 使其自身不参与布局
const layerEl = ref<HTMLElement | null>(null)

const {
  hasEditor, hoverRow, hoverCol, activeGripPos,
  rowMenuShow, colMenuShow, rowMenuIndex, colMenuIndex,
  onRowGripEnter, onColGripEnter, lockRowGripTarget, lockColGripTarget,
  onRowMenuShow, onColMenuShow, runRowCmd, runColCmd,
  setup, teardown, refresh,
} = useTableGripOverlay({
  getEditor: () => props.editor,
  getScrollContainer: () => props.scrollContainer,
  getOverlayHost: () => layerEl.value,
  getContext: () => props.ctx,
  debugLog: (channel, event, payload, level, error) =>
    props.debugLog?.(channel, event, payload, level, error),
  onMenuOpenChange: (open) => emit('menu-open-change', open),
})

onMounted(setup)
onBeforeUnmount(teardown)
// editor/scrollContainer/tableState 变化时重新 setup
watch(() => [props.editor, props.scrollContainer], () => {
  teardown()
  setup()
})
watch(() => props.ctx.tableState.value.tablePos, refresh)
</script>

<template>
  <!-- 覆盖层:随鼠标 hover 的表格渲染,不依赖编辑器当前选区 -->
  <div v-if="hasEditor" ref="layerEl" class="tvp-table-grip-layer">
    <!-- 行抓手(表格左外侧)-->
    <div
      v-for="row in activeGripPos.rows"
      :key="'row-' + row.index"
      class="tvp-table-grip tvp-table-grip--row"
      :class="{ 'is-active': row.index === hoverRow || row.index === rowMenuIndex }"
      :style="{ left: row.left + 'px', top: row.top + 'px', height: row.height + 'px' }"
      @mouseenter="onRowGripEnter(row.index)"
      @mousedown.stop.prevent="lockRowGripTarget(row.index)"
    >
      <ElDropdown
        :visible="rowMenuShow && rowMenuIndex === row.index"
        trigger="click"
        placement="right-start"
        popper-class="tvp-table-grip-dropdown"
        @visible-change="(visible: boolean) => onRowMenuShow(visible, row.index)"
        @command="runRowCmd"
      >
        <span class="tvp-table-grip__icon" aria-label="行操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="addUp"><span class="tvp-menu-item"><Plus :size="14" />在上方插入</span></ElDropdownItem>
            <ElDropdownItem command="addDown"><span class="tvp-menu-item"><Plus :size="14" />在下方插入</span></ElDropdownItem>
            <ElDropdownItem command="moveUp"><span class="tvp-menu-item"><ArrowUp :size="14" />上移</span></ElDropdownItem>
            <ElDropdownItem command="moveDown"><span class="tvp-menu-item"><ArrowDown :size="14" />下移</span></ElDropdownItem>
            <ElDropdownItem command="delete" divided><span class="tvp-menu-item"><Trash2 :size="14" />删除</span></ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>

    <!-- 列抓手(表格上外侧)-->
    <div
      v-for="col in activeGripPos.cols"
      :key="'col-' + col.index"
      class="tvp-table-grip tvp-table-grip--col"
      :class="{ 'is-active': col.index === hoverCol || col.index === colMenuIndex }"
      :style="{ left: col.left + 'px', top: col.top + 'px', width: col.width + 'px' }"
      @mouseenter="onColGripEnter(col.index)"
      @mousedown.stop.prevent="lockColGripTarget(col.index)"
    >
      <ElDropdown
        :visible="colMenuShow && colMenuIndex === col.index"
        trigger="click"
        placement="top-start"
        popper-class="tvp-table-grip-dropdown"
        @visible-change="(visible: boolean) => onColMenuShow(visible, col.index)"
        @command="runColCmd"
      >
        <span class="tvp-table-grip__icon" aria-label="列操作菜单">
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
          <span class="tvp-table-grip__dot" />
        </span>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="addLeft"><span class="tvp-menu-item"><Plus :size="14" />在左侧插入</span></ElDropdownItem>
            <ElDropdownItem command="addRight"><span class="tvp-menu-item"><Plus :size="14" />在右侧插入</span></ElDropdownItem>
            <ElDropdownItem command="moveLeft"><span class="tvp-menu-item"><ArrowUp :size="14" :style="'transform:rotate(-90deg)'" />左移</span></ElDropdownItem>
            <ElDropdownItem command="moveRight"><span class="tvp-menu-item"><ArrowDown :size="14" :style="'transform:rotate(-90deg)'" />右移</span></ElDropdownItem>
            <ElDropdownItem command="delete" divided><span class="tvp-menu-item"><Trash2 :size="14" />删除</span></ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>
  </div>
</template>

<style scoped>
/* 抓手容器:不生成盒子,只为给引擎提供 fixed 包含块的探测起点 */
.tvp-table-grip-layer {
  display: contents;
}

/* 抓手:fixed 浮层(坐标已按包含块祖先换算),不受 content-wrap overflow 裁剪。 */
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
/* 图标颜色强制指定,避免 ElDropdown 触发器样式或继承把图标吃掉 */
.tvp-table-grip__icon {
  display: grid;
  grid-template-columns: repeat(2, 2.5px);
  grid-template-rows: repeat(2, 2.5px);
  gap: 3px;
  place-content: center;
  width: 28px;
  height: 28px;
  color: #595959; /* 明确的深灰,不依赖 CSS 变量继承 */
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
/* Dropdown 触发器只包住 4 点附近,但比点阵本身大,避免要求精确点中。 */
.tvp-table-grip :deep(.el-dropdown) {
  width: 28px;
  height: 28px;
}
.tvp-table-grip:hover {
  background: transparent;
}
.tvp-table-grip:hover .tvp-table-grip__icon {
  color: var(--el-color-primary, #409eff);
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

:global(.tvp-table-grip-dropdown .el-dropdown-menu) {
  min-width: 150px;
  padding: 6px 0;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu__item) {
  min-height: 38px;
  padding: 8px 18px;
  color: var(--el-text-color-regular, #606266);
  font-size: 14px;
  line-height: 20px;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu__item--divided) {
  margin-top: 6px;
}

:global(.tvp-table-grip-dropdown .el-dropdown-menu__item--divided::before) {
  margin: 0 -18px 6px;
}

:global(.tvp-table-grip-dropdown .tvp-menu-item) {
  line-height: 20px;
}

/* 行抓手:竖条状,宽度固定,高度跟随行高 */
.tvp-table-grip--row {
  width: 22px;
  background: transparent;
}
.tvp-table-grip--row:hover {
  background: transparent;
}
/* 列抓手:横条状,高度固定,宽度跟随列宽 */
.tvp-table-grip--col {
  height: 22px;
  background: transparent;
}
.tvp-table-grip--col:hover {
  background: transparent;
}
</style>
