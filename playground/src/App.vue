<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import type { AutosaveOptions, EditorBehaviorOptions, LocalDraftOptions, LocaleCode } from 'tiptap-vue-pro-core'
// 生产级图片上传示例:XHR 真实上传 + 进度条 + 三态提示,详见文件内注释
import { IMAGE_UPLOAD_MAX_SIZE, uploadImage } from './uploadImage'
import { MEDIA_UPLOAD_MAX_SIZE, uploadAsset } from './uploadAsset'
// HTML 美化:用 DOMParser 解析 + 递归序列化,把紧凑 HTML 格式化成带缩进可读形式
import { formatHTML } from './formatHTML'
import {
  isScenarioKey,
  playgroundScenarios,
  scenarioOrder,
  type ScenarioKey,
} from './scenarios'

// ---- hash 路由:用 location.hash 区分 UI 适配页(#/element-plus | #/naive | #/ant-design-vue)----
// 选 hash 而非 history:GitHub Pages 下 history 刷新会 404,hash 天然可刷新可分享。
type UiKey = 'element-plus' | 'naive' | 'ant-design-vue'
function readHashRoute(): UiKey {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0]
  if (h === 'ant-design-vue') return 'ant-design-vue'
  return h === 'naive' ? 'naive' : 'element-plus'
}
const route = ref<UiKey>(readHashRoute())

function readHashScenario(): ScenarioKey {
  const query = location.hash.split('?')[1] ?? ''
  const scenario = new URLSearchParams(query).get('scenario')
  return scenario && isScenarioKey(scenario) ? scenario : 'basic'
}

const selectedScenarioKey = ref<ScenarioKey>(readHashScenario())
const initialScenario = playgroundScenarios[selectedScenarioKey.value]

const autosaveEnabled = ref(initialScenario.defaults.autosaveEnabled ?? true)
const draftEnabled = ref(initialScenario.defaults.draftEnabled ?? true)
const simulateAutosaveFailure = ref(false)
let autosaveAttemptCount = 0
let autosaveSuccessCount = 0
let lastSavedContent: string | object | null = null

async function simulateAutosave(value: string | object) {
  autosaveAttemptCount += 1
  await new Promise(resolve => setTimeout(resolve, 300))
  if (simulateAutosaveFailure.value) throw new Error('Simulated autosave failure')
  autosaveSuccessCount += 1
  lastSavedContent = value
}

const autosaveOptions = computed<false | AutosaveOptions<string | object>>(() => (
  autosaveEnabled.value
    ? {
        key: `${route.value}-${selectedScenarioKey.value}`,
        delay: 400,
        onSave: simulateAutosave,
      }
    : false
))
const draftOptions = computed<false | LocalDraftOptions<string | object>>(() => (
  draftEnabled.value
    ? { key: `playground-${route.value}-${selectedScenarioKey.value}`, delay: 200 }
    : false
))

interface AutosavePlaygroundDebug {
  getAttemptCount: () => number
  getSuccessCount: () => number
  getLastSavedContent: () => string | object | null
  reset: () => void
}

const debugWindow = window as Window & {
  __TVP_AUTOSAVE__?: AutosavePlaygroundDebug
}

function syncRoute() {
  route.value = readHashRoute()
  selectedScenarioKey.value = readHashScenario()
}
onMounted(() => {
  syncRoute()
  window.addEventListener('hashchange', syncRoute)
  debugWindow.__TVP_AUTOSAVE__ = {
    getAttemptCount: () => autosaveAttemptCount,
    getSuccessCount: () => autosaveSuccessCount,
    getLastSavedContent: () => lastSavedContent,
    reset: () => {
      autosaveAttemptCount = 0
      autosaveSuccessCount = 0
      lastSavedContent = null
    },
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRoute)
  delete debugWindow.__TVP_AUTOSAVE__
})

