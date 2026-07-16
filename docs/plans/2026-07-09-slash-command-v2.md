# Slash Command V2 Design

> Date: 2026-07-09
> Status: implemented locally on `codex/slash-command-v2`
> Context: replace the old `codex/slash-command-0.1.6` product shape. Reuse only proven low-level ideas; do not merge the branch as-is.

## 1. Goal

Build a Feishu-like quick insert entry for Tiptap Vue Pro.

V2 is not a toolbar copy behind `/`. It should feel like a writing-flow helper:
the user types `/`, sees a short list of likely next actions, searches by intent,
executes with keyboard or click, and continues editing from a natural cursor
position.

Success criteria:

- The default menu is short, fast, and predictable.
- Common intent words work in Chinese, English, and short aliases.
- Keyboard operation feels primary, not secondary.
- Inserted content lands where the user expects.
- The implementation preserves the `packages/core` and adapter boundary.
- The feature does not regress table grip, table resize, image bubble, or adapter switching stability.

## 2. Why The Old Version Felt Bad

The previous slash branch proved the technical path, but the product shape was
wrong.

Problems to avoid:

- It exposed too many commands as a flat capability list.
- It felt like a toolbar dropdown, not a writing entry.
- Media commands could appear disabled, making the menu feel broken.
- It lacked context ranking for empty paragraphs, tables, lists, and media.
- Command execution did not define enough cursor and follow-up behavior.
- The branch touched unrelated table code and removed browser regression coverage, making it unsafe to merge after the table work.

Decision: do not continue the old branch. Cherry-pick ideas only after comparing
them with this design.

## 3. MVP Scope

Ship a small V2 first. The first screen should contain no more than eight high
frequency commands.

Default commands:

| Command | Label | Main Intent |
| --- | --- | --- |
| `heading` | 标题 | Turn the current paragraph into a heading |
| `todo` | 待办 | Start a task list |
| `bulletList` | 无序列表 | Start a bullet list |
| `orderedList` | 有序列表 | Start a numbered list |
| `table` | 表格 | Insert a 3 x 3 table |
| `image` | 图片 | Insert or upload an image |
| `divider` | 分割线 | Insert a horizontal rule |
| `codeBlock` | 代码块 | Insert a code block |

Out of scope for V2:

- Mention / `@`.
- AI commands.
- Nested command pages.
- Full block database menus.
- Remote command search.
- Custom business commands.
- Video, audio, and file as default visible commands.
- Row height, table formulas, or spreadsheet-like behavior.

Follow-up commands can exist in the search index later, but they should not
pollute the default menu.

## 4. UX Contract

### 4.1 Trigger

- Typing `/` in an editable text position opens the menu.
- Readonly and preview never open the menu.
- The menu should prefer paragraph-like positions. It may work inside list items,
  but it should not open in code blocks.
- Inside a table cell, it can open, but commands that insert block structures
  must behave safely and predictably.

### 4.2 Default Menu

Empty query shows the eight MVP commands in this order:

1. 标题
2. 待办
3. 无序列表
4. 有序列表
5. 表格
6. 图片
7. 分割线
8. 代码块

No group headers in the first version. Group headers made the old menu feel
larger than it was. V2 should feel compact.

### 4.3 Search

Search should use an intent index, not only label matching.

Examples:

| Query | Expected Top Result |
| --- | --- |
| `/表` | 表格 |
| `/biaoge` | 表格 |
| `/table` | 表格 |
| `/todo` | 待办 |
| `/renwu` | 待办 |
| `/h1` | 标题 |
| `/bt` | 标题 |
| `/img` | 图片 |
| `/tu` | 图片 |
| `/line` | 分割线 |
| `/code` | 代码块 |

Ranking rule:

1. Exact alias match.
2. Prefix alias match.
3. Label contains query.
4. Description contains query.
5. Fuzzy fallback, if simple and deterministic.

Disabled items should not rank above executable items.

### 4.4 Keyboard

- `ArrowDown` / `ArrowUp`: move active item.
- `Enter`: execute active item.
- `Tab`: optional. Only enable if it does not fight editor indentation.
- `Escape`: close menu and keep typed text.
- `Backspace` to remove the query should update results; deleting `/` closes.
- Mouse click should execute without stealing the editor selection.

