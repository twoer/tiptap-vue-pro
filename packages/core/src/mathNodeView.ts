import { computed, inject, onBeforeUnmount, onMounted, ref, watch, type InjectionKey } from 'vue'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { LocaleTranslate } from './locale'
import type { SafeKatexOptions } from './mathRenderer'
import {
  createMathRenderController,
  renderMathToString,
  type MathRenderState,
  type MathRenderer,
} from './mathRenderer'

export interface MathNodeViewContext {
  dark: { readonly value: boolean }
  editable: { readonly value: boolean }
  t: LocaleTranslate
}

export interface MathNodeViewProps {
  node: ProseMirrorNode
  editor: Editor
}

export const MATH_NODE_VIEW_CONTEXT: InjectionKey<MathNodeViewContext> = Symbol(
  'tvpMathNodeViewContext',
)

const EMPTY_STATE: MathRenderState = { status: 'idle', html: '', error: '' }

/**
 * 数学公式 NodeView 的 headless composable(mermaid 的 useMermaidNodeView 同款分层):
 * core 负责状态与渲染,adapter 的 Vue 组件只做展示。
 *
 * 宿主通过 ProEditorOptions.math 配置的 render / katexOptions 存放在
 * mathBlock 扩展 storage 里(两个节点共享同一份配置),这里在每次渲染时读取。
 */
export function useMathNodeView(props: MathNodeViewProps) {
  const injected = inject(MATH_NODE_VIEW_CONTEXT, null)
  const renderState = ref<MathRenderState>({ ...EMPTY_STATE })

  const latex = computed(() => String(props.node.attrs.latex ?? ''))
  const isBlock = computed(() => props.node.type.name === 'mathBlock')
  const editable = computed(() => injected?.editable.value ?? props.editor.isEditable)
  const theme = computed<'dark' | 'light'>(() => (injected?.dark.value ? 'dark' : 'light'))
  const t = (key: Parameters<LocaleTranslate>[0], params?: Record<string, string | number>) =>
    injected?.t(key, params) ?? key

  const mathStorage = computed(() => {
    const storage = props.editor.extensionStorage as unknown as Record<string, unknown>
    return storage.mathBlock as { getKatexOptions?: () => SafeKatexOptions; getRender?: () => MathRenderer | undefined } | undefined
  })

  const controller = createMathRenderController({
    render: (source, options) => {
      const render = mathStorage.value?.getRender?.() ?? renderMathToString
      return render(source, {
        ...options,
        katexOptions: options.katexOptions ?? mathStorage.value?.getKatexOptions?.(),
      })
    },
    onState: state => {
      renderState.value = state
    },
  })

  function renderFormula() {
    if (!latex.value.trim()) {
      controller.reset()
      return
    }
    void controller.render(latex.value, { displayMode: isBlock.value })
  }

  watch([latex, isBlock], renderFormula)
  onMounted(renderFormula)
  onBeforeUnmount(() => controller.cancel())

  return {
    latex,
    isBlock,
    editable,
    theme,
    renderState,
    t,
  }
}
