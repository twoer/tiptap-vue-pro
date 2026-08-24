# Recipes And Playground Scenarios Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current all-in-one examples and playground into a clearer business adoption path: docs recipes for copyable integration, plus a playground scenario selector for guided hands-on evaluation.

**Architecture:** Keep the playground as a static, no-code demo surface rather than an online IDE. Move reusable demo metadata into a small scenario registry and connect every scenario to a docs recipe. Split docs examples into recipe pages so users can start from a real business task instead of scanning one long examples page.

**Tech Stack:** VitePress docs, Vue 3 playground, existing three adapter packages (`element-plus`, `naive`, `ant-design-vue`), existing upload/autosave APIs.

---

### Task 1: Add recipe plan and navigation skeleton

**Files:**
- Create: `docs/guide/recipes/index.md`
- Create: `docs/en/guide/recipes/index.md`
- Modify: `docs/.vitepress/config.ts`
- Modify: `docs/guide/examples.md`
- Modify: `docs/en/guide/examples.md`

**Steps:**
1. Create a Chinese recipes index that explains recipes as business-oriented integration guides.
2. Create the English counterpart.
3. Add a `业务 Recipes` / `Recipes` nested sidebar group under Guide.
4. Keep `完整示例` / `Examples` as a compact adapter reference page and link it to recipes.
5. Verify links use existing VitePress absolute docs paths.

**Expected result:** Users can discover recipes from the sidebar and examples page without losing the existing adapter examples.

### Task 2: Add first four recipe pages

**Files:**
- Create: `docs/guide/recipes/business-editor-form.md`
- Create: `docs/guide/recipes/autosave-drafts.md`
- Create: `docs/guide/recipes/uploads.md`
- Create: `docs/guide/recipes/readonly-preview.md`
- Create: `docs/en/guide/recipes/business-editor-form.md`
- Create: `docs/en/guide/recipes/autosave-drafts.md`
- Create: `docs/en/guide/recipes/uploads.md`
- Create: `docs/en/guide/recipes/readonly-preview.md`

**Steps:**
1. Write each page with scenario, when to use it, copyable Element Plus code, adapter migration notes, and common pitfalls.
2. Link each recipe to the matching playground scenario hash.
3. Link deeper API docs where the recipe touches autosave, local drafts, uploads, or readonly behavior.
4. Keep examples concise enough to copy into a real admin project.

**Expected result:** A new user can pick a business scenario and copy the minimum working integration.

### Task 3: Extract playground scenario metadata

**Files:**
- Create: `playground/src/scenarios.ts`
- Modify: `playground/src/App.vue`

**Steps:**
1. Define a `ScenarioKey` union and `playgroundScenarios` registry.
2. Move demo content generation into scenario-specific `createContent(uiName)` functions.
3. Add defaults for readonly, autosave, local drafts, compact toolbar, and output mode.
4. Make autosave/draft keys include both adapter and scenario.

**Expected result:** Playground content becomes scenario-driven without changing adapter component APIs.

### Task 4: Add playground scenario selector

**Files:**
- Modify: `playground/src/App.vue`

**Steps:**
1. Parse and write `scenario` from the playground hash query, keeping old URLs such as `#/element-plus` valid.
2. Add a scenario selector section below the adapter tabs.
3. Show scenario title, description, docs link, and reset action.
4. Use native buttons/selects and existing neutral styling so the selector is adapter-independent.
5. Follow UI baseline: flex rows with consistent gap, no icon/text margin hacks.

**Expected result:** Users can switch between Basic, Business Form, Autosave Drafts, Uploads, Readonly Preview, and Markdown scenarios in the live playground.

### Task 5: Verify

**Commands:**
```bash
pnpm --filter playground build
pnpm docs:build
```

**Expected result:** Playground and docs build successfully. Existing chunk-size and third-party Rollup annotation warnings are acceptable if no new errors appear.

### Task 6: Review changed files

**Commands:**
```bash
git status --short
git diff -- docs docs/.vitepress playground/src
```

**Expected result:** Only intended docs/playground files are changed. Existing unrelated local files stay unstaged and untouched.