// 演示开关
const dark = ref(false)
const readonly = ref(initialScenario.defaults.readonly ?? false)
const showWordCount = ref(true)
const compactToolbar = ref(initialScenario.defaults.compactToolbar ?? true)
const output = ref<'html' | 'json'>(initialScenario.defaults.output ?? 'html')
const locale = ref<LocaleCode>('zh-CN')
const playgroundText = computed(() => {
  if (locale.value === 'en-US') {
    return {
      dark: 'Dark',
      readonly: 'Read only',
      wordCount: 'Word count',
      compactToolbar: 'Compact toolbar',
      autosave: 'Autosave',
      autosaveFailure: 'Fail saves',
      drafts: 'Local drafts',
      scenario: 'Scenario',
      viewDocs: 'View recipe',
      language: 'Language',
      output: 'Output',
      reset: 'Reset demo',
      editor: 'Editor',
      copied: 'Copied',
      copy: 'Copy',
      readonlyBadge: 'Read only',
      placeholder: 'Start typing...',
      footer: 'MIT · Community package based on Tiptap v3',
    }
  }
  return {
    dark: '暗色',
    readonly: '只读',
    wordCount: '字数',
    compactToolbar: '精简工具栏',
    autosave: '自动保存',
      autosaveFailure: '模拟失败',
      drafts: '本地草稿',
      scenario: '场景',
      viewDocs: '查看文档',
      language: '语言',
    output: '输出',
    reset: '重置示例',
    editor: '编辑器',
    copied: '已复制',
    copy: '复制',
    readonlyBadge: '只读',
    placeholder: '开始输入...',
    footer: 'MIT · 基于 Tiptap v3 的社区封装',
  }
})
const currentUiName = computed(() => {
  if (route.value === 'naive') return 'Naive UI'
  if (route.value === 'ant-design-vue') return 'Ant Design Vue'
  return 'Element Plus'
})
const currentUiPackage = computed(() =>
  route.value === 'naive'
    ? 'tiptap-vue-pro-naive'
    : route.value === 'ant-design-vue'
      ? 'tiptap-vue-pro-ant-design-vue'
      : 'tiptap-vue-pro-element-plus',
)
const currentEditorComponent = computed(() => {
  if (route.value === 'naive') return ProEditorNaive
  if (route.value === 'ant-design-vue') return ProEditorAntDesignVue
  return ProEditorElementPlus
})
const currentScenario = computed(() => playgroundScenarios[selectedScenarioKey.value])
const content = ref(initialScenario.createContent(
  route.value === 'naive'
    ? 'Naive UI'
    : route.value === 'ant-design-vue'
      ? 'Ant Design Vue'
      : 'Element Plus',
))
const scenarioTitle = computed(() =>
  locale.value === 'en-US' ? currentScenario.value.enTitle : currentScenario.value.zhTitle,
)
const scenarioDescription = computed(() =>
  locale.value === 'en-US'
    ? currentScenario.value.enDescription
    : currentScenario.value.zhDescription,
)
const docsBase = import.meta.env.BASE_URL.includes('/playground/')
  ? import.meta.env.BASE_URL.replace(/playground\/$/, '')
  : '/'
const scenarioDocsHref = computed(() => {
  const localizedPath = locale.value === 'en-US'
    ? `en/${currentScenario.value.docsPath}`
    : currentScenario.value.docsPath
  return `${docsBase}${localizedPath}`
})

function buildHash(ui: UiKey, scenario: ScenarioKey = selectedScenarioKey.value) {
  return `#/${ui}?scenario=${scenario}`
}

function selectUi(ui: UiKey) {
  if (ui === route.value) return
  location.hash = buildHash(ui)
}

function selectScenario(key: ScenarioKey) {
  if (key === selectedScenarioKey.value) return
  location.hash = buildHash(route.value, key)
}

function applyScenarioDefaults(key: ScenarioKey) {
  const defaults = playgroundScenarios[key].defaults
  readonly.value = defaults.readonly ?? false
  autosaveEnabled.value = defaults.autosaveEnabled ?? true
  draftEnabled.value = defaults.draftEnabled ?? true
  compactToolbar.value = defaults.compactToolbar ?? true
  output.value = defaults.output ?? 'html'
  simulateAutosaveFailure.value = false
}