### 4.5 Execution

Before command execution, delete the slash query range. Then execute the command
at the original editor position.

Expected cursor behavior:

| Command | After Execution |
| --- | --- |
| 标题 | Current paragraph becomes heading; cursor remains in the heading |
| 待办 | Current paragraph becomes first task item; cursor remains in the item |
| 无序列表 | Current paragraph becomes first bullet item |
| 有序列表 | Current paragraph becomes first ordered item |
| 表格 | Insert 3 x 3 table; cursor enters the first editable cell |
| 图片 | Open image flow without losing editor selection |
| 分割线 | Insert rule and create/focus a paragraph after it |
| 代码块 | Current paragraph becomes code block; cursor remains inside it |

Media rule:

- `图片` must not appear as a dead disabled row.
- If upload is available, trigger upload.
- If upload is unavailable but URL insertion UI exists, open URL insertion.
- If neither path exists, hide `图片` from the default list and show it only as a
  disabled search result with a clear short reason.

## 5. Visual Design

The menu should look like an editor-native floating layer, not a UI library
button list.

Visual rules:

- Fixed or floating position anchored to the slash range client rect.
- Width around 280-320px.
- Compact item height: 36-42px.
- Icon + label gap: 6px.
- One-line label, optional very short muted hint.
- Active item has a clear but quiet background.
- Disabled item is rare; when present, include one short reason.
- No large group headers in MVP.
- No nested cards, no decorative panels.

Adapter rendering:

- Element Plus, Naive UI, and Ant Design Vue may use their own primitives, but
  the result should look and behave equivalent.
- Adapter selectors and CSS variables must remain adapter-local.
- Core must not import UI components, icons, or adapter CSS.

## 6. Architecture

### 6.1 Core Responsibilities

`packages/core` owns:

- Slash command item protocol.
- Intent index and filtering/ranking.
- Tiptap suggestion extension wiring.
- Suggestion lifecycle state: open, update, close.
- Execute range handling.
- Command executor for core-owned commands.
- Public options for enabling/disabling slash command.

Core must stay UI-free.

Proposed core files:

- `packages/core/src/slashCommand.ts`
- `packages/core/src/extensions/slashCommand.ts`
- `packages/core/src/useProEditor.ts`
- `packages/core/src/types.ts`
- `packages/core/src/index.ts`

### 6.2 Adapter Responsibilities

Each adapter owns:

- Slash menu component.
- Menu styling and library primitives.
- Image upload or URL insertion bridge.
- Pointer handling so clicks do not destroy editor selection.

Proposed adapter files:

- `packages/element-plus/src/SlashCommandMenu.vue`
- `packages/naive/src/SlashCommandMenu.vue`
- `packages/ant-design-vue/src/SlashCommandMenu.vue`
- corresponding `ProEditor*.vue` integration.

### 6.3 Reusing The Old Branch

Reusable ideas:

- Use `@tiptap/suggestion`.
- Use a core `SlashCommandItem` protocol.
- Emit render state into adapters instead of rendering DOM in core.

Do not reuse as-is:

- Default command list shape.
- Disabled media behavior.
- Large grouped menu visual.
- Table code changes.
- Removal of table e2e coverage.

## 7. API Sketch

```ts
export interface SlashCommandOptions {
  enabled?: boolean
  defaultItems?: SlashCommandId[]
  items?: SlashCommandItem[]
  aliases?: Partial<Record<SlashCommandId, string[]>>
}

export interface SlashCommandItem {
  id: SlashCommandId
  label: string
  hint?: string
  icon: string
  aliases: string[]
  keywords: string[]
  hiddenInDefault?: boolean
  disabledReason?: string
}
```

`ProEditorOptions`:

```ts
slashCommand?: boolean | SlashCommandOptions
```

Default: enabled.

If users need to opt out:

```ts
useProEditor({
  content,
  slashCommand: false,
})
```

## 8. Testing And Verification

### Core Tests

- Default item list contains only MVP default commands.
- Search ranks `/表`, `/todo`, `/h1`, `/img`, `/line`, `/code`.
- Disabled items do not outrank executable items.
- Slash extension does not load when disabled.
- Executing command deletes the slash range before command execution.
- `Escape` closes without deleting typed slash text.

