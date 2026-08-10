# Local Draft Recovery

Local drafts are an optional loss-prevention layer beside remote Autosave. They cover refreshes, tab closes, and browser crashes that happen before a remote save succeeds.

```vue
<ProEditorElementPlus
  v-model="content"
  :autosave="{ key: articleId, onSave: saveArticle }"
  :draft="{ key: articleId, delay: 300, maxAge: 7 * 24 * 60 * 60 * 1000 }"
  @draft-found="handleDraftFound"
  @draft-error="reportDraftError"
/>
```

Drafts are disabled by default and require a stable, non-empty `key`. The default implementation writes a versioned JSON envelope under:

```text
tiptap-vue-pro:draft:<encoded-document-key>
```

## Recovery Rules

- Complete HTML or JSON output is written locally with an independent debounce.
- Mounting or changing keys only discovers a draft; it never overwrites `modelValue`.
- A different valid draft shows explicit Restore and Delete actions.
- While recovery is pending, the historical draft is preserved and local overwrites pause until Restore or Delete is chosen.
- Restore follows the normal editor update path, updates `v-model`, and schedules remote Autosave.
- A successful latest remote save removes only a local draft with the matching identity.
- Failed remote saves keep the draft; later edits replace it with the latest complete document.
- Malformed, wrong-key, unsupported, and expired envelopes cannot be restored.

## Custom Storage

`storage` accepts synchronous or asynchronous implementations:

```ts
interface LocalDraftStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}
```

Core also exports `createBrowserLocalDraftStorage(prefix?)`. It resolves browser APIs only when a method is called, so the module remains SSR-importable.

## Privacy

Drafts in the default `localStorage` implementation are **not encrypted**. Disable drafts for sensitive content or provide encrypted/controlled storage. This feature is not an offline request queue, version history, or conflict-merging system.
