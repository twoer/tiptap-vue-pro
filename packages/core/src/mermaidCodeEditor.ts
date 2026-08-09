import type { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import type { Compartment, Extension, StateEffectType } from '@codemirror/state'
import type { MermaidTheme } from './mermaid'

export interface MermaidCodeEditorControllerOptions {
  source: string
  ariaLabel?: string
  editable?: boolean
  theme?: MermaidTheme
  errorLine?: number | null
  onChange?: (source: string) => void
  onUndo?: () => void
  onRedo?: () => void
}

export interface MermaidCodeEditorController {
  mount: (parent: HTMLElement) => Promise<void>
  updateSource: (source: string) => void
  setEditable: (editable: boolean) => void
  setTheme: (theme: MermaidTheme) => void
  setErrorLine: (line: number | null) => void
  focus: () => void
  getSource: () => string
  destroy: () => void
}

type CodeMirrorModules = {
  state: typeof import('@codemirror/state')
  view: typeof import('@codemirror/view')
  commands: typeof import('@codemirror/commands')
  language: typeof import('@codemirror/language')
  search: typeof import('@codemirror/search')
}

let codeMirrorModulesPromise: Promise<CodeMirrorModules> | null = null

function loadCodeMirrorModules(): Promise<CodeMirrorModules> {
  codeMirrorModulesPromise ??= Promise.all([
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('@codemirror/commands'),
    import('@codemirror/language'),
    import('@codemirror/search'),
  ]).then(([state, view, commands, language, search]) => ({
    state,
    view,
    commands,
    language,
    search,
  }))
  return codeMirrorModulesPromise
}

function codeMirrorTheme(EditorView: typeof import('@codemirror/view')['EditorView'], theme: MermaidTheme) {
  return EditorView.theme({
    '&': {
      height: '100%',
      color: 'var(--tvp-mermaid-code-text)',
      backgroundColor: 'var(--tvp-mermaid-code-bg)',
      fontSize: '13px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: '1.6',
    },
    '.cm-content': { padding: '12px 0', caretColor: 'var(--tvp-mermaid-code-caret)' },
    '.cm-line': { padding: '0 12px 0 8px' },
    '.cm-gutters': {
      color: 'var(--tvp-mermaid-gutter-text)',
      backgroundColor: 'var(--tvp-mermaid-gutter-bg)',
      borderRight: '1px solid var(--tvp-mermaid-divider)',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'var(--tvp-mermaid-active-line)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--tvp-mermaid-selection)',
    },
    '.tvp-cm-error-line': {
      backgroundColor: 'var(--tvp-mermaid-error-line)',
      boxShadow: 'inset 3px 0 0 var(--tvp-mermaid-error)',
    },
  }, { dark: theme === 'dark' })
}

export function createMermaidCodeEditorController(
  options: MermaidCodeEditorControllerOptions,
): MermaidCodeEditorController {
  let source = options.source
  let editable = options.editable ?? true
  let theme = options.theme ?? 'light'
  let errorLine = options.errorLine ?? null
  let view: CodeMirrorEditorView | null = null
  let destroyed = false
  let focusRequested = false
  let applyingExternalSource = false
  let themeCompartment: Compartment | null = null
  let editableCompartment: Compartment | null = null
  let setErrorLineEffect: StateEffectType<number | null> | null = null
  let createEditableExtensions: ((value: boolean) => Extension) | null = null
  let createThemeExtension: ((value: MermaidTheme) => Extension) | null = null

  const controller: MermaidCodeEditorController = {
    async mount(parent) {
      if (view || destroyed) return
      const { state, view: viewModule, commands, language, search } = await loadCodeMirrorModules()
      if (destroyed) return

      const { EditorState, Compartment, StateEffect, StateField } = state
      const {
        Decoration,
        EditorView,
        crosshairCursor,
        drawSelection,
        dropCursor,
        highlightActiveLine,
        highlightActiveLineGutter,
        highlightSpecialChars,
        keymap,
        lineNumbers,
        rectangularSelection,
      } = viewModule

      themeCompartment = new Compartment()
      editableCompartment = new Compartment()
      setErrorLineEffect = StateEffect.define<number | null>()
      const effect = setErrorLineEffect
      const errorLineField = StateField.define({
        create: () => Decoration.none,
        update(decorations, transaction) {
          for (const item of transaction.effects) {
            if (!item.is(effect)) continue
            if (item.value == null) return Decoration.none
            const line = transaction.state.doc.line(
              Math.min(Math.max(1, item.value), transaction.state.doc.lines),
            )
            return Decoration.set(Decoration.line({ class: 'tvp-cm-error-line' }).range(line.from))
          }
          return transaction.docChanged ? decorations.map(transaction.changes) : decorations
        },
        provide: field => EditorView.decorations.from(field),
      })

      createEditableExtensions = (value: boolean) => [
        EditorView.editable.of(value),
        EditorState.readOnly.of(!value),
      ]
      createThemeExtension = value => codeMirrorTheme(EditorView, value)
      const shortcutKeymap = [
        {
          any: (_view: CodeMirrorEditorView, event: KeyboardEvent) => {
            if (!event.metaKey && !event.ctrlKey) return false
            const key = event.key.toLowerCase()
            if (key === 'z') {
              if (event.shiftKey) options.onRedo?.()
              else options.onUndo?.()
              return true
            }
            if (key !== 'y') return false
            options.onRedo?.()
            return true
          },
        },
        commands.indentWithTab,
        ...commands.defaultKeymap,
        ...search.searchKeymap,
      ]

      const editorState = EditorState.create({
        doc: source,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          language.indentOnInput(),
          language.bracketMatching(),
          language.syntaxHighlighting(language.defaultHighlightStyle, { fallback: true }),
          search.highlightSelectionMatches(),
          keymap.of(shortcutKeymap),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': options.ariaLabel ?? 'Mermaid source code',
          }),
          EditorView.updateListener.of(update => {
            if (!update.docChanged || applyingExternalSource) return
            source = update.state.doc.toString()
            options.onChange?.(source)
          }),
          themeCompartment.of(createThemeExtension(theme)),
          editableCompartment.of(createEditableExtensions(editable)),
          errorLineField,
        ],
      })

      view = new EditorView({ state: editorState, parent })
      view.dom.classList.toggle('cm-theme-dark', theme === 'dark')
      controller.setErrorLine(errorLine)
      if (focusRequested) {
        focusRequested = false
        view.focus()
      }
    },
    updateSource(nextSource) {
      source = nextSource
      if (!view || view.state.doc.toString() === nextSource) return
      applyingExternalSource = true
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextSource },
      })
      applyingExternalSource = false
    },
    setEditable(nextEditable) {
      editable = nextEditable
      if (!view || !editableCompartment || !createEditableExtensions) return
      view.dispatch({ effects: editableCompartment.reconfigure(createEditableExtensions(editable)) })
    },
    setTheme(nextTheme) {
      theme = nextTheme
      if (!view || !themeCompartment || !createThemeExtension) return
      view.dispatch({ effects: themeCompartment.reconfigure(createThemeExtension(theme)) })
      view.dom.classList.toggle('cm-theme-dark', theme === 'dark')
    },
    setErrorLine(nextLine) {
      errorLine = nextLine
      if (!view || !setErrorLineEffect) return
      view.dispatch({ effects: setErrorLineEffect.of(errorLine) })
    },
    focus() {
      if (view) {
        view.focus()
        return
      }
      focusRequested = true
    },
    getSource() {
      return view?.state.doc.toString() ?? source
    },
    destroy() {
      destroyed = true
      view?.destroy()
      view = null
    },
  }

  return controller
}
