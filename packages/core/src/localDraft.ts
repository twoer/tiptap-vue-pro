import { readonly, shallowRef, type Ref } from 'vue'

export type Awaitable<T> = T | Promise<T>

export interface LocalDraftStorage {
  getItem: (key: string) => Awaitable<string | null>
  setItem: (key: string, value: string) => Awaitable<void>
  removeItem: (key: string) => Awaitable<void>
}

export interface LocalDraftEnvelopeV1<T = string | object> {
  version: 1
  key: string
  updatedAt: number
  identity: string
  content: T
}

export interface LocalDraftCandidate<T = string | object> {
  key: string
  updatedAt: number
  content: T
}

export type LocalDraftStatus = 'idle' | 'checking' | 'available' | 'restoring' | 'error'

export interface LocalDraftState<T = string | object> {
  status: LocalDraftStatus
  candidate: LocalDraftCandidate<T> | null
  error: unknown | null
}

export interface LocalDraftOptions<T = string | object> {
  key: string
  enabled?: boolean
  delay?: number
  maxAge?: number
  storage?: LocalDraftStorage
  getIdentity?: (content: T) => string
}

export interface LocalDraftController<T> {
  readonly state: Readonly<Ref<LocalDraftState<T>>>
  schedule: (content: T) => void
  discover: (content: T) => Promise<void>
  restore: () => LocalDraftCandidate<T> | null
  discard: () => Promise<string | null>
  markRemoteSaved: (content: T) => Promise<void>
  reset: (content: T) => void
  flush: () => Promise<void>
  dispose: () => void
}

interface ResolvedDraftOptions<T> extends LocalDraftOptions<T> {
  key: string
  storage: LocalDraftStorage
  storageKey: string
}

interface DraftWriteTask<T> {
  content: T
  identity: string
  key: string
  storageKey: string
  storage: LocalDraftStorage
  generation: number
}

const IDLE_STATE = {
  status: 'idle',
  candidate: null,
  error: null,
} as const
const DEFAULT_DELAY = 300
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000
const DEFAULT_STORAGE_PREFIX = 'tiptap-vue-pro:draft:'

function storageKey(key: string) {
  return `${DEFAULT_STORAGE_PREFIX}${encodeURIComponent(key)}`
}

