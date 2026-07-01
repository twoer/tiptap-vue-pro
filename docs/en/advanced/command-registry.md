# Command Registry

The command registry connects built-in toolbar buttons to Core commands. It mainly supports custom toolbars, button capability audits, and equivalent behavior across the three adapters.

```ts
import {
  getCommandLabel,
  isToolbarCommandActive,
  runToolbarCommand,
  type ToolbarBuiltinKey,
} from 'tiptap-vue-pro-core'

const id: ToolbarBuiltinKey = 'bold'

console.log(getCommandLabel(id))
runToolbarCommand(ctx, id)
console.log(isToolbarCommandActive(ctx, id))
```

## Common Uses

| Use case | API |
| --- | --- |
| Read button label | `getCommandLabel(id)` |
| Run a built-in command | `runToolbarCommand(ctx, id, payload)` |
| Check active state | `isToolbarCommandActive(ctx, id, payload)` |
| Get the active heading level | `getActiveHeadingLevel(ctx)` |
| Get the current text alignment | `getActiveTextAlign(ctx)` |

Some buttons are compound UI, such as link dialogs, image upload, table grid, Markdown import/export, print, preview, and fullscreen. These buttons do not have a simple `execute`; adapters render the corresponding interaction.

## Relationship With Custom Toolbars

If you only want to reuse built-in commands, call `ctx.commands` directly. If you want to render a toolbar dynamically from button ids, use the command registry to read labels, active state, and execute functions.