function resetDemoContent() {
  applyScenarioDefaults(selectedScenarioKey.value)
  content.value = currentScenario.value.createContent(currentUiName.value)
}

watch(selectedScenarioKey, (key) => {
  applyScenarioDefaults(key)
  content.value = playgroundScenarios[key].createContent(currentUiName.value)
})

const editorBehaviorOptions: EditorBehaviorOptions = {
  image: {
    maxSize: IMAGE_UPLOAD_MAX_SIZE,
    crop: {
      enabled: true,
      aspectRatio: 16 / 9,
      quality: 0.9,
    },
  },
  media: {
    video: {
      maxSize: MEDIA_UPLOAD_MAX_SIZE,
      render: {
        displayMode: 'player',
        controls: true,
        muted: false,
        playsInline: true,
        allowFullscreen: true,
        allowDownload: true,
        allowPictureInPicture: true,
      },
    },
    audio: {
      maxSize: MEDIA_UPLOAD_MAX_SIZE,
      render: {
        displayMode: 'player',
        controls: true,
        allowDownload: true,
      },
    },
    file: {
      maxSize: MEDIA_UPLOAD_MAX_SIZE,
      render: {
        showIcon: true,
        iconMode: 'auto',
        showName: true,
        showSize: true,
        showMimeType: true,
        showUploadedAt: true,
        showDuration: true,
        openInNewTab: true,
        download: true,
      },
    },
  },
}

