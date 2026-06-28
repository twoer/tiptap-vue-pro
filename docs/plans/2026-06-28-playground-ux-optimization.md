# Playground UX Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 playground 从基础演示页升级成更清晰、更高效、更适合组件评估的编辑器演示台。

**Architecture:** 本次只改 playground 页面层,不改 core 与两个 adapter 的组件 API。`playground/src/App.vue` 继续负责 hash 路由、演示开关、输出预览和页面布局,两个编辑器组件仍通过相同 props 挂载。

**Tech Stack:** Vue 3 `<script setup>`, Vite, workspace packages `tiptap-vue-pro-element-plus` / `tiptap-vue-pro-naive`, 原生 CSS。

---

## Scope

### In Scope

- 修正示例内容中的 UI 名称,让 Element Plus / Naive UI 路由下文案一致。
- 重构 playground 首屏信息层级,减少顶部空白,让编辑器更早进入视口。
- 将控制区改成更紧凑的演示工具条,并补充当前状态反馈。
- 桌面端改为编辑器 + 输出预览双栏布局,移动端保持单栏。
- 优化输出面板可读性与复制反馈。
- 做一次移动端与桌面端手动验收。

### Out of Scope

- 不改 `packages/core`。
- 不改 `packages/element-plus` 与 `packages/naive` 的公共 API。
- 不新增 UI 依赖或图标依赖。
- 不重做编辑器内部工具栏按钮。
- 不引入复杂路由库。

---

## Current Context

### Relevant Files

- Modify: `playground/src/App.vue`
- Read only: `playground/src/main.ts`
- Read only: `playground/package.json`

### Current Behavior

- `route` 通过 hash 在 `element-plus` 与 `naive` 间切换。
- 两个编辑器共享同一份 `content`。
- `dark` 会切换 `html.dark`。
- `readonly`, `showWordCount`, `output` 通过顶部 controls 控制。
- 输出预览在编辑器下方,桌面端需要滚动才能看见。
- 初始内容文案固定写了 `Element Plus`,切到 Naive UI 后不准确。

---

## Implementation Tasks

### Task 1: Add Dynamic Demo Copy

**Files:**

- Modify: `playground/src/App.vue`

**Step 1: Add computed UI labels**

In `<script setup>`, after `output` state, add computed labels:

```ts
const currentUiName = computed(() => (route.value === 'naive' ? 'Naive UI' : 'Element Plus'))
const currentUiPackage = computed(() =>
  route.value === 'naive' ? 'tiptap-vue-pro-naive' : 'tiptap-vue-pro-element-plus',
)
```

**Step 2: Replace fixed initial content with a function**

Change fixed `content = ref('...Element Plus...')` into:

```ts
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

const content = ref(createDemoContent('Element Plus'))
```

Use ASCII replacements in code snippets where possible: replace `✅` with `OK`, and `…` with `...`.

**Step 3: Do not auto-reset user content on route switch**

Only use the dynamic labels in surrounding UI. Do not watch `route` and overwrite `content`, because a user may edit the document and then compare UI adapters.

**Step 4: Verify**

Run:

```bash
pnpm --filter playground build
```

Expected: build passes.

---

### Task 2: Tighten Header Into a Playground Masthead

**Files:**

- Modify: `playground/src/App.vue`

**Step 1: Update header markup**

Replace the current header block with:

```vue
<header class="page__header">
  <div class="page__title">
    <p class="page__eyebrow">Playground</p>
    <h1>tiptap-vue-pro</h1>
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
```

**Step 2: Add responsive header CSS**

Add or adjust styles:

```css
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

@media (min-width: 768px) {
  .page__header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
  .page__meta {
    justify-content: flex-end;
  }
}
```

**Step 3: Verify visual intent**

Start dev server:

```bash
pnpm dev
```

Expected: header uses less vertical space; current adapter and package are visible without crowding.

---

### Task 3: Convert Controls Into a Compact Demo Toolbar

**Files:**

- Modify: `playground/src/App.vue`

**Step 1: Rename controls section semantics**

Change:

```vue
<section class="controls">
```

To:

```vue
<section class="demo-toolbar" aria-label="Playground controls">
```

Update inner labels to keep the same bindings:

```vue
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
</div>
<div class="demo-toolbar__group demo-toolbar__group--right">
  <label class="control">
    <span>输出</span>
    <select v-model="output" class="native-select">
      <option value="html">HTML</option>
      <option value="json">JSON</option>
    </select>
  </label>
</div>
```

**Step 2: Replace `.controls` CSS with toolbar CSS**

```css
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

@media (min-width: 640px) {
  .demo-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .demo-toolbar__group--right {
    justify-content: flex-end;
  }
}
```

