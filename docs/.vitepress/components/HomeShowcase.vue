<script setup lang="ts">
import { withBase } from 'vitepress'

const stats = [
  { value: 'Vue 3', label: 'Framework' },
  { value: '3', label: 'UI Adapters' },
  { value: '30+', label: 'Toolbar Commands' },
]

const entryPoints = [
  {
    title: '快速接入',
    body: '从项目使用的 UI 库开始,复制最小示例即可跑起来。',
    href: '/guide/quick-start',
    meta: '5 min',
  },
  {
    title: '配置菜单和行为',
    body: '开放字体、字号、行高、色板、代码语言和默认交互行为。',
    href: '/guide/configuration',
    meta: 'config',
  },
  {
    title: '在线体验',
    body: '在文档流里切换三套 Adapter,需要大画布时再全屏打开。',
    href: '/guide/live-demo',
    meta: 'playground',
  },
]

const uiAdapterNames = ['Element Plus', 'Naive UI', 'Ant Design Vue']

const capabilities = [
  ['Toolbar', '按钮分组、顺序、菜单数据、禁用项'],
  ['Behavior', '链接 target、表格表头、图片 accept'],
  ['Markdown', '导入导出、HTML 转换、统一入口'],
  ['Core API', 'useProEditor、扩展注册表、命令注册表'],
]
</script>

<template>
  <main class="landing">
    <section class="hero">
      <div class="hero__copy">
        <p class="eyebrow">Vue 3 / Element Plus / Naive UI / Ant Design Vue</p>
        <h1>Tiptap Vue Pro</h1>
        <p class="hero__subtitle">
          <span>Vue 3 富文本编辑器</span>
          <span>三套主流 UI 适配</span>
        </p>
        <p class="hero__lead">
          内置
          <span class="hero__highlight">Element Plus</span>、
          <span class="hero__highlight">Naive UI</span>、
          <span class="hero__highlight">Ant Design Vue</span>
          三套主流 UI Adapter,把工具栏、图片、表格、Markdown 和气泡菜单收成一套可配置组件。
        </p>
        <div class="hero__actions">
          <a class="button button--primary" :href="withBase('/guide/quick-start')">快速开始</a>
          <a class="button" :href="withBase('/guide/live-demo')">在线体验</a>
        </div>
      </div>

      <aside class="brief" aria-label="Project brief">
        <div class="brief__line">
          <span>install</span>
          <code>pnpm add tiptap-vue-pro-element-plus</code>
        </div>
        <div class="brief__matrix">
          <div v-for="uiAdapterName in uiAdapterNames" :key="uiAdapterName">
            <span>{{ uiAdapterName }}</span>
            <strong>Adapter</strong>
          </div>
        </div>
        <div class="brief__note">
          <strong>Core 保持 Headless</strong>
          <span>UI 渲染、弹窗、下拉菜单和消息反馈都留在各 Adapter 包里。</span>
        </div>
      </aside>
    </section>

    <dl class="stats">
      <div v-for="item in stats" :key="item.label">
        <dt>{{ item.value }}</dt>
        <dd>{{ item.label }}</dd>
      </div>
    </dl>

    <section class="section">
      <div class="section__head">
        <p class="eyebrow">start here</p>
        <h2>选择你现在要做的事。</h2>
      </div>
      <div class="entry-grid">
        <a v-for="item in entryPoints" :key="item.title" class="entry" :href="withBase(item.href)">
          <span>{{ item.meta }}</span>
          <strong>{{ item.title }}</strong>
          <p>{{ item.body }}</p>
        </a>
      </div>
    </section>

    <section class="section capabilities">
      <div class="section__head">
        <p class="eyebrow">capabilities</p>
        <h2>开放配置,而不是让用户 Fork 源码。</h2>
      </div>
      <div class="capability-list">
        <div v-for="[name, detail] in capabilities" :key="name" class="capability-row">
          <strong>{{ name }}</strong>
          <span>{{ detail }}</span>
        </div>
      </div>
    </section>

    <section class="section architecture">
      <div>
        <p class="eyebrow">architecture</p>
        <h2>Core 和 Adapter 的边界必须清楚。</h2>
      </div>
      <div class="architecture__rail">
        <div>
          <strong>Core</strong>
          <span>types / commands / Markdown / upload / editor behavior</span>
        </div>
        <div>
          <strong>Adapter</strong>
          <span>Element Plus / Naive UI / Ant Design Vue native UI</span>
        </div>
        <div>
          <strong>Docs</strong>
          <span>API explanation / configuration recipes / integrated playground page</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.landing {
  --landing-max: 1280px;
  --landing-accent: #3157d5;
  --landing-green: #16875d;
  --landing-amber: #9a6a00;
  --landing-ink: var(--vp-c-text-1);
  padding: 72px 32px 112px;
}

