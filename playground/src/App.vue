<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import type { ToolbarConfig } from 'tiptap-vue-pro-core'
// 生产级图片上传示例:XHR 真实上传 + 进度条 + 三态提示,详见文件内注释
import { uploadImage } from './uploadImage'
// HTML 美化:用 DOMParser 解析 + 递归序列化,把紧凑 HTML 格式化成带缩进可读形式
import { formatHTML } from './formatHTML'

// ---- hash 路由:用 location.hash 区分 UI 适配页(#/element-plus | #/naive)----
// 选 hash 而非 history:GitHub Pages 下 history 刷新会 404,hash 天然可刷新可分享。
type UiKey = 'element-plus' | 'naive'
function readHashRoute(): UiKey {
  const h = location.hash.replace(/^#\/?/, '')
  return h === 'naive' ? 'naive' : 'element-plus'
}
const route = ref<UiKey>(readHashRoute())

// 编辑器内容:覆盖主要能力(标题/格式化/颜色/对齐/列表/任务/引用/代码块/表格)
function createDemoContent(uiName: string) {
  return (
    '<h2>你好,tiptap-vue-pro 👋</h2>' +
    `<p>这是一个基于 <strong>Tiptap v3</strong> + <em>${uiName}</em> 的富文本编辑器组件。</p>` +
    '<p><span style="color: #e0398b">文字颜色</span>、<mark data-color="#fff3b0">背景高亮</mark>、<u>下划线</u>、<s>删除线</s> 都开箱即用。</p>' +
    '<p style="text-align: center">← 这一行是居中对齐 →</p>' +
    '<ul><li>开箱即用的工具栏</li><li>图片上传 / 粘贴 / 拖拽</li><li>表格、代码块、列表、任务列表</li></ul>' +
    '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>试试顶部的开关切换演示</p></div></li>' +
    '<li data-checked="true"><label><input type="checkbox" checked=""><span></span></label><div><p>已完成项会有删除线</p></div></li></ul>' +
    '<blockquote>选中文字会浮现气泡菜单(加粗/斜体/链接...)。</blockquote>' +
    '<pre><code>const editor = useProEditor({ content })\n// 开箱即用的 Tiptap v3 封装</code></pre>' +
    '<table><tbody><tr><th>功能</th><th>状态</th></tr><tr><td>表格</td><td>OK</td></tr></tbody></table>' +
    '<h3>图片功能(对标飞书)</h3>' +
    '<p>点击下方图片选中 → 浮现工具条:拖拽四角调整大小、切换左/中/右对齐、编辑题注、替换、删除。</p>' +
    '<img src="https://avatars.githubusercontent.com/u/7254263" data-align="center" data-caption="示例图片:点击我试试调整大小与对齐" width="320">'
  )
}

const content = ref(createDemoContent(route.value === 'naive' ? 'Naive UI' : 'Element Plus'))
function syncRoute() {
  route.value = readHashRoute()
}
onMounted(() => {
  syncRoute()
  window.addEventListener('hashchange', syncRoute)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', syncRoute))

// 演示开关
const dark = ref(false)
const readonly = ref(false)
const showWordCount = ref(true)
const compactToolbar = ref(false)
const output = ref<'html' | 'json'>('html')
const currentUiName = computed(() => (route.value === 'naive' ? 'Naive UI' : 'Element Plus'))
const currentUiPackage = computed(() =>
  route.value === 'naive' ? 'tiptap-vue-pro-naive' : 'tiptap-vue-pro-element-plus',
)
const toolbarConfig = computed<ToolbarConfig | undefined>(() =>
  compactToolbar.value
    ? [
        ['undo', 'redo'],
        ['bold', 'italic', 'underline'],
        ['link', 'image'],
      ]
    : undefined,
)

function resetDemoContent() {
  content.value = createDemoContent(currentUiName.value)
}

// 暗色模式:
// - Element Plus 版:切 html.dark,让 EP 全局暗色 + 本页暗色样式生效
// - Naive 版:组件级 dark prop 接管(不依赖 html.dark),但仍切本页暗色背景
watch(
  dark,
  (v) => {
    document.documentElement.classList.toggle('dark', v)
  },
  { immediate: true },
)

// 输出预览:两种模式都格式化好看一点
// - json:JSON.stringify 带 2 空格缩进
// - html:用 formatHTML 把紧凑标签拆成带缩进的树状结构
const outputPreview = computed(() => {
  const v = content.value
  if (output.value === 'json' && typeof v === 'object') {
    return JSON.stringify(v, null, 2)
  }
  return formatHTML(v as string)
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
      <div class="page__title">
        <p class="page__eyebrow">Playground</p>
        <h1>Tiptap Vue Pro</h1>
        <p>Vue3 + Tiptap v3 的富文本编辑器社区封装。</p>
      </div>
      <div class="page__meta">
        <span class="status-pill">{{ currentUiName }}</span>
        <code>{{ currentUiPackage }}</code>
        <a class="page__link" href="https://github.com/twoer/tiptap-vue-pro" target="_blank">
          GitHub →
        </a>
      </div>
    </header>

    <!-- UI 适配页导航:hash 路由,可刷新可分享 -->
    <nav class="ui-nav">
      <a href="#/element-plus" class="ui-nav__item" :class="{ 'is-active': route === 'element-plus' }">
        Element Plus
      </a>
      <a href="#/naive" class="ui-nav__item" :class="{ 'is-active': route === 'naive' }">
        Naive UI
      </a>
    </nav>

    <!--
      演示开关:展示组件的几个 prop。
      用原生控件(checkbox / select),不依赖任何 UI 库——
      这样 EP 页和 Naive 页的外观完全一致,且暗色下统一跟随 html.dark。
    -->
    <section class="demo-toolbar" aria-label="Playground controls">
      <div class="demo-toolbar__group">
        <label class="control control--switch">
          <input v-model="dark" type="checkbox" class="toggle" />
          <span>暗色</span>
        </label>
        <label class="control control--switch">
          <input v-model="readonly" type="checkbox" class="toggle" />
          <span>只读</span>
        </label>
        <label class="control control--switch">
          <input v-model="showWordCount" type="checkbox" class="toggle" />
          <span>字数</span>
        </label>
        <label class="control control--switch">
          <input v-model="compactToolbar" type="checkbox" class="toggle" />
          <span>精简工具栏</span>
        </label>
      </div>
      <div class="demo-toolbar__group demo-toolbar__group--right">
        <label class="control">
          <span>输出</span>
          <select v-model="output" class="native-select">
            <option value="html">HTML</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <button type="button" class="reset-btn" @click="resetDemoContent">
          重置示例
        </button>
      </div>
    </section>

    <main class="workbench">
      <section class="demo demo--editor">
        <div class="demo__head">
          <h3>编辑器</h3>
          <span v-if="readonly" class="state-badge">只读</span>
        </div>
        <!--
          两个 UI 适配各占一个「页面」,用 hash 路由切换。
          两版 props 对等、共享同一份 content(v-model 互通),只挂载当前路由对应的那一个,
          避免 EP(全局 html.dark 暗色)与 Naive(组件级 NConfigProvider 暗色)同屏混用。
          v-if 而非 v-show:非当前页的编辑器实例不创建,互不干扰。
        -->
        <ProEditorElementPlus
          v-if="route === 'element-plus'"
          v-model="content"
          :output="output"
          :dark="dark"
          :readonly="readonly"
          :show-word-count="showWordCount"
          :toolbar="toolbarConfig"
          placeholder="开始输入..."
          :upload-image="uploadImage"
        />
        <ProEditorNaive
          v-else
          v-model="content"
          :output="output"
          :dark="dark"
          :readonly="readonly"
          :show-word-count="showWordCount"
          :toolbar="toolbarConfig"
          placeholder="开始输入..."
          :upload-image="uploadImage"
        />
      </section>

      <section class="demo demo--output">
        <div class="demo__head">
          <h3>输出 · {{ output.toUpperCase() }}</h3>
          <button class="copy-btn" @click="copyOutput">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <pre class="output">{{ outputPreview }}</pre>
      </section>
    </main>

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
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 18px;
}

.page__title {
  min-width: 0;
}

.page__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  color: #409eff;
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

.page__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.page__meta code {
  padding: 3px 6px;
  border-radius: 4px;
  background: #eef0f3;
  color: #606266;
  font-size: 12px;
}

.page__link {
  font-size: 12px;
  color: #409eff;
  text-decoration: none;
}

.page__link:hover {
  text-decoration: underline;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
  font-weight: 700;
}

html.dark .page__meta code {
  background: #2a2a2b;
  color: #cfd3dc;
}

html.dark .status-pill {
  background: #18222c;
  color: #79bbff;
}

/*
 * UI 适配页导航:做成 segmented control(分段式)风格。
 * 整体是一个带圆角浅灰底色的胶囊容器,两个 tab 像在轨道里,
 * active 态白色凸起卡片 + 阴影,inactive 态透明——对比强烈,一眼看出能切换。
 * 这是 iOS 设置 / 飞书 / 多数 SaaS 后台通用的导航范式。
 * 用固定色 + html.dark,不依赖任何 UI 库变量(EP 页/Naive 页一致)。
 */
.ui-nav {
  display: inline-flex;
  gap: 2px;
  margin-bottom: 20px;
  padding: 3px;
  background: #eef0f3;
  border-radius: 8px;
}

.ui-nav__item {
  /* 比普通文字行更大,保证视觉权重 + 触摸击中区 */
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}

.ui-nav__item:hover:not(.is-active) {
  color: #409eff;
}

.ui-nav__item.is-active {
  /* 白色凸起卡片:浅灰轨道上的高对比块 */
  color: #409eff;
  background: #fff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

html.dark .ui-nav {
  background: #2a2a2b;
}

html.dark .ui-nav__item {
  color: #cfd3dc;
}

html.dark .ui-nav__item.is-active {
  color: #79bbff;
  background: #1d1e1f;
}

/*
 * 开关区:不依赖任何 UI 库,用固定色 + html.dark 切暗色,
 * 保证 EP 页和 Naive 页外观完全一致。
 */
.demo-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px;
  margin-bottom: 18px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  font-size: 13px;
}

.demo-toolbar__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.demo-toolbar__group--right {
  justify-content: flex-start;
}

html.dark .demo-toolbar {
  background: #1d1e1f;
  border-color: #363637;
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #606266;
}

html.dark .control {
  color: #cfd3dc;
}

/* iOS 风格 toggle 开关:隐藏原生 checkbox,用 label + 伪元素画滑块 */
.toggle {
  /* 隐藏原生框,保留可点击/键盘可达 */
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  border-radius: 11px;
  background: #c0c4cc;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

/* 滑块圆点 */
.toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

/* 勾选:轨道变主题色,圆点滑到右边 */
.toggle:checked {
  background: #409eff;
}

.toggle:checked::after {
  transform: translateX(16px);
}

html.dark .toggle {
  background: #414243;
}

/* 原生 select:去默认箭头画一个,跟整体风格统一 */
.native-select {
  width: 160px;
  padding: 6px 10px;
  font-size: 14px;
  color: #606266;
  background: #fff
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23909399' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  /*
   * appearance:none 去掉原生下拉箭头,让我们画的 SVG 箭头可见。
   * padding-right 留出箭头空间,避免文字盖住。
   */
  -webkit-appearance: none;
  appearance: none;
  padding-right: 32px;
  cursor: pointer;
  outline: none;
}

.native-select:focus {
  border-color: #409eff;
}

html.dark .native-select {
  color: #cfd3dc;
  background-color: #1d1e1f;
  border-color: #414243;
}

.reset-btn {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  font: inherit;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.reset-btn:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background: #ecf5ff;
}

html.dark .reset-btn {
  background: #1d1e1f;
  border-color: #414243;
  color: #cfd3dc;
}

html.dark .reset-btn:hover {
  color: #79bbff;
  border-color: #409eff;
  background: #18222c;
}

.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}

.demo {
  min-width: 0;
  margin-bottom: 24px;
}

.demo--output {
  min-width: 0;
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
  gap: 12px;
  margin-bottom: 12px;
}

.demo__head h3 {
  margin: 0;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f4f4f5;
  color: #909399;
  font-size: 12px;
  font-weight: 600;
}

html.dark .state-badge {
  background: #2a2a2b;
  color: #a3a6ad;
}

.copy-btn {
  min-width: 64px;
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
  margin: 10px 0 0;
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  line-height: 1.6;
  overflow: auto;
  /* 移动端:输出区矮一点,留出编辑器空间 */
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-word;
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
  .demo-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
  }
  .demo-toolbar__group--right {
    justify-content: flex-end;
  }
  .demo h3 {
    font-size: 15px;
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
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .page__meta {
    justify-content: flex-end;
  }
  .page__header h1 {
    font-size: 26px;
  }
  .output {
    padding: 16px;
    max-height: 320px;
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

@media (min-width: 1180px) {
  .page {
    max-width: 1280px;
  }

  .workbench {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 460px);
    align-items: start;
  }

  .demo--output {
    position: sticky;
    top: 24px;
  }

  .output {
    max-height: calc(100vh - 180px);
  }
}

/* —— xl ≥1280px:大屏,上限封顶避免过宽 —— */
@media (min-width: 1280px) {
  .page {
    max-width: 1440px;
    padding: 56px 32px 72px;
  }
}

/* —— 2xl ≥1600px:充分利用大屏,但仍保留阅读宽度上限 —— */
@media (min-width: 1600px) {
  .page {
    max-width: 1600px;
  }

  .workbench {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 520px);
  }
}
</style>