Remove old `.controls` selectors or rename them, so there is no dead CSS.

**Step 3: Verify controls still work**

Manual checks:

- Toggle dark mode.
- Toggle readonly and confirm editor toolbar hides.
- Toggle word count and confirm footer count changes.
- Change output HTML/JSON and confirm output panel changes.

---

### Task 4: Add Desktop Two-Column Workbench Layout

**Files:**

- Modify: `playground/src/App.vue`

**Step 1: Wrap editor and output sections**

In template, wrap both `.demo` sections:

```vue
<main class="workbench">
  <section class="demo demo--editor">
    ...
  </section>

  <section class="demo demo--output">
    ...
  </section>
</main>
```

Keep the footer outside `main`.

**Step 2: Improve section headings**

Editor heading:

```vue
<div class="demo__head">
  <h3>编辑器</h3>
  <span v-if="readonly" class="state-badge">只读</span>
</div>
```

Output heading:

```vue
<div class="demo__head">
  <h3>输出 · {{ output.toUpperCase() }}</h3>
  <button class="copy-btn" @click="copyOutput">
    {{ copied ? '已复制' : '复制' }}
  </button>
</div>
```

**Step 3: Add workbench CSS**

```css
.workbench {
  display: grid;
  gap: 20px;
}

.demo--output {
  min-width: 0;
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

@media (min-width: 1180px) {
  .page {
    max-width: 1180px;
  }

  .workbench {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    align-items: start;
  }

  .demo--output {
    position: sticky;
    top: 24px;
  }
}
```

**Step 4: Adjust existing max-width rules**

Current CSS caps `.page` at `920px` on xl. Update xl behavior so desktop two-column has room:

```css
@media (min-width: 1280px) {
  .page {
    max-width: 1180px;
    padding: 56px 32px 72px;
  }
}
```

Do not make mobile wider.

**Step 5: Verify layout**

Manual viewport checks:

- 375px wide: single column, no horizontal scroll.
- 768px wide: single column, comfortable spacing.
- 1280px wide: editor and output are side by side.
- Scroll page: output panel remains sticky on desktop.

---

### Task 5: Polish Output Panel Readability

**Files:**

- Modify: `playground/src/App.vue`

**Step 1: Make output panel fill desktop column well**

Update `.output`:

```css
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
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (min-width: 768px) {
  .output {
    padding: 16px;
    max-height: 320px;
  }
}

@media (min-width: 1180px) {
  .output {
    max-height: calc(100vh - 180px);
  }
}
```

**Step 2: Improve copy feedback without layout shift**

Keep button width stable:

```css
.copy-btn {
  min-width: 64px;
  ...
}
```

**Step 3: Verify long output**

Expected: long HTML wraps naturally, horizontal scroll appears only for genuinely long unbreakable tokens.

---

### Task 6: Clean CSS and Check Regressions

**Files:**

- Modify: `playground/src/App.vue`

**Step 1: Remove stale CSS**

Search:

```bash
rg "controls|demo-toolbar|workbench|state-badge" playground/src/App.vue
```

Expected:

- No `.controls` selectors remain.
- `.demo-toolbar`, `.workbench`, `.state-badge` selectors are used.

**Step 2: Build**

Run:

```bash
pnpm --filter playground build
```

Expected: build succeeds.

**Step 3: Optional full repo checks**

Run if time allows:

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck and package tests pass. If unrelated existing package changes cause failures, document them instead of changing unrelated files.

**Step 4: Manual QA**

Run:

```bash
pnpm dev
```

Check:

- `#/element-plus` loads and shows Element Plus labels.
- `#/naive` loads and shows Naive UI labels.
- Switching tabs does not erase edited content.
- Dark mode works in both adapters.
- Readonly mode makes the editor non-editable.
- Output format switch updates preview.
- Copy button copies output.
- Desktop two-column layout has no overlap.
- Mobile layout has no horizontal scroll.

---

## Commit Plan

Commit once after all tasks pass:

```bash
git add playground/src/App.vue docs/plans/2026-06-28-playground-ux-optimization.md
git commit -m "feat: optimize playground experience"
```

If implementing in smaller checkpoints, use:

```bash
git commit -m "fix: align playground demo copy with adapter"
git commit -m "feat: add playground workbench layout"
git commit -m "style: polish playground controls and output"
```

---

## Acceptance Criteria

- [ ] Playground header is compact and identifies the active adapter.
- [ ] Initial visible area prioritizes the editor.
- [ ] Controls are compact and still accessible by label.
- [ ] Desktop output preview sits beside the editor.
- [ ] Mobile remains single-column and readable.
- [ ] Element Plus / Naive UI copy is accurate.
- [ ] User edits survive adapter switches.
- [ ] `pnpm --filter playground build` passes.