// 暗色模式:
// - Element Plus 版:切 html.dark,让 EP 全局暗色 + 本页暗色样式生效
// - Naive / Ant 版:组件级 dark prop 接管(不依赖 html.dark),但仍切本页暗色背景
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
      <a
        :href="buildHash('element-plus')"
        class="ui-nav__item"
        :class="{ 'is-active': route === 'element-plus' }"
        @click.prevent="selectUi('element-plus')"
      >
        Element Plus
      </a>
      <a
        :href="buildHash('naive')"
        class="ui-nav__item"
        :class="{ 'is-active': route === 'naive' }"
        @click.prevent="selectUi('naive')"
      >
        Naive UI
      </a>
      <a
        :href="buildHash('ant-design-vue')"
        class="ui-nav__item"
        :class="{ 'is-active': route === 'ant-design-vue' }"
        @click.prevent="selectUi('ant-design-vue')"
      >
        Ant Design Vue
      </a>
    </nav>

    <!--
      演示开关:展示组件的几个 prop。
      用原生控件(checkbox / select),不依赖任何 UI 库——
      这样 EP 页和 Naive 页的外观完全一致,且暗色下统一跟随 html.dark。
    -->
    <section class="demo-toolbar" aria-label="Playground controls">
      <div class="demo-toolbar__group">
        <div class="demo-toolbar__cluster">
          <label class="control control--switch">
            <input v-model="dark" type="checkbox" class="toggle" data-testid="dark-toggle" />
            <span>{{ playgroundText.dark }}</span>
          </label>
          <label class="control control--switch">
            <input v-model="readonly" type="checkbox" class="toggle" />
            <span>{{ playgroundText.readonly }}</span>
          </label>
          <label class="control control--switch">
            <input
              v-model="showWordCount"
              type="checkbox"
              class="toggle"
              data-testid="word-count-toggle"
            />
            <span>{{ playgroundText.wordCount }}</span>
          </label>
          <label class="control control--switch">
            <input v-model="compactToolbar" type="checkbox" class="toggle" />
            <span>{{ playgroundText.compactToolbar }}</span>
          </label>
        </div>
        <div class="demo-toolbar__cluster">
          <label class="control control--switch">
            <input
              v-model="autosaveEnabled"
              type="checkbox"
              class="toggle"
              data-testid="autosave-toggle"
            />
            <span>{{ playgroundText.autosave }}</span>
          </label>
          <label class="control control--switch">
            <input
              v-model="simulateAutosaveFailure"
              type="checkbox"
              class="toggle"
              data-testid="autosave-failure-toggle"
            />
            <span>{{ playgroundText.autosaveFailure }}</span>
          </label>
          <label class="control control--switch">
            <input v-model="draftEnabled" type="checkbox" class="toggle" data-testid="draft-toggle" />
            <span>{{ playgroundText.drafts }}</span>
          </label>
        </div>
      </div>
      <div class="demo-toolbar__group demo-toolbar__group--right">
        <label class="control">
          <span>{{ playgroundText.language }}</span>
          <select v-model="locale" class="native-select native-select--locale">
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <label class="control">
          <span>{{ playgroundText.output }}</span>
          <select v-model="output" class="native-select native-select--output">
            <option value="html">HTML</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <button type="button" class="reset-btn" @click="resetDemoContent">
          {{ playgroundText.reset }}
        </button>
      </div>
    </section>

    <main class="workbench">
      <aside class="scenario-sidebar" aria-label="Playground scenarios">
        <p class="scenario-sidebar__eyebrow">{{ playgroundText.scenario }}</p>
        <div class="scenario-sidebar__list" aria-label="Scenario selector">
          <button
            v-for="key in scenarioOrder"
            :key="key"
            type="button"
            class="scenario-sidebar__item"
            :class="{ 'is-active': selectedScenarioKey === key }"
            @click="selectScenario(key)"
          >
            {{ locale === 'en-US' ? playgroundScenarios[key].enTitle : playgroundScenarios[key].zhTitle }}
          </button>
        </div>
        <div class="scenario-sidebar__detail">
          <h2>{{ scenarioTitle }}</h2>
          <p>{{ scenarioDescription }}</p>
          <a class="scenario-sidebar__docs" :href="scenarioDocsHref" target="_blank" rel="noreferrer">
            {{ playgroundText.viewDocs }} →
          </a>
        </div>
      </aside>

      <section class="demo demo--editor">
        <div class="demo__head">
          <h3>{{ playgroundText.editor }}</h3>
          <span v-if="readonly" class="state-badge">{{ playgroundText.readonlyBadge }}</span>
        </div>
        <!--
          三个 UI 适配各占一个「页面」,用 hash 路由切换。
          三版 props 对等、共享同一份 content(v-model 互通)。
          KeepAlive 缓存已打开过的 adapter,避免切换回来时销毁/重建 Tiptap 实例造成闪烁。
        -->
        <div class="editor-stage">
          <KeepAlive>
            <component
              :is="currentEditorComponent"
              :key="route"
              v-model="content"
              :output="output"
              :dark="dark"
              :readonly="readonly"
              :show-word-count="showWordCount"
              :autosave="autosaveOptions"
              :draft="draftOptions"
              :toolbar-layout="compactToolbar ? 'compact' : 'classic'"
              :locale="locale"
              :placeholder="playgroundText.placeholder"
              :upload-image="uploadImage"
              :upload-asset="uploadAsset"
              :editor-behavior-options="editorBehaviorOptions"
            />
          </KeepAlive>
        </div>
      </section>

      <section class="demo demo--output">
        <div class="demo__head">
          <h3>{{ playgroundText.output }} · {{ output.toUpperCase() }}</h3>
          <!-- <button class="copy-btn" @click="copyOutput">
            {{ copied ? playgroundText.copied : playgroundText.copy }}
          </button> -->
        </div>
        <pre class="output">{{ outputPreview }}</pre>
      </section>
    </main>

    <footer class="page__footer">
      {{ playgroundText.footer }}
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
  padding: 12px 12px 32px;
}

.page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.page__title {
  min-width: 0;
}

.page__eyebrow {
  margin: 0 0 3px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  color: #409eff;
}

.page__header h1 {
  margin: 0 0 4px;
  font-size: 21px;
  line-height: 1.18;
}

.page__header p {
  margin: 0;
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
  gap: 6px;
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
 * 用固定色 + html.dark,不依赖任何 UI 库变量(各 adapter 页面一致)。
 */
.ui-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  margin-bottom: 10px;
  padding: 3px;
  overflow-x: auto;
  background: #eef0f3;
  border-radius: 8px;
}