### Adapter Tests

For each adapter:

- Menu renders active item and equivalent labels.
- Arrow navigation updates active item.
- Click execution calls the render-state command.
- Readonly/preview hides the menu.
- Adapter boundary scan has no cross-library leakage.

### Browser Regression

Add a focused Playwright script or extend the existing smoke flow:

- Type `/表`, press Enter, table appears, cursor enters first cell.
- Type `/todo`, press Enter, task list appears.
- Type `/图片`, choose upload or URL path without console error.
- Press Escape after `/表`, menu closes and text remains.
- Click adapter tabs repeatedly after opening slash menu; no pageerror.
- Existing `pnpm test:table:e2e` continues to pass.

Required checks before merge:

```bash
pnpm --filter tiptap-vue-pro-core typecheck
pnpm --filter tiptap-vue-pro-core test
pnpm --filter tiptap-vue-pro-element-plus typecheck
pnpm --filter tiptap-vue-pro-element-plus test
pnpm --filter tiptap-vue-pro-naive typecheck
pnpm --filter tiptap-vue-pro-naive test
pnpm --filter tiptap-vue-pro-ant-design-vue typecheck
pnpm --filter tiptap-vue-pro-ant-design-vue test
pnpm test:table:e2e
```

## 9. Implementation Slices

### Slice 1: Core Protocol And Ranking

Build item definitions, alias index, ranking, and tests. No UI yet.

### Slice 2: UI-Free Suggestion Extension

Wire `@tiptap/suggestion` into core. Expose render state and execution callbacks.
Keep menu disabled unless an adapter bridge exists.

### Slice 3: One Adapter Prototype

Implement Element Plus menu first as the reference. Validate the UX in
playground before mirroring.

### Slice 4: Adapter Parity

Mirror the final component into Naive UI and Ant Design Vue with adapter-local
components and selectors.

### Slice 5: Browser UX Regression

Add slash command browser smoke tests and re-run table/browser checks.

### Slice 6: Docs

Update README, docs, package READMEs, and FAQ. Explicitly state Markdown export
is unaffected.

## 10. Open Decisions

Resolve before coding:

1. Should `Tab` execute active item, or should it remain editor indentation only?
2. Should `标题` default to H2 or show H1/H2/H3 only after searching `h`?
3. Should image default to upload, URL insertion, or a two-option mini flow?
4. Should slash command be enabled by default in all adapters?

Recommended defaults:

- Do not use `Tab` in V2.
- `标题` defaults to H2.
- Image uses upload when available, URL insertion fallback when upload is not available.
- Slash command enabled by default, with `slashCommand: false` opt-out.

## 11. Acceptance Checklist

- [x] Old slash branch is not merged as-is.
- [x] Default menu has no more than eight commands.
- [x] `/表`, `/todo`, `/h1`, `/img`, `/line`, `/code` rank correctly.
- [x] Image command is not a dead disabled row in default menu.
- [x] Command execution has defined cursor behavior.
- [x] Three adapters render equivalent menu behavior.
- [x] Adapter boundary checks pass.
- [x] Browser test covers keyboard, click, Escape, and adapter switching.
- [x] Existing table e2e still passes.

## 12. Implementation Notes

Implemented in local commits on `codex/slash-command-v2`.

- Core owns `packages/core/src/slashCommand.ts` and `packages/core/src/extensions/slashCommand.ts`.
- Adapter menus live in `packages/element-plus/src/SlashCommandMenu.vue`, `packages/naive/src/SlashCommandMenu.vue`, and `packages/ant-design-vue/src/SlashCommandMenu.vue`.
- The image command is visible when upload or URL insertion is available. If neither path exists, it is hidden from the default list and remains a disabled search result with a short reason.
- Markdown import/export is unchanged. Slash Command only runs normal editor commands while editing.

Verification:

```bash
pnpm -r run typecheck
pnpm test
pnpm --filter playground build
PLAYGROUND_URL=http://localhost:5174/tiptap-vue-pro/playground/ pnpm test:slash:e2e
PLAYGROUND_URL=http://localhost:5174/tiptap-vue-pro/playground/ pnpm test:table:e2e
```