.hero,
.stats,
.section {
  width: min(var(--landing-max), 100%);
  margin: 0 auto;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(420px, 0.68fr);
  gap: 56px;
  align-items: end;
  padding: 56px 0 44px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.eyebrow {
  margin: 0 0 16px;
  color: var(--landing-accent);
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero h1,
.hero__subtitle,
.section h2 {
  margin: 0;
  color: var(--landing-ink);
  letter-spacing: 0;
}

.hero h1 {
  max-width: 780px;
  font-size: clamp(54px, 6vw, 86px);
  line-height: 0.98;
}

.hero__subtitle {
  max-width: 780px;
  margin-top: 16px;
  color: var(--vp-c-text-1);
  font-size: clamp(30px, 3.5vw, 46px);
  font-weight: 850;
  line-height: 1.12;
}

.hero__subtitle span {
  display: block;
}

.hero__lead {
  max-width: 780px;
  margin: 26px 0 0;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1.85;
}

.hero__highlight {
  color: var(--landing-accent);
  font-weight: 800;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 750;
  text-decoration: none;
}

.button:hover {
  border-color: var(--landing-accent);
  color: var(--landing-accent);
}

.button--primary {
  border-color: var(--landing-accent);
  background: var(--landing-accent);
  color: white;
}

.button--primary:hover {
  color: white;
  background: color-mix(in srgb, var(--landing-accent), black 10%);
}

.brief {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow: 0 22px 60px color-mix(in srgb, var(--vp-c-text-1), transparent 92%);
}

.brief__line {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.brief__line span,
.brief__note strong,
.brief__matrix strong {
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.brief__line code {
  overflow: hidden;
  padding: 9px 10px;
  border-radius: 6px;
  background: var(--vp-code-bg);
  color: var(--vp-code-color);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brief__matrix {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--vp-c-divider);
}

.brief__matrix div {
  min-height: 128px;
  padding: 18px;
  border-right: 1px solid var(--vp-c-divider);
}

.brief__matrix div:last-child {
  border-right: 0;
}

.brief__matrix span {
  display: block;
  color: var(--landing-ink);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.25;
}

.brief__matrix strong {
  display: block;
  margin-top: 42px;
}

.brief__note {
  display: grid;
  gap: 8px;
  padding: 20px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--landing-green), transparent 92%), transparent 55%),
    var(--vp-c-bg-soft);
}

.brief__note strong {
  color: var(--landing-green);
}

.brief__note span {
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.stats div {
  padding: 18px 22px;
  border-right: 1px solid var(--vp-c-divider);
}

.stats div:last-child {
  border-right: 0;
}

.stats dt {
  color: var(--landing-ink);
  font-size: 28px;
  font-weight: 850;
}

.stats dd {
  margin: 2px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.section {
  margin-top: 64px;
}

.section__head {
  display: grid;
  grid-template-columns: minmax(220px, 0.35fr) minmax(0, 1fr);
  gap: 32px;
  align-items: end;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.section h2 {
  max-width: 760px;
  font-size: clamp(26px, 2.8vw, 38px);
  line-height: 1.18;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.entry {
  display: grid;
  gap: 12px;
  min-height: 190px;
  padding: 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: inherit;
  text-decoration: none;
}

.entry:hover {
  border-color: var(--landing-accent);
}

.entry span {
  color: var(--landing-amber);
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.entry strong {
  color: var(--landing-ink);
  font-size: 21px;
}

.entry p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.capabilities {
  display: grid;
  grid-template-columns: minmax(280px, 0.44fr) minmax(0, 1fr);
  gap: 34px;
}

.capabilities .section__head {
  display: block;
  padding: 0;
  border-bottom: 0;
}

.capability-list {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.capability-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 20px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.capability-row:last-child {
  border-bottom: 0;
}

.capability-row strong {
  color: var(--landing-accent);
}

.capability-row span {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.architecture {
  display: grid;
  grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
  gap: 40px;
  padding-top: 46px;
  border-top: 1px solid var(--vp-c-divider);
}

.architecture__rail {
  display: grid;
  gap: 10px;
}

.architecture__rail div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 16px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.architecture__rail strong {
  color: var(--landing-green);
}

.architecture__rail span {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

@media (max-width: 1080px) {
  .hero,
  .capabilities,
  .architecture {
    grid-template-columns: 1fr;
  }

  .hero {
    align-items: start;
  }
}

@media (max-width: 760px) {
  .landing {
    padding: 38px 18px 76px;
  }

  .hero {
    gap: 32px;
    padding: 30px 0;
  }

  .hero h1 {
    font-size: 40px;
  }

  .hero__lead {
    font-size: 16px;
  }

  .brief__line,
  .section__head,
  .capability-row,
  .architecture__rail div {
    grid-template-columns: 1fr;
  }

  .brief__matrix,
  .stats,
  .entry-grid {
    grid-template-columns: 1fr;
  }

  .brief__matrix div,
  .stats div {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }

  .brief__matrix div:last-child,
  .stats div:last-child {
    border-bottom: 0;
  }

  .brief__matrix strong {
    margin-top: 16px;
  }
}
</style>
