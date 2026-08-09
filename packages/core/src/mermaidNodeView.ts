import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { LocaleTranslate } from './locale'
import { createMermaidCodeEditorController, type MermaidCodeEditorController } from './mermaidCodeEditor'
import { normalizeMermaidViewMode, type MermaidTheme, type MermaidViewMode } from './mermaid'
import { createMermaidRenderController, type MermaidRenderState } from './mermaidRenderer'
import { replaceMermaidBlockSource } from './extensions/mermaidBlock'

export interface MermaidNodeViewContext {
  dark: Readonly<Ref<boolean>>
  editable: Readonly<Ref<boolean>>
  t: LocaleTranslate
}

export interface MermaidNodeViewProps {
  node: ProseMirrorNode
  editor: Editor
  getPos: () => number | undefined
  updateAttributes: (attributes: Record<string, unknown>) => void
}

export const MERMAID_NODE_VIEW_CONTEXT: InjectionKey<MermaidNodeViewContext> = Symbol(
  'tvpMermaidNodeViewContext',
)

const EMPTY_RENDER_STATE: MermaidRenderState = {
  status: 'idle',
  svg: '',
  error: '',
  errorLine: null,
}

export function useMermaidNodeView(props: MermaidNodeViewProps) {
  const injected = inject(MERMAID_NODE_VIEW_CONTEXT, null)
  const mounted = ref(false)
  const codeHost = ref<HTMLElement | null>(null)
  const renderState = ref<MermaidRenderState>({ ...EMPTY_RENDER_STATE })
  const source = computed(() => props.node.textContent)
  const viewMode = computed(() => normalizeMermaidViewMode(props.node.attrs.viewMode))
  const showCode = computed(() => viewMode.value !== 'diagram')
  const showDiagram = computed(() => viewMode.value !== 'code')
  const editable = computed(() => injected?.editable.value ?? props.editor.isEditable)
  const theme = computed<MermaidTheme>(() => injected?.dark.value ? 'dark' : 'light')
  const t = (key: Parameters<LocaleTranslate>[0], params?: Record<string, string | number>) =>
    injected?.t(key, params) ?? key

  const renderController = createMermaidRenderController({
    onState: state => {
      renderState.value = state
      codeEditor?.setErrorLine(state.errorLine)
    },
  })
  let codeEditor: MermaidCodeEditorController | null = null
  let codeEditorVersion = 0

  async function mountCodeEditor() {
    const version = ++codeEditorVersion
    codeEditor?.destroy()
    codeEditor = null
    if (!mounted.value || !showCode.value) return
    await nextTick()
    if (version !== codeEditorVersion || !codeHost.value) return

    const controller = createMermaidCodeEditorController({
      source: source.value,
      ariaLabel: t('mermaid.code.label'),
      editable: editable.value,
      theme: theme.value,
      errorLine: renderState.value.errorLine,
      onChange: nextSource => {
        replaceMermaidBlockSource(props.editor.view, props.getPos, nextSource)
      },
      onUndo: () => props.editor.commands.undo(),
      onRedo: () => props.editor.commands.redo(),
    })
    codeEditor = controller
    await controller.mount(codeHost.value)
    if (version !== codeEditorVersion) controller.destroy()
  }

  function renderDiagram() {
    if (!mounted.value || !showDiagram.value) {
      renderController.cancel()
      return
    }
    if (!source.value.trim()) {
      renderController.reset()
      return
    }
    void renderController.render(source.value, theme.value)
  }

  function setViewMode(mode: MermaidViewMode) {
    if (!editable.value || mode === viewMode.value) return
    props.updateAttributes({ viewMode: mode })
    if (mode !== 'diagram') focusSource()
  }

  async function focusSource() {
    await nextTick()
    if (!showCode.value) return
    if (!codeEditor) await mountCodeEditor()
    await new Promise<void>(resolve => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve())
      } else {
        setTimeout(resolve, 0)
      }
    })
    if (!mounted.value || !showCode.value) return
    codeEditor?.focus()
  }

  function editDiagram() {
    if (!editable.value) return
    setViewMode('split')
  }

  watch(source, value => {
    codeEditor?.updateSource(value)
    renderDiagram()
  })
  watch(theme, value => {
    codeEditor?.setTheme(value)
    renderDiagram()
  })
  watch(editable, value => codeEditor?.setEditable(value))
  watch(showCode, () => void mountCodeEditor())
  watch(showDiagram, renderDiagram)

  onMounted(() => {
    mounted.value = true
    void mountCodeEditor()
    renderDiagram()
  })

  onBeforeUnmount(() => {
    mounted.value = false
    codeEditorVersion += 1
    codeEditor?.destroy()
    renderController.cancel()
  })

  return {
    codeHost,
    editable,
    renderState,
    showCode,
    showDiagram,
    source,
    theme,
    viewMode,
    editDiagram,
    focusSource,
    setViewMode,
    t,
  }
}