.ui-nav__item {
  /* 锁定 tab 高度,避免首次加载与切换后因字体/active 状态重算出现高度跳变 */
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  justify-content: center;
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: #606266;
  text-decoration: none;
  border-radius: 6px;
  white-space: nowrap;
  transition: none;
}

.ui-nav__item:hover:not(.is-active) {
  color: #409eff;
}

.ui-nav__item:focus-visible,
.scenario-sidebar__item:focus-visible,
.reset-btn:focus-visible,
.copy-btn:focus-visible,
.native-select:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}

.ui-nav__item:focus-visible {
  outline: 0;
  box-shadow: inset 0 0 0 2px #409eff;
}

.ui-nav__item.is-active {
  /* 白色凸起卡片:浅灰轨道上的高对比块 */
  color: #409eff;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ui-nav__item.is-active:focus-visible {
  box-shadow:
    inset 0 0 0 2px #409eff,
    0 1px 3px rgba(0, 0, 0, 0.1);
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

.scenario-sidebar {
  min-width: 0;
  padding: 2px 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.scenario-sidebar__eyebrow {
  margin: 0 0 8px;
  color: #909399;
  font-size: 12px;
  font-weight: 700;
}

.scenario-sidebar__list {
  display: flex;
  overflow-x: auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding-bottom: 4px;
}

.scenario-sidebar__item {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #606266;
  font: inherit;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.scenario-sidebar__item:hover {
  color: #409eff;
  background: #ecf5ff;
}

.scenario-sidebar__item.is-active {
  position: relative;
  color: #409eff;
  background: #ecf5ff;
}

.scenario-sidebar__item.is-active::before {
  content: '';
  position: absolute;
  inset: 7px auto 7px 0;
  width: 3px;
  border-radius: 999px;
  background: #409eff;
}

.scenario-sidebar__detail {
  display: none;
}

.scenario-sidebar__detail h2 {
  margin: 0 0 6px;
  color: #303133;
  font-size: 16px;
}

.scenario-sidebar__detail p {
  margin: 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.scenario-sidebar__docs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: #409eff;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.scenario-sidebar__docs:hover {
  text-decoration: underline;
}

html.dark .scenario-sidebar {
  background: transparent;
}

html.dark .scenario-sidebar__eyebrow {
  color: #a3a6ad;
}

html.dark .scenario-sidebar__item {
  color: #cfd3dc;
  background: transparent;
}

html.dark .scenario-sidebar__item:hover {
  color: #79bbff;
  background: #18222c;
}

html.dark .scenario-sidebar__item.is-active {
  color: #79bbff;
  background: #18222c;
}

html.dark .scenario-sidebar__detail h2 {
  color: #e5eaf3;
}

html.dark .scenario-sidebar__detail p {
  color: #cfd3dc;
}

html.dark .scenario-sidebar__docs {
  color: #79bbff;
}

/*
 * 开关区:不依赖任何 UI 库,用固定色 + html.dark 切暗色,
 * 保证各 adapter 页面外观完全一致。
 */
.demo-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin-bottom: 12px;
  background: transparent;
  border: 0;
  border-radius: 0;
  font-size: 13px;
}

.demo-toolbar__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.demo-toolbar__cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px 10px;
}

.demo-toolbar__cluster + .demo-toolbar__cluster {
  padding-left: 0;
  border-left: 0;
}

.demo-toolbar__group--right {
  justify-content: flex-start;
}

html.dark .demo-toolbar {
  background: transparent;
}

html.dark .demo-toolbar__cluster + .demo-toolbar__cluster {
  border-color: #363637;
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 7px;
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
  width: 136px;
  padding: 5px 10px;
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

.native-select--locale {
  width: 124px;
}

.native-select--output {
  width: 92px;
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
  min-height: 30px;
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
  gap: 14px;
}

.demo {
  min-width: 0;
  margin-bottom: 16px;
}

.demo--output {
  min-width: 0;
}

.editor-stage {
  position: relative;
  min-width: 0;
  height: 320px;
  min-height: 320px;
  overflow: hidden;
  border-radius: 4px;
  background: #fff;
  contain: layout paint;
  isolation: isolate;
}

.editor-stage > *,
.editor-stage :where(.tvp-editor) {
  height: 100%;
  min-height: 0;
}

.editor-stage :where(.tvp-editor) {
  max-height: 100%;
  border-radius: 4px;
}

.editor-stage :where(.tvp-content-shell),
.editor-stage :where(.tvp-content-wrap) {
  min-height: 0;
}

.editor-stage :where(.tvp-content-wrap) {
  max-height: none;
}

html.dark .editor-stage {
  background: #1d1e1f;
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
  margin-bottom: 8px;
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
  padding: 2px 12px;
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
  margin: 0;
  background: #24272d;
  color: #cfd4dc;
  padding: 14px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  line-height: 1.6;
  overflow: auto;
  /* 移动端:输出区矮一点,留出编辑器空间 */
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-word;
}

html.dark .output {
  border-color: #414243;
}

.page__footer {
  margin-top: 22px;
  padding-top: 12px;
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
    padding: 16px 16px 40px;
  }
  .ui-nav__item:nth-child(1) {
    width: 136px;
  }
  .ui-nav__item:nth-child(2) {
    width: 112px;
  }
  .ui-nav__item:nth-child(3) {
    width: 156px;
  }
  .page__header h1 {
    font-size: 23px;
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
  .demo-toolbar__cluster + .demo-toolbar__cluster {
    padding-left: 12px;
    border-left: 1px solid #ebeef5;
  }
  html.dark .demo-toolbar__cluster + .demo-toolbar__cluster {
    border-color: #363637;
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
    padding: 20px 18px 48px;
  }
  .page__header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .page__meta {
    justify-content: flex-end;
    transform: translateY(-2px);
  }
  .page__header h1 {
    font-size: 24px;
  }
  .output {
    padding: 16px;
    max-height: 320px;
  }
  .editor-stage {
    height: 360px;
    min-height: 360px;
  }

  .workbench {
    grid-template-columns: 184px minmax(0, 1fr);
    align-items: start;
  }

  .scenario-sidebar {
    position: sticky;
    top: 18px;
  }

  .scenario-sidebar__list {
    flex-direction: column;
    align-items: stretch;
    overflow-x: visible;
    padding-bottom: 0;
  }

  .scenario-sidebar__item {
    width: 100%;
    white-space: normal;
  }

  .demo--output {
    grid-column: 2;
  }
}

/* —— lg ≥1024px:桌面 —— */
@media (min-width: 1024px) {
  .page {
    max-width: 860px;
    padding: 24px 24px 56px;
  }
  .page__header h1 {
    font-size: 26px;
  }
  .page__header {
    margin-bottom: 14px;
  }
  .demo {
    margin-bottom: 20px;
  }

  .workbench {
    grid-template-columns: 198px minmax(0, 1fr);
  }

  .scenario-sidebar__detail {
    display: block;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #ebeef5;
  }

  html.dark .scenario-sidebar__detail {
    border-color: #363637;
  }
}

@media (min-width: 1180px) {
  .page {
    max-width: 1280px;
  }

  .workbench {
    grid-template-columns: 204px minmax(0, 1fr) minmax(300px, 380px);
    align-items: start;
  }

  .demo--output {
    grid-column: auto;
    position: sticky;
    top: 24px;
  }

  .output {
    max-height: calc(100vh - 180px);
  }
  .editor-stage {
    height: min(560px, calc(100vh - 180px));
    min-height: min(560px, calc(100vh - 180px));
  }
}

/* —— xl ≥1280px:大屏,上限封顶避免过宽 —— */
@media (min-width: 1280px) {
  .page {
    max-width: 1440px;
    padding: 28px 24px 64px;
  }
}

/* —— 2xl ≥1600px:充分利用大屏,但仍保留阅读宽度上限 —— */
@media (min-width: 1600px) {
  .page {
    max-width: 1600px;
  }

  .workbench {
    grid-template-columns: 212px minmax(0, 1fr) minmax(320px, 420px);
  }
}
</style>
