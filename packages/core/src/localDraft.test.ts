import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalDraftController,
  type LocalDraftOptions,
  type LocalDraftStorage,
} from './localDraft'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const storage: LocalDraftStorage = {
    getItem: vi.fn(async key => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => { values.set(key, value) }),
    removeItem: vi.fn(async key => { values.delete(key) }),
  }
  return { storage, values }
}

function storageKey(key: string) {
  return `tiptap-vue-pro:draft:${encodeURIComponent(key)}`
}

function envelope(key: string, content: string | object, overrides: Record<string, unknown> = {}) {
  const identity = typeof content === 'string'
    ? `string:${content}`
    : `json:${JSON.stringify(content)}`
  return JSON.stringify({ version: 1, key, updatedAt: Date.now(), identity, content, ...overrides })
}

describe('createLocalDraftController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does nothing when drafts are disabled', async () => {
    const { storage } = memoryStorage()
    const controller = createLocalDraftController(() => false, '<p>initial</p>')

    controller.schedule('<p>changed</p>')
    await vi.runAllTimersAsync()

    expect(storage.setItem).not.toHaveBeenCalled()
    expect(controller.state.value.status).toBe('idle')
  })

  it('reports an empty document key without touching storage', async () => {
    const { storage } = memoryStorage()
    const controller = createLocalDraftController(
      () => ({ key: '  ', storage }),
      '<p>initial</p>',
    )

    controller.schedule('<p>changed</p>')
    await controller.discover('<p>initial</p>')

    expect(controller.state.value.status).toBe('error')
    expect(controller.state.value.error).toBeInstanceOf(Error)
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('debounces writes and stores only the latest full content', async () => {
    const { storage } = memoryStorage()
    const options = { key: 'article', delay: 100, storage }
    const controller = createLocalDraftController(() => options, '<p>initial</p>')

    controller.schedule('<p>first</p>')
    await vi.advanceTimersByTimeAsync(50)
    controller.schedule('<p>latest</p>')
    await vi.advanceTimersByTimeAsync(99)
    expect(storage.setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(storage.setItem).toHaveBeenCalledTimes(1)
    const [key, raw] = vi.mocked(storage.setItem).mock.calls[0]
    expect(key).toBe(storageKey('article'))
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      key: 'article',
      identity: 'string:<p>latest</p>',
      content: '<p>latest</p>',
    })
  })

  it('discovers a different draft without restoring it', async () => {
    const { storage } = memoryStorage({
      [storageKey('article')]: envelope('article', '<p>draft</p>'),
    })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage }),
      '<p>server</p>',
    )

    await controller.discover('<p>server</p>')

    expect(controller.state.value).toMatchObject({
      status: 'available',
      candidate: { key: 'article', content: '<p>draft</p>' },
    })
  })

  it('does not delete a historical draft during an initial baseline update', async () => {
    const key = storageKey('article')
    const { storage, values } = memoryStorage({
      [key]: envelope('article', '<p>draft</p>'),
    })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage }),
      '<p>server</p>',
    )

    controller.schedule('<p>server</p>')
    await controller.discover('<p>server</p>')

    expect(values.has(key)).toBe(true)
    expect(controller.state.value).toMatchObject({
      status: 'available',
      candidate: { content: '<p>draft</p>' },
    })
  })

  it('preserves a historical draft when an update races with discovery', async () => {
    const key = storageKey('article')
    const read = deferred<string | null>()
    const { storage, values } = memoryStorage({
      [key]: envelope('article', '<p>historical</p>'),
    })
    vi.mocked(storage.getItem).mockImplementationOnce(() => read.promise)
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 0, storage }),
      '<p>server</p>',
    )

    const discovering = controller.discover('<p>server</p>')
    controller.schedule('<p>normalized server</p>')
    read.resolve(values.get(key) ?? null)
    await discovering
    await vi.runAllTimersAsync()

    expect(storage.setItem).not.toHaveBeenCalled()
    expect(values.get(key)).toContain('<p>historical</p>')
    expect(controller.state.value).toMatchObject({
      status: 'available',
      candidate: { content: '<p>historical</p>' },
    })
  })

  it('writes an update deferred during discovery when no draft exists', async () => {
    const read = deferred<string | null>()
    const { storage } = memoryStorage()
    vi.mocked(storage.getItem).mockImplementationOnce(() => read.promise)
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 0, storage }),
      '<p>server</p>',
    )

    const discovering = controller.discover('<p>server</p>')
    controller.schedule('<p>edited while checking</p>')
    read.resolve(null)
    await discovering
    await vi.runAllTimersAsync()

    const raw = vi.mocked(storage.setItem).mock.calls[0]?.[1]
    expect(JSON.parse(raw).content).toBe('<p>edited while checking</p>')
  })

  it('flushes an update after an in-flight discovery finds no draft', async () => {
    const read = deferred<string | null>()
    const { storage } = memoryStorage()
    vi.mocked(storage.getItem).mockImplementationOnce(() => read.promise)
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 10_000, storage }),
      '<p>server</p>',
    )

    void controller.discover('<p>server</p>')
    controller.schedule('<p>leaving</p>')
    const flushing = controller.flush()
    read.resolve(null)
    await flushing

    const raw = vi.mocked(storage.setItem).mock.calls[0]?.[1]
    expect(JSON.parse(raw).content).toBe('<p>leaving</p>')
  })

  it('deletes a draft written in this session after reverting to the baseline', async () => {
    const key = storageKey('article')
    const { storage, values } = memoryStorage()
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 0, storage }),
      '<p>server</p>',
    )

    controller.schedule('<p>draft</p>')
    await vi.runAllTimersAsync()
    expect(values.has(key)).toBe(true)

    controller.schedule('<p>server</p>')
    await controller.flush()

    expect(values.has(key)).toBe(false)
  })

  it('removes a redundant draft matching current content', async () => {
    const raw = envelope('article', '<p>same</p>')
    const { storage, values } = memoryStorage({ [storageKey('article')]: raw })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage }),
      '<p>same</p>',
    )

    await controller.discover('<p>same</p>')

    expect(controller.state.value.status).toBe('idle')
    expect(values.has(storageKey('article'))).toBe(false)
  })

  it.each([
    ['malformed', '{bad json'],
    ['unsupported', envelope('article', '<p>x</p>', { version: 2 })],
    ['wrong key', envelope('other', '<p>x</p>')],
    ['expired', envelope('article', '<p>x</p>', { updatedAt: 1 })],
  ])('removes %s envelopes', async (_, raw) => {
    const { storage, values } = memoryStorage({ [storageKey('article')]: raw })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage, maxAge: 1000 }),
      '<p>server</p>',
    )

    await controller.discover('<p>server</p>')

    expect(controller.state.value.status).toBe('idle')
    expect(values.has(storageKey('article'))).toBe(false)
  })

  it('restores only after an explicit restore call', async () => {
    const { storage } = memoryStorage({
      [storageKey('article')]: envelope('article', '<p>draft</p>'),
    })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage }),
      '<p>server</p>',
    )
    await controller.discover('<p>server</p>')

    const candidate = controller.restore()

    expect(candidate).toMatchObject({ key: 'article', content: '<p>draft</p>' })
    expect(controller.state.value.status).toBe('restoring')
  })

  it('discards the candidate and stored envelope explicitly', async () => {
    const { storage, values } = memoryStorage({
      [storageKey('article')]: envelope('article', '<p>draft</p>'),
    })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage }),
      '<p>server</p>',
    )
    await controller.discover('<p>server</p>')

    await expect(controller.discard()).resolves.toBe('article')

    expect(values.has(storageKey('article'))).toBe(false)
    expect(controller.state.value).toMatchObject({ status: 'idle', candidate: null })
  })

  it('clears only a draft matching the remotely saved identity', async () => {
    const { storage, values } = memoryStorage({
      [storageKey('article')]: envelope('article', '<p>latest</p>'),
    })
    const controller = createLocalDraftController(
      () => ({ key: 'article', storage }),
      '<p>server</p>',
    )

    await controller.markRemoteSaved('<p>older</p>')
    expect(values.has(storageKey('article'))).toBe(true)
    await controller.markRemoteSaved('<p>latest</p>')
    expect(values.has(storageKey('article'))).toBe(false)
  })

  it('ignores stale discovery after a key change', async () => {
    const firstRead = deferred<string | null>()
    const { storage } = memoryStorage()
    vi.mocked(storage.getItem).mockImplementationOnce(() => firstRead.promise)
    let options: LocalDraftOptions<string> = { key: 'a', storage }
    const controller = createLocalDraftController<string>(() => options, '<p>server</p>')

    const discovering = controller.discover('<p>server</p>')
    options = { key: 'b', storage }
    controller.reset('<p>document b</p>')
    firstRead.resolve(envelope('a', '<p>stale a</p>'))
    await discovering

    expect(controller.state.value).toMatchObject({ status: 'idle', candidate: null })
  })

  it('converts storage failures into error state', async () => {
    const { storage } = memoryStorage()
    const failure = new Error('quota exceeded')
    vi.mocked(storage.setItem).mockRejectedValue(failure)
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 0, storage }),
      '<p>server</p>',
    )

    controller.schedule('<p>draft</p>')
    await vi.runAllTimersAsync()

    expect(controller.state.value).toMatchObject({ status: 'error', error: failure })
  })

  it('serializes writes and queues only the latest content', async () => {
    const firstWrite = deferred<void>()
    const { storage } = memoryStorage()
    let activeWrites = 0
    let maxActiveWrites = 0
    vi.mocked(storage.setItem)
      .mockImplementationOnce(async () => {
        activeWrites += 1
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites)
        await firstWrite.promise
        activeWrites -= 1
      })
      .mockImplementationOnce(async () => {
        activeWrites += 1
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites)
        activeWrites -= 1
      })
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 0, storage }),
      '<p>server</p>',
    )

    controller.schedule('<p>first</p>')
    await vi.advanceTimersByTimeAsync(0)
    controller.schedule('<p>second</p>')
    controller.schedule('<p>latest</p>')
    await vi.advanceTimersByTimeAsync(0)
    expect(storage.setItem).toHaveBeenCalledTimes(1)

    firstWrite.resolve()
    await firstWrite.promise
    await vi.runAllTimersAsync()
    await controller.flush()

    expect(storage.setItem).toHaveBeenCalledTimes(2)
    expect(JSON.parse(vi.mocked(storage.setItem).mock.calls[1][1]).content).toBe('<p>latest</p>')
    expect(maxActiveWrites).toBe(1)
  })

  it('flushes pending local content immediately', async () => {
    const { storage } = memoryStorage()
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 10_000, storage }),
      '<p>server</p>',
    )

    controller.schedule('<p>draft</p>')
    await controller.flush()

    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('dispose clears timers and prevents later state transitions', async () => {
    const write = deferred<void>()
    const { storage } = memoryStorage()
    vi.mocked(storage.setItem).mockImplementation(() => write.promise)
    const controller = createLocalDraftController(
      () => ({ key: 'article', delay: 0, storage }),
      '<p>server</p>',
    )

    controller.schedule('<p>draft</p>')
    await vi.advanceTimersByTimeAsync(0)
    controller.dispose()
    write.reject(new Error('late failure'))
    await expect(write.promise).rejects.toThrow('late failure')
    await Promise.resolve()

    expect(controller.state.value.status).toBe('idle')
  })
})