function normalizedDelay(value: number | undefined) {
  if (value === undefined) return DEFAULT_DELAY
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function normalizedMaxAge(value: number | undefined) {
  if (value === Infinity) return Infinity
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_MAX_AGE
  return Math.max(0, value)
}

function isDraftContent(value: unknown): value is string | object {
  return typeof value === 'string' || (typeof value === 'object' && value !== null)
}

function parseEnvelope<T>(
  raw: string,
  key: string,
  maxAge: number,
): LocalDraftEnvelopeV1<T> | null {
  try {
    const value = JSON.parse(raw) as Partial<LocalDraftEnvelopeV1<T>>
    if (
      value.version !== 1
      || value.key !== key
      || typeof value.updatedAt !== 'number'
      || !Number.isFinite(value.updatedAt)
      || value.updatedAt <= 0
      || typeof value.identity !== 'string'
      || !isDraftContent(value.content)
    ) return null
    if (maxAge !== Infinity && Date.now() - value.updatedAt > maxAge) return null
    return value as LocalDraftEnvelopeV1<T>
  } catch {
    return null
  }
}

export function createBrowserLocalDraftStorage(prefix = ''): LocalDraftStorage {
  function browserStorage() {
    if (typeof window === 'undefined') {
      throw new Error('Browser local draft storage is unavailable during SSR')
    }
    return window.localStorage
  }

  return {
    getItem: key => browserStorage().getItem(`${prefix}${key}`),
    setItem: (key, value) => browserStorage().setItem(`${prefix}${key}`, value),
    removeItem: key => browserStorage().removeItem(`${prefix}${key}`),
  }
}

export function createLocalDraftController<T>(
  getOptions: () => false | LocalDraftOptions<T> | undefined,
  initialContent: T,
): LocalDraftController<T> {
  const state = shallowRef<LocalDraftState<T>>({ ...IDLE_STATE })
  const defaultStorage = createBrowserLocalDraftStorage()
  let disposed = false
  let generation = 0
  let discoveryToken = 0
  let identityFallback = 0
  let invalidKeyReported = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let queuedTask: DraftWriteTask<T> | null = null
  let queuedReady = false
  let activeTask: DraftWriteTask<T> | null = null
  let activeWrite: Promise<void> | null = null
  let operationQueue = Promise.resolve<void>(undefined)
  let candidateIdentity: string | null = null
  let lastWrittenIdentity: string | null = null
  let sessionDraftIdentity: string | null = null
  let deferredSchedule: { content: T } | null = null

  function setState(next: LocalDraftState<T>) {
    if (!disposed) state.value = next
  }

  function reportError(error: unknown) {
    setState({
      status: 'error',
      candidate: state.value.candidate,
      error,
    })
  }

  function resolveOptions(reportInvalidKey = true): ResolvedDraftOptions<T> | null {
    const options = getOptions()
    if (!options || options.enabled === false) return null
    const key = options.key.trim()
    if (!key) {
      if (reportInvalidKey && !invalidKeyReported) {
        invalidKeyReported = true
        reportError(new Error('Local draft key must be a non-empty string'))
      }
      return null
    }
    invalidKeyReported = false
    return {
      ...options,
      key,
      storage: options.storage ?? defaultStorage,
      storageKey: storageKey(key),
    }
  }

  function identity(content: T, options = resolveOptions(false)) {
    try {
      if (options?.getIdentity) return `custom:${options.getIdentity(content)}`
      if (typeof content === 'string') return `string:${content}`
      return `json:${JSON.stringify(content)}`
    } catch {
      identityFallback += 1
      return `unserializable:${identityFallback}`
    }
  }

  let remoteBaselineIdentity = identity(initialContent)

  function clearTimer() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function takeDeferredSchedule() {
    const deferred = deferredSchedule
    deferredSchedule = null
    return deferred
  }

  function enqueueOperation<R>(operation: () => Promise<R>): Promise<R> {
    const result = operationQueue.then(operation, operation)
    operationQueue = result.then(() => undefined, () => undefined)
    return result
  }

  async function startReadyWrite(): Promise<void> {
    if (disposed || activeWrite || !queuedTask || !queuedReady) return
    const task = queuedTask
    queuedTask = null
    queuedReady = false
    activeTask = task

    activeWrite = enqueueOperation(async () => {
      const envelope: LocalDraftEnvelopeV1<T> = {
        version: 1,
        key: task.key,
        updatedAt: Date.now(),
        identity: task.identity,
        content: task.content,
      }
      const raw = JSON.stringify(envelope)
      await task.storage.setItem(task.storageKey, raw)
    })
      .then(() => {
        if (disposed || task.generation !== generation) return
        lastWrittenIdentity = task.identity
        sessionDraftIdentity = task.identity
        if (state.value.status === 'error') setState({ ...IDLE_STATE })
      })
      .catch((error: unknown) => {
        if (!disposed && task.generation === generation) reportError(error)
      })
      .finally(() => {
        activeTask = null
        activeWrite = null
        if (!disposed && queuedTask && queuedReady) void startReadyWrite()
      })

    await activeWrite
  }

  function armTimer(delay: number) {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      if (disposed || !queuedTask) return
      queuedReady = true
      void startReadyWrite()
    }, delay)
  }

  function removeCurrentDraft(options: ResolvedDraftOptions<T>) {
    return enqueueOperation(async () => {
      await options.storage.removeItem(options.storageKey)
    })
  }

  function schedule(content: T) {
    if (disposed) return
    if (state.value.status === 'checking') {
      deferredSchedule = { content }
      return
    }
    if (state.value.status === 'available') return
    const options = resolveOptions()
    if (!options) return
    const nextIdentity = identity(content, options)
    discoveryToken += 1
    candidateIdentity = null
    setState({ ...IDLE_STATE })

    if (nextIdentity === remoteBaselineIdentity) {
      const shouldRemoveSessionDraft = sessionDraftIdentity !== null
        || activeTask?.generation === generation
      clearTimer()
      queuedTask = null
      queuedReady = false
      lastWrittenIdentity = null
      sessionDraftIdentity = null
      if (!shouldRemoveSessionDraft) return
      const currentGeneration = generation
      void removeCurrentDraft(options).catch((error: unknown) => {
        if (!disposed && currentGeneration === generation) reportError(error)
      })
      return
    }
    if (nextIdentity === lastWrittenIdentity && !activeWrite) return
    if (activeTask?.identity === nextIdentity && !queuedTask) return

    queuedTask = {
      content,
      identity: nextIdentity,
      key: options.key,
      storageKey: options.storageKey,
      storage: options.storage,
      generation,
    }
    queuedReady = false
    armTimer(normalizedDelay(options.delay))
  }

  async function discover(content: T) {
    if (disposed) return
    const options = resolveOptions()
    if (!options) return
    const currentGeneration = generation
    const token = ++discoveryToken
    const currentIdentity = identity(content, options)
    deferredSchedule = null
    setState({ status: 'checking', candidate: null, error: null })

    try {
      const found = await enqueueOperation(async () => {
        const raw = await options.storage.getItem(options.storageKey)
        if (raw === null) return null
        const parsed = parseEnvelope<T>(raw, options.key, normalizedMaxAge(options.maxAge))
        if (!parsed || parsed.identity === currentIdentity) {
          await options.storage.removeItem(options.storageKey)
          return null
        }
        return parsed
      })
      if (disposed || currentGeneration !== generation || token !== discoveryToken) return
      if (!found) {
        const deferred = takeDeferredSchedule()
        candidateIdentity = null
        lastWrittenIdentity = null
        setState({ ...IDLE_STATE })
        if (deferred) schedule(deferred.content)
        return
      }
      deferredSchedule = null
      candidateIdentity = found.identity
      lastWrittenIdentity = found.identity
      setState({
        status: 'available',
        candidate: {
          key: found.key,
          updatedAt: found.updatedAt,
          content: found.content,
        },
        error: null,
      })
    } catch (error) {
      if (!disposed && currentGeneration === generation && token === discoveryToken) {
        reportError(error)
      }
    }
  }

  function restore() {
    if (disposed || state.value.status !== 'available' || !state.value.candidate) return null
    const candidate = { ...state.value.candidate }
    setState({ status: 'restoring', candidate, error: null })
    return candidate
  }

  async function discard() {
    if (disposed) return null
    const options = resolveOptions()
    if (!options) return null
    clearTimer()
    queuedTask = null
    queuedReady = false
    deferredSchedule = null
    discoveryToken += 1
    generation += 1
    candidateIdentity = null
    lastWrittenIdentity = null
    sessionDraftIdentity = null
    const currentGeneration = generation
    try {
      await removeCurrentDraft(options)
      if (!disposed && currentGeneration === generation) setState({ ...IDLE_STATE })
      return options.key
    } catch (error) {
      if (!disposed && currentGeneration === generation) reportError(error)
      return null
    }
  }

  async function markRemoteSaved(content: T) {
    if (disposed) return
    const options = resolveOptions()
    if (!options) return
    const savedIdentity = identity(content, options)
    remoteBaselineIdentity = savedIdentity
    if (queuedTask?.identity === savedIdentity) {
      clearTimer()
      queuedTask = null
      queuedReady = false
    }
    const currentGeneration = generation
    try {
      const removed = await enqueueOperation(async () => {
        const raw = await options.storage.getItem(options.storageKey)
        if (raw === null) return false
        const parsed = parseEnvelope<T>(raw, options.key, Infinity)
        if (!parsed || parsed.identity !== savedIdentity) return false
        await options.storage.removeItem(options.storageKey)
        return true
      })
      if (disposed || currentGeneration !== generation || !removed) return
      lastWrittenIdentity = null
      if (sessionDraftIdentity === savedIdentity) sessionDraftIdentity = null
      if (candidateIdentity === savedIdentity) {
        candidateIdentity = null
        setState({ ...IDLE_STATE })
      }
    } catch (error) {
      if (!disposed && currentGeneration === generation) reportError(error)
    }
  }

  function reset(content: T) {
    if (disposed) return
    clearTimer()
    generation += 1
    discoveryToken += 1
    queuedTask = null
    queuedReady = false
    deferredSchedule = null
    candidateIdentity = null
    lastWrittenIdentity = null
    sessionDraftIdentity = null
    remoteBaselineIdentity = identity(content)
    setState({ ...IDLE_STATE })
  }

  async function flush() {
    if (disposed) return
    if (state.value.status === 'checking') {
      await operationQueue
      await Promise.resolve()
      if (disposed) return
    }
    clearTimer()
    if (queuedTask) queuedReady = true
    while (!disposed) {
      if (activeWrite) {
        await activeWrite
        continue
      }
      if (queuedTask && queuedReady) {
        await startReadyWrite()
        continue
      }
      break
    }
  }

  function dispose() {
    if (disposed) return
    clearTimer()
    generation += 1
    discoveryToken += 1
    queuedTask = null
    queuedReady = false
    disposed = true
  }

  return {
    state: readonly(state) as Readonly<Ref<LocalDraftState<T>>>,
    schedule,
    discover,
    restore,
    discard,
    markRemoteSaved,
    reset,
    flush,
    dispose,
  }
}
