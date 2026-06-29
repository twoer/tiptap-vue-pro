export type EditorLinkTarget = '_blank' | '_self'

export interface EditorLinkBehaviorOptions {
  defaultTarget?: EditorLinkTarget
}

export interface EditorTableBehaviorOptions {
  withHeaderRow?: boolean
}

export interface EditorImageBehaviorOptions {
  accept?: string
}

export interface EditorBehaviorOptions {
  link?: EditorLinkBehaviorOptions
  table?: EditorTableBehaviorOptions
  image?: EditorImageBehaviorOptions
}

export interface ResolvedEditorBehaviorOptions {
  link: Required<EditorLinkBehaviorOptions>
  table: Required<EditorTableBehaviorOptions>
  image: Required<EditorImageBehaviorOptions>
}

export const DEFAULT_EDITOR_BEHAVIOR_OPTIONS: ResolvedEditorBehaviorOptions = {
  link: {
    defaultTarget: '_blank',
  },
  table: {
    withHeaderRow: true,
  },
  image: {
    accept: 'image/*',
  },
}

export function resolveEditorBehaviorOptions(
  options: EditorBehaviorOptions = {},
): ResolvedEditorBehaviorOptions {
  return {
    link: {
      defaultTarget: options.link?.defaultTarget ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.link.defaultTarget,
    },
    table: {
      withHeaderRow: options.table?.withHeaderRow ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.table.withHeaderRow,
    },
    image: {
      accept: options.image?.accept ?? DEFAULT_EDITOR_BEHAVIOR_OPTIONS.image.accept,
    },
  }
}
