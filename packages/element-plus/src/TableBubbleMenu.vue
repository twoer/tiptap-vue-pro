<script setup lang="ts">
import { ref, onBeforeUnmount, computed } from 'vue'
import { ElButton, ElDropdown, ElDropdownMenu, ElDropdownItem, ElTooltip, ElIcon } from 'element-plus'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import {
  Combine, Split,
  TableProperties, Trash2,
} from 'lucide-vue-next'
import type { Editor } from '@tiptap/vue-3'
import { useEditorPluginRegistration, type ProEditorContext } from 'tiptap-vue-pro-core'

/**
 * 表格气泡菜单:光标进入表格单元格时,浮在表格上方的操作工具条。
 *
 * 为什么单独做一个气泡(而不是放顶部工具栏):
 * 表格常出现在文档任意位置(尤其底部),放顶部工具栏意味着用户要上下滚动才能操作,
 * 极反人类。Notion / 飞书 / Google Docs 都用「就近浮窗」——操作入口贴着表格本身。
 *
 * 实现要点:
 * - 复用文字气泡的 BubbleMenuPlugin 机制,但用独立 pluginKey('proTableBubble')区分。
 *   一个 editor 可注册多个 BubbleMenuPlugin 实例,互不干扰。
 * - shouldShow:只要「光标在表格内」就显示(不要求非空选区)。点进任意单元格即弹。
 * - 与文字气泡互斥:文字气泡的 shouldShow 增加 !inTable 条件(见 BubbleMenu.vue),
 *   避免在表格内选文字时两个气泡同时弹出。
 *
 * UI 设计:一排常用按钮(增删行列,最常用,一步到位)+ 末尾一个「更多」下拉
 * (合并/拆分/表头切换/删除整表,低频操作收起,避免工具条过宽)。
 */
const props = defineProps<{
  editor: Editor | undefined
  ctx: ProEditorContext
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
const moreOps = [
  { op: 'toggleHeaderRow' as TableOp, icon: TableProperties, text: '首行为表头' },
  { op: 'toggleHeaderColumn' as TableOp, icon: TableProperties, text: '首列为表头' },
  { op: 'deleteTable' as TableOp, icon: Trash2, text: '删除表格' },
]

useEditorPluginRegistration({
  getEditor: () => props.editor,
  getElement: () => rootEl.value,
  pluginKey: 'proTableBubble',
  createPlugin: (ed, element) => BubbleMenuPlugin({
    pluginKey: 'proTableBubble',
    editor: ed,
    element,
    updateDelay: 100,
    shouldShow: ({ state }) => {
      // 选区菜单:只在「选中多格可合并」或「光标在合并格可拆分」时浮现。
      // 增删行列已交给飞书式抓手(TableGripHandles),不在此重复。
      // 判定逻辑与 core 的 tableState.canMerge/canSplit 一致,但 BubbleMenuPlugin
      // 的 shouldShow 拿不到 ctx,这里独立解析一次。
      const sel = state.selection
      const cellAt = ($r: { depth: number; node: (d: number) => unknown }): { attrs: { colspan?: number; rowspan?: number } } | null => {
        for (let d = $r.depth; d > 0; d--) {
          const node = $r.node(d) as { type: { name: string }; attrs: { colspan?: number; rowspan?: number } }
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') return node
        }
        return null
      }
      const fromCell = cellAt(sel.$from)
      const toCell = cellAt(sel.$to)
      const canMerge = !!fromCell && !!toCell && fromCell !== toCell
      const attrs = fromCell?.attrs ?? { colspan: 1, rowspan: 1 }
      const canSplit = (attrs.colspan ?? 1) > 1 || (attrs.rowspan ?? 1) > 1
      return canMerge || canSplit
    },
  }),
})

onBeforeUnmount(() => {
  clearDestructiveTimer()
})
</script>

<template>
  <div ref="rootEl" class="tvp-table-bubble">
    <!-- 选区菜单:选中多格/合并格时浮现。增删行列交给抓手,这里只做合并/拆分 + 表头/删表 -->
    <ElTooltip :teleported="false" v-if="tableState.canMerge" content="合并单元格" placement="top" :show-after="400" :persistent="false">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.mergeCells()"><Combine :size="15" /></ElButton>
    </ElTooltip>
    <ElTooltip :teleported="false" v-if="tableState.canSplit" content="拆分单元格" placement="top" :show-after="400" :persistent="false">
      <ElButton text class="tvp-icon-btn" @click="ctx.commands.splitCell()"><Split :size="15" /></ElButton>
    </ElTooltip>

    <span v-if="tableState.canMerge || tableState.canSplit" class="tvp-table-bubble__sep" />

    <!-- 低频操作:表头/删除整表(始终可用,收进下拉)-->
    <ElDropdown v-model:visible="moreMenuShow" trigger="click" @command="run">
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
  /* 默认隐藏,由 BubbleMenuPlugin 通过 inline style 接管显隐(显示时设 display:flex)。
     若用 display:flex 默认显示且无 position 定位,插件未接管时会裸露在文档流里
     成了「固定操作栏」。文字气泡 .tvp-bubble 同样用 display:none 兜底。 */
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
</style>
