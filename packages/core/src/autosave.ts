import { readonly, ref, type Ref } from 'vue'

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type AutosaveReason = 'change' | 'manual' | 'retry' | 'unmount'

export interface AutosaveState {
  status: AutosaveStatus
  lastSavedAt: number | null
  error: unknown | null
  hasUnsavedChanges: boolean
}

export interface AutosaveSaveContext {
  key?: string | number
  reason: AutosaveReason
  revision: number
}

export interface AutosaveOptions<T = string | object> {
  key?: string | number
  enabled?: boolean
  delay?: number
  saveOnUnmount?: boolean
  getIdentity?: (content: T) => string
  onSave: (
    content: T,
    context: AutosaveSaveContext,
  ) => Promise<void> | void
}

export interface AutosaveController<T> {
  readonly state: Readonly<Ref<AutosaveState>>
  getLastSavedContent: () => T
  schedule: (content: T) => void
  flush: (
    reason?: Extract<AutosaveReason, 'change' | 'manual' | 'unmount'>,
  ) => Promise<void>
  retry: () => Promise<void>
  reset: (content: T) => void
  dispose: () => void
}

interface SaveTask<T> {
  content: T
  identity: string
  key?: string | number
  onSave: AutosaveOptions<T>['onSave']
  revision: number
  generation: number
}

const IDLE_STATE: AutosaveState = {
  status: 'idle',
  lastSavedAt: null,
  error: null,
  hasUnsavedChanges: false,
}

function enabledOptions<T>(
  getOptions: () => false | AutosaveOptions<T> | undefined,
) {
  const options = getOptions()
  return options && options.enabled !== false ? options : null
}

function normalizedDelay(value: number | undefined) {
  if (value === undefined) return 1000
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function createAutosaveController<T>(
  getOptions: () => false | AutosaveOptions<T> | undefined,
  initialContent: T,
): AutosaveController<T> {
  const state = ref<AutosaveState>({ ...IDLE_STATE })
  let identityFallback = 0
  let generation = 0
  let revision = 0
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let queuedTask: SaveTask<T> | null = null
  let queuedReady = false
  let queuedReason: AutosaveReason = 'change'
  let retryTask: SaveTask<T> | null = null
  let activeTask: SaveTask<T> | null = null
  let activePromise: Promise<void> | null = null
  let lastSavedContent = initialContent

  function identity(content: T, options = enabledOptions(getOptions)) {
    try {
      if (options?.getIdentity) return `custom:${options.getIdentity(content)}`
      if (typeof content === 'string') return `string:${content}`
      return `json:${JSON.stringify(content)}`
    } catch {
      identityFallback += 1
      return `unserializable:${identityFallback}`
    }
  }

  let lastSavedIdentity = identity(initialContent)

  function setState(next: AutosaveState) {
    if (disposed) return
    state.value = next
  }

  function clearTimer() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function markQueuedState() {
    setState({
      status: activeTask ? 'saving' : 'dirty',
      lastSavedAt: state.value.lastSavedAt,
      error: null,
      hasUnsavedChanges: true,
    })
  }

  async function startReadyTask(): Promise<void> {
    if (disposed || activePromise || !queuedTask || !queuedReady) return

    const task = queuedTask
    const reason = queuedReason
    queuedTask = null
    queuedReady = false
    queuedReason = 'change'
    retryTask = null
    activeTask = task
    setState({
      status: 'saving',
      lastSavedAt: state.value.lastSavedAt,
      error: null,
      hasUnsavedChanges: true,
    })

    activePromise = Promise.resolve()
      .then(() => task.onSave(task.content, {
        key: task.key,
        reason,
        revision: task.revision,
      }))
      .then(() => {
        if (disposed || task.generation !== generation) return

        lastSavedIdentity = task.identity
        lastSavedContent = task.content
        if (queuedTask?.identity === task.identity) {
          queuedTask = null
          queuedReady = false
          clearTimer()
        }

        const hasNewerContent = !!queuedTask
        setState({
          status: hasNewerContent ? 'dirty' : 'saved',
          lastSavedAt: Date.now(),
          error: null,
          hasUnsavedChanges: hasNewerContent,
        })
      })
      .catch((error: unknown) => {
        if (disposed || task.generation !== generation) return
        if (!queuedTask) retryTask = task
        setState({
          status: 'error',
          lastSavedAt: state.value.lastSavedAt,
          error,
          hasUnsavedChanges: true,
        })
      })
      .finally(() => {
        activeTask = null
        activePromise = null
        if (!disposed && queuedTask && queuedReady) void startReadyTask()
      })

    await activePromise
  }

  function armTimer(delay: number) {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      if (disposed || !queuedTask) return
      queuedReady = true
      queuedReason = 'change'
      void startReadyTask()
    }, delay)
  }

  function schedule(content: T) {
    if (disposed) return
    const options = enabledOptions(getOptions)
    if (!options) return
    const nextIdentity = identity(content, options)

    if (!activeTask && nextIdentity === lastSavedIdentity) {
      clearTimer()
      queuedTask = null
      queuedReady = false
      retryTask = null
      setState({
        status: state.value.lastSavedAt === null ? 'idle' : 'saved',
        lastSavedAt: state.value.lastSavedAt,
        error: null,
        hasUnsavedChanges: false,
      })
      return
    }
    if (activeTask?.identity === nextIdentity && !queuedTask) return
    if (queuedTask?.identity === nextIdentity) return

    revision += 1
    queuedTask = {
      content,
      identity: nextIdentity,
      key: options.key,
      onSave: options.onSave,
      revision,
      generation,
    }
    queuedReady = false
    queuedReason = 'change'
    retryTask = null
    markQueuedState()
    armTimer(normalizedDelay(options.delay))
  }

  async function drainReadyQueue() {
    while (!disposed) {
      if (activePromise) {
        await activePromise
        continue
      }
      if (queuedTask && queuedReady) {
        await startReadyTask()
        continue
      }
      break
    }
  }

  async function flush(
    reason: Extract<AutosaveReason, 'change' | 'manual' | 'unmount'> = 'manual',
  ) {
    if (disposed) return
    clearTimer()
    if (!queuedTask && retryTask) {
      queuedTask = retryTask
      retryTask = null
    }
    if (queuedTask) {
      queuedReady = true
      queuedReason = reason
    }
    await drainReadyQueue()
  }

  async function retry() {
    if (disposed) return
    clearTimer()
    if (!queuedTask && retryTask) {
      queuedTask = retryTask
      retryTask = null
    }
    if (queuedTask) {
      queuedReady = true
      queuedReason = 'retry'
    }
    await drainReadyQueue()
  }

  function reset(content: T) {
    if (disposed) return
    clearTimer()
    generation += 1
    queuedTask = null
    queuedReady = false
    queuedReason = 'change'
    retryTask = null
    lastSavedIdentity = identity(content)
    lastSavedContent = content
    setState({ ...IDLE_STATE })
  }

  function dispose() {
    if (disposed) return
    clearTimer()
    generation += 1
    queuedTask = null
    queuedReady = false
    retryTask = null
    disposed = true
  }

  return {
    state: readonly(state) as Readonly<Ref<AutosaveState>>,
    getLastSavedContent: () => lastSavedContent,
    schedule,
    flush,
    retry,
    reset,
    dispose,
  }
}
