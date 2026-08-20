# Props

The three adapters expose the same props.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `modelValue` | `string \| object` | `''` | Value bound with `v-model` |
| `output` | `'html' \| 'json'` | `'html'` | Output format |
| `placeholder` | `string` | Current locale default | Placeholder text |
| `locale` | `'zh-CN' \| 'en-US' \| LocaleOptions` | `'zh-CN'` | Built-in locale or partial message overrides |
| `uploadImage` | `(file: File) => Promise<string \| null>` | - | Image upload function; enables upload, paste, and drag/drop |
| `uploadAsset` | `(file: File, kind: UploadAssetKind) => Promise<string \| UploadedAsset \| null>` | - | Video, audio, and file upload function; enables the attachment menu |
| `readonly` | `boolean` | `false` | Readonly mode |
| `dark` | `boolean` | `false` | Component-level dark mode |
| `showWordCount` | `boolean` | `true` | Whether to show the footer word count |
| `autosave` | `false \| AutosaveOptions<string \| object>` | `false` | Autosave config; shows save status in the footer when enabled |
| `draft` | `false \| LocalDraftOptions<string \| object>` | `false` | Local draft recovery config; requires a stable document key |
| `toolbar` | `ToolbarConfig \| false` | Full default toolbar | Controls toolbar button groups and order |
| `toolbarLayout` | `'classic' \| 'compact'` | `'classic'` | Toolbar layout; compact moves lower-frequency actions into structured menus |
| `toolbarOptions` | `ToolbarOptions` | Default menu config | Controls toolbar menu data and action parameters |
| `editorBehaviorOptions` | `EditorBehaviorOptions` | Default behavior config | Controls default behavior for links, tables, images, and media |
| `extensions` | `Extensions` | Default extension set | Custom Tiptap extensions; replaces the default extension set when provided |
| `debug` | `boolean \| ProEditorDebugOptions` | `false` | Developer diagnostics switch for integration and editor behavior debugging |
| `debugLogger` | `(entry: ProEditorDebugEntry) => void` | `console.debug` | Custom diagnostics log receiver |

## Events

| Event | Description |
| --- | --- |
| `update:modelValue` | Emitted when editor content changes; used by `v-model` |
| `autosave-status-change` | Emitted with a new `AutosaveState` snapshot for every state transition |
| `autosave-error` | Emitted when saving enters the error state, with the error thrown by `onSave` |
| `draft-found` | Emitted when a valid local draft differs from current content |
| `draft-restored` | Emitted after an explicit draft restore |
| `draft-cleared` | Emitted after deleting a local draft, with its document key |
| `draft-error` | Emitted for storage, serialization, or configuration errors |

## Slots

| Slot | Description |
| --- | --- |
| `toolbar` | Fully replaces the built-in toolbar |
| `toolbar-before` | Inserts content before built-in toolbar buttons |
| `toolbar-after` | Inserts content after built-in toolbar buttons |

## Locale

Built-in locales include Chinese and English:

```vue
<ProEditorElementPlus v-model="content" locale="en-US" />
```

You can also override only a few messages:

```vue
<ProEditorElementPlus
  v-model="content"
  :locale="{
    locale: 'en-US',
    messages: {
      'command.bold': 'Strong',
      'placeholder.default': 'Start writing...',
    },
  }"
/>
```

`locale` affects the built-in toolbar, dialogs, message text, preview bar, word count, autosave status, and the default placeholder when `placeholder` is not explicitly provided. Labels passed through custom `toolbarOptions` are displayed as-is and are not overwritten by the built-in dictionary.

See [Autosave](/en/guide/autosave) for behavior, concurrency guarantees, and examples.
See [Local Draft Recovery](/en/guide/local-drafts) for storage and privacy details.

## UploadAsset

`uploadAsset` is used for video, audio, and generic file upload. `kind` identifies the current entry:

```ts
type UploadAssetKind = 'image' | 'video' | 'audio' | 'file'

interface UploadedAsset {
  url: string
  name?: string
  size?: number
  mimeType?: string
  fileTypeText?: string
  uploadedAt?: string | number | Date
  duration?: number
  poster?: string
}
```

Returning a `string` treats it as the asset URL, and Core fills `name`, `size`, and `mimeType` from the original `File`. Returning `UploadedAsset` preserves server metadata. `fileTypeText` overrides the file card type label. Returning `null` skips insertion.

## Developer Diagnostics

`debug` and `debugLogger` are for developer troubleshooting and are disabled by default. They can filter lifecycle, content, selection, transaction, command, upload, markdown, adapter, and table logs by channel. See [Developer Diagnostics](/en/advanced/developer-diagnostics).
