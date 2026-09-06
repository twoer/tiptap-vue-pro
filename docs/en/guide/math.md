# Math formulas (KaTeX)

The editor ships with KaTeX math: two atom nodes, `mathInline` (inline) and `mathBlock` (block), with the LaTeX source stored in the `latex` attribute.

## Input

- **Input rules**: typing `$x^2$` in text creates an inline formula; a paragraph containing exactly `$$x$$` (or a multi-line `$$ … $$` block on its own lines) becomes a block formula. The content must be non-empty and contain no `$`, and the opening `$` must not directly follow a letter/digit while the closing `$` must not directly precede one — this avoids currency false positives like `5$ and 3$`. Escape as `\$` when you mean currency.
- **Slash command / toolbar**: `/formula` (also `gongshi` or `latex`) and the ∑ toolbar button open the **insert dialog**, with an "Inline formula" checkbox below the source input (unchecked = block); the formula is inserted only after you confirm, with live preview.

Typing `$…$` remains the fastest path for inline formulas; the dialog checkbox is the fallback for users who don't know the syntax or type with a CJK IME.

## Editing and deleting

Inserting a formula via the toolbar ∑ button or `/formula` follows a **dialog-first flow** (same as inserting a link): the dialog opens prefilled with a sample formula (E = mc^2, ready to edit) and an "Inline formula" checkbox below the source input, live preview and error feedback; clicking "OK" inserts exactly what you typed and selects the new node, while clicking "Cancel" leaves the document untouched — no placeholder formula is ever left behind. When editing an existing formula the checkbox starts from the node's current type — toggling it **converts the formula in place** (inline ↔ block, single undo step; block → inline replaces the block with a paragraph holding the formula). Click an existing formula to select it; the bubble menu offers "Edit formula" (the same dialog, prefilled) and "Delete formula". While the dialog is open the editor is blurred, so the confirm action writes back to the node position captured when the dialog opened — it can never update the wrong node.

Readonly and preview modes hide the bubble menu.

## Markdown round-trip

Block formulas import and export as standard `$$` blocks (own lines, content may span lines):

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
```

Inline formulas export as `$latex$` source as a fallback; inline `$…$` import (with currency protection) arrives in a later release. HTML / JSON always preserve formula nodes.

## Print / PDF export

Formulas in the print copy are replaced with native MathML rendered by the browser itself — no KaTeX CSS or font files involved, so exports work offline.

## Stylesheet

KaTeX loads on demand. Its stylesheet ships as a separate adapter entry next to `style.css`:

```ts
import 'tiptap-vue-pro-element-plus/style.css'
import 'tiptap-vue-pro-element-plus/katex.css' // includes KaTeX fonts, loaded on demand
```

Skip it if you do not need formulas (nodes degrade to plain source text), or disable the feature entirely with the extension switch:

```ts
const ctx = useProEditor({ /* ... */ })
// inside useProEditor: createEditorExtensions({ math: false })
```

Note: passing custom `extensions` fully replaces the default extension set. Add `MathInline` / `MathBlock` (imported from `tiptap-vue-pro-core`) yourself to keep formula commands and Markdown round-trip working.

## Writing formulas: syntax cheatsheet

The edit dialog has a collapsible "Syntax cheatsheet" panel — click a snippet to insert it at the cursor. The full syntax lives in the [KaTeX supported list](https://katex.org/docs/supported).

| To write | Syntax |
| --- | --- |
| Superscript x² / subscript a₁ | `x^2` / `a_1` |
| Fraction a/b | `\\frac{a}{b}` |
| Square root | `\\sqrt{x}` |
| Sum ∫ product limits | `\\sum_{i=1}^{n}` / `\\int_a^b` / `\\lim_{x \\to 0}` |
| Greek letters α β π | `\\alpha` `\\beta` `\\pi` |
| ± × ∞ ∂ ≤ ≥ ≠ | `\\pm` `\\times` `\\infty` `\\partial` `\\leq` `\\geq` `\\neq` |
| Matrix | `\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}` |
| Piecewise | `\\begin{cases} x^2, & x ≥ 0 \\\\ -x, & x < 0 \\end{cases}` |
| Aligned rows | `\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}` |

Three rules cover most of it: commands start with a backslash `\\`, braces `{ }` group arguments, and inside environments `\\` breaks rows while `&` aligns columns.

## Security and error handling

`trust` is pinned to `false` (`\href` and similar commands never emit links), and `throwOnError: true` is caught by the renderer: invalid LaTeX renders the source with an error style inside the node without affecting the rest of the document. `maxExpand` keeps its default cap against macro-expansion abuse. Hosts may pass safe `katexOptions` (for example custom `macros`) or inject a custom render function via `ProEditorOptions.math`.
