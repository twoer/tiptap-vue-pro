# Find Replace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add editor-native find and replace across core, Element Plus, Naive UI, and Ant Design Vue adapters.

**Architecture:** Core owns text matching, active-match state, ProseMirror decorations, navigation, and replace commands. Adapters own the floating find/replace panel, keyboard affordances, and UI-library-specific inputs/buttons. Browser smoke tests prove keyboard open, next/previous, replace, replace-all, and adapter switching behavior.

**Tech Stack:** Vue 3, Tiptap v3, ProseMirror plugin/decorations, Vitest, Playwright smoke scripts, Element Plus, Naive UI, Ant Design Vue.

**Status:** Completed on 2026-07-09.

---

## Product Contract

- `Ctrl/Cmd + F` opens a compact find panel in editable and readonly modes.
- The panel searches plain document text and highlights all matches.
- The active match is visually distinct and can be moved with next/previous buttons or Enter.
- The panel shows current match index and total count.
- Replace controls are available in editable mode and hidden/disabled in readonly mode.
- Replace current writes only the active match; replace all writes every match.
- Case-sensitive search is supported in MVP.
- Escape closes the panel and clears highlights.
- Markdown import/export is unchanged; find/replace is an editor interaction feature.

Out of scope for MVP:

- Regular expressions.
- Whole-word matching.
- Cross-node rich text replacement preserving mixed marks inside the replaced range.
- Searching hidden UI text outside the ProseMirror document.

## Task 1: Core Find/Replace State - Completed

**Files:**

- Create: `packages/core/src/findReplace.ts`
- Create: `packages/core/src/findReplace.test.ts`
- Modify: `packages/core/src/index.ts`

**Steps:**

1. Write tests for query normalization, case-sensitive/case-insensitive matching, active index clamping, and replace-all range ordering.
2. Implement `FindReplaceOptions`, `FindReplaceMatch`, `findTextMatches`, `nextFindReplaceIndex`, and `replaceAllTextMatches`.
3. Export helpers and types from `packages/core/src/index.ts`.
4. Run `pnpm --filter tiptap-vue-pro-core test -- findReplace`.

## Task 2: Core ProseMirror Extension - Completed

**Files:**

- Create: `packages/core/src/extensions/findReplace.ts`
- Create: `packages/core/src/extensions/findReplace.test.ts`
- Modify: `packages/core/src/extensions.ts`
- Modify: `packages/core/src/extensionRegistry.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/useProEditor.ts`
- Modify: `packages/core/src/index.ts`

**Steps:**

1. Write tests for opening a real editor, setting query, highlight count, next/previous, Escape close behavior, replace current, and replace all.
2. Implement a UI-free extension with plugin state and decorations:
   - `tvp-find-match`
   - `tvp-find-match--active`
3. Add commands:
   - `openFindReplace`
   - `closeFindReplace`
   - `setFindReplaceQuery`
   - `setFindReplaceCaseSensitive`
   - `findReplaceNext`
   - `findReplacePrevious`
   - `replaceFindReplaceCurrent`
   - `replaceFindReplaceAll`
4. Add a small event bridge so adapters can react to state updates without reading plugin internals.
5. Register the extension by default in `createDefaultExtensions`.
6. Run core tests and typecheck.

## Task 3: Element Plus Adapter Panel - Completed

**Files:**

- Create: `packages/element-plus/src/FindReplacePanel.vue`
- Modify: `packages/element-plus/src/ProEditorElementPlus.vue`
- Modify: `packages/element-plus/src/ProEditorElementPlus.test.ts`

**Steps:**

1. Render a compact panel at the top-right of the editor with find input, count, previous/next, close, replace toggle, replace input, replace current, replace all, and case-sensitive toggle.
2. Add `Ctrl/Cmd + F` handler in the adapter root to call `ctx.commands.openFindReplace()`.
3. Keep replace controls hidden/disabled in readonly mode.
4. Add tests proving bridge props render, shortcut opens, readonly hides replace actions, and buttons call core commands.
5. Run Element Plus tests and typecheck.

## Task 4: Naive UI And Ant Design Vue Parity - Completed

**Files:**

- Create: `packages/naive/src/FindReplacePanel.vue`
- Create: `packages/ant-design-vue/src/FindReplacePanel.vue`
- Modify: `packages/naive/src/ProEditorNaive.vue`
- Modify: `packages/ant-design-vue/src/ProEditorAntDesignVue.vue`
- Modify: adapter tests

**Steps:**

1. Mirror the Element Plus interaction using Naive UI primitives and `--n-*` variables.
2. Mirror the same interaction using Ant adapter primitives and `--tvp-ant-*` variables.
3. Keep icon/text spacing at 6px where icon+text commands appear.
4. Run all adapter tests, typechecks, and AGENTS boundary scans.

## Task 5: Browser Smoke, Docs, And Commit - Completed

**Files:**

- Create: `scripts/find-replace-playwright-smoke.mjs`
- Modify: `package.json`
- Modify: root and package READMEs
- Modify: `docs/guide/quick-start.md`
- Modify: `docs/en/guide/quick-start.md`
- Modify: `docs/guide/faq.md`
- Modify: `docs/en/guide/faq.md`

**Steps:**

1. Add `pnpm test:find-replace:e2e`.
2. Cover all adapters:
   - `Ctrl/Cmd + F` opens panel.
   - Query highlights and count updates.
   - Next/previous moves the active match.
   - Replace current changes one match.
   - Replace all changes remaining matches.
   - Escape closes and clears highlights.
   - Adapter switching emits no page errors.
3. Document basic usage and Markdown non-impact.
4. Run:

```bash
pnpm -r run typecheck
pnpm test
pnpm --filter playground build
pnpm docs:build:site
pnpm test:find-replace:e2e
pnpm test:slash:e2e
pnpm test:table:e2e
```

5. Commit locally. Do not push unless explicitly requested.

## Verification

Completed:

```bash
pnpm -r run typecheck
pnpm test
pnpm --filter playground build
pnpm docs:build:site
PLAYGROUND_URL=http://localhost:5173/tiptap-vue-pro/playground/ pnpm test:find-replace:e2e
PLAYGROUND_URL=http://localhost:5173/tiptap-vue-pro/playground/ pnpm test:slash:e2e
PLAYGROUND_URL=http://localhost:5173/tiptap-vue-pro/playground/ pnpm test:table:e2e
git diff --check
```

Adapter boundary scans completed with no matches.
