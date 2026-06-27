<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElSwitch, ElSelect, ElOption } from 'element-plus'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
// 生产级图片上传示例:XHR 真实上传 + 进度条 + 三态提示,详见文件内注释
import { uploadImage } from './uploadImage'

// 编辑器内容:覆盖主要能力(标题/格式化/颜色/对齐/列表/任务/引用/代码块/表格)
const content = ref(
  '<h2>你好,tiptap-vue-pro 👋</h2>' +
    '<p>这是一个基于 <strong>Tiptap v3</strong> + <em>Element Plus</em> 的富文本编辑器组件。</p>' +
    '<p><span style="color: #e0398b">文字颜色</span>、<mark data-color="#fff3b0">背景高亮</mark>、<u>下划线</u>、<s>删除线</s> 都开箱即用。</p>' +
    '<p style="text-align: center">← 这一行是居中对齐 →</p>' +
    '<ul><li>开箱即用的工具栏</li><li>图片上传 / 粘贴 / 拖拽</li><li>表格、代码块、列表、任务列表</li></ul>' +
    '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>试试顶部的开关切换演示</p></div></li>' +
    '<li data-checked="true"><label><input type="checkbox" checked=""><span></span></label><div><p>已完成项会有删除线</p></div></li></ul>' +
    '<blockquote>选中文字会浮现气泡菜单(加粗/斜体/链接…)。</blockquote>' +
    '<pre><code>const editor = useProEditor({ content })\n// 开箱即用的 Tiptap v3 封装</code></pre>' +
    '<table><tbody><tr><th>功能</th><th>状态</th></tr><tr><td>表格</td><td>✅</td></tr></tbody></table>',
)

// 演示开关
const dark = ref(false)
const readonly = ref(false)
const output = ref<'html' | 'json'>('html')

// 暗色模式:切 html.dark,让 EP 所有组件 + 本页样式统一暗色
watch(
  dark,
  (v) => {
    document.documentElement.classList.toggle('dark', v)
  },
  { immediate: true },
)

// 输出预览:json 模式下格式化好看一点
const outputPreview = computed(() => {
  const v = content.value
  return output.value === 'json' && typeof v === 'object'
    ? JSON.stringify(v, null, 2)
    : (v as string)
})

// 复制按钮
const copied = ref(false)
async function copyOutput() {
  try {
    await navigator.clipboard.writeText(outputPreview.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // 剪贴板权限被拒时静默失败
  }
}
</script>

<template>
  <div class="page">
    <header class="page__header">
      <h1>tiptap-vue-pro</h1>
      <p>Vue3 + Tiptap v3 + Element Plus 的富文本编辑器(非官方社区项目)</p>
      <a class="page__link" href="https://github.com/twoer/tiptap-vue-pro" target="_blank">
        GitHub →
      </a>
    </header>

    <!-- 演示开关:展示组件的几个 prop -->
    <section class="controls">
      <div class="control">
        <ElSwitch v-model="dark" /> 暗色模式
      </div>
      <div class="control">
        <ElSwitch v-model="readonly" /> 只读
      </div>
      <div class="control">
        输出格式:
        <ElSelect v-model="output" class="control__select">
          <ElOption value="html" label="html" />
          <ElOption value="json" label="json" />
        </ElSelect>
      </div>
    </section>

    <section class="demo">
      <h3>编辑器</h3>
      <ProEditorElementPlus
        v-model="content"
        :output="output"
        :dark="dark"
        :readonly="readonly"
        placeholder="开始输入..."
        :upload-image="uploadImage"
      />
    </section>

    <section class="demo">
      <div class="demo__head">
        <h3>输出({{ output }})</h3>
        <button class="copy-btn" @click="copyOutput">
          {{ copied ? '已复制 ✓' : '复制' }}
        </button>
      </div>
      <pre class="output">{{ outputPreview }}</pre>
    </section>

    <footer class="page__footer">
      MIT · 基于 Tiptap v3 的社区封装
    </footer>
  </div>
</template>

<style>
/*
 * 响应式策略:mobile-first。
 * 基础样式 = 移动端(≤640px);逐级用 min-width 增强,断点对齐 Tailwind:
 *   sm 640 / md 768 / lg 1024 / xl 1280
 * 基础样式不写死大 padding/字号,增强档逐步放大。
 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #303133;
  transition: background 0.2s, color 0.2s;
}

/* 暗色:html.dark 时整页背景色跟着变,EP 组件由 css-vars.css 接管 */
html.dark body {
  background: #141414;
  color: #e5eaf3;
}

/* —— 移动端基础 —— */
.page {
  /* 移动端:小 padding,贴近视口 */
  padding: 20px 14px 40px;
}

.page__header {
  margin-bottom: 20px;
}

.page__header h1 {
  margin: 0 0 6px;
  font-size: 22px;
}

.page__header p {
  margin: 0 0 10px;
  color: #909399;
  font-size: 13px;
  line-height: 1.5;
}

html.dark .page__header p {
  color: #a3a6ad;
}

.page__link {
  font-size: 12px;
  color: #409eff;
  text-decoration: none;
}

.page__link:hover {
  text-decoration: underline;
}

/* 开关区:移动端纵向堆叠,占满宽度 */
.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 20px;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 6px;
  font-size: 13px;
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ElSelect 在开关行内不要撑太宽 */
.control__select {
  width: 110px;
}

.demo {
  margin-bottom: 24px;
}

.demo h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #606266;
}

html.dark .demo h3 {
  color: #cfd3dc;
}

.demo__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo__head h3 {
  margin: 0;
}

.copy-btn {
  padding: 4px 12px;
  font-size: 12px;
  color: #606266;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.copy-btn:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background: #ecf5ff;
}

html.dark .copy-btn {
  color: #cfd3dc;
}

html.dark .copy-btn:hover {
  color: #79bbff;
  border-color: #409eff;
  background: #18222c;
}

.output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  overflow-x: auto;
  /* 移动端:输出区矮一点,留出编辑器空间 */
  max-height: 200px;
  white-space: pre-wrap;
  word-break: break-all;
}

.page__footer {
  margin-top: 32px;
  padding-top: 18px;
  border-top: 1px solid var(--el-border-color-light, #ebeef5);
  font-size: 12px;
  color: #909399;
  text-align: center;
}

html.dark .page__footer {
  color: #a3a6ad;
}

/* —— sm ≥640px:小平板/大手机横屏 —— */
@media (min-width: 640px) {
  .page {
    padding: 28px 20px 48px;
  }
  .page__header h1 {
    font-size: 24px;
  }
  .page__header p {
    font-size: 14px;
  }
  /* 开关区:横向排,但允许换行 */
  .controls {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 14px;
  }
  .demo h3 {
    font-size: 15px;
  }
  .output {
    max-height: 240px;
  }
}

/* —— md ≥768px:平板竖屏 —— */
@media (min-width: 768px) {
  .page {
    /* 开始居中限宽 */
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 24px 56px;
  }
  .page__header {
    margin-bottom: 24px;
  }
  .page__header h1 {
    font-size: 26px;
  }
  .output {
    padding: 16px;
    max-height: 280px;
  }
}

/* —— lg ≥1024px:桌面 —— */
@media (min-width: 1024px) {
  .page {
    max-width: 860px;
    padding: 44px 32px 64px;
  }
  .page__header h1 {
    font-size: 28px;
  }
  .page__header {
    margin-bottom: 28px;
  }
  .demo {
    margin-bottom: 28px;
  }
}

/* —— xl ≥1280px:大屏,上限封顶避免过宽 —— */
@media (min-width: 1280px) {
  .page {
    max-width: 920px;
    padding: 56px 32px 72px;
  }
}
</style>
