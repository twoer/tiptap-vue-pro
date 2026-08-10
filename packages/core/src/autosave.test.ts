import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaveController, type AutosaveOptions } from './autosave'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function setup(initial: string, overrides: Partial<AutosaveOptions<string>> = {}) {
  const onSave = vi.fn<
    Parameters<AutosaveOptions<string>['onSave']>,
    ReturnType<AutosaveOptions<string>['onSave']>
  >(async () => {})
  let options: false | AutosaveOptions<string> = {
    delay: 1000,
    onSave,
    ...overrides,
  }
  const controller = createAutosaveController(() => options, initial)

  return {
    controller,
    onSave,
    setOptions(next: false | AutosaveOptions<string>) {
      options = next
    },
  }
}

describe('createAutosaveController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays idle and never schedules when disabled', async () => {
    const onSave = vi.fn()
    const controller = createAutosaveController<string>(
      () => ({ enabled: false, onSave }),
      'initial',
    )

    controller.schedule('changed')
    await vi.runAllTimersAsync()

    expect(onSave).not.toHaveBeenCalled()
    expect(controller.state.value).toEqual({
      status: 'idle',
      lastSavedAt: null,
      error: null,
      hasUnsavedChanges: false,
    })
  })

  it('uses the initial content as the saved baseline', async () => {
    const { controller, onSave } = setup('initial')

    controller.schedule('initial')
    await vi.runAllTimersAsync()

    expect(onSave).not.toHaveBeenCalled()
    expect(controller.state.value.status).toBe('idle')
  })

  it('marks changed content dirty immediately', () => {
    const { controller } = setup('initial')

    controller.schedule('changed')

    expect(controller.state.value.status).toBe('dirty')
    expect(controller.state.value.hasUnsavedChanges).toBe(true)
  })

  it('debounces rapid changes and saves only the latest content', async () => {
    const { controller, onSave } = setup('initial')

    controller.schedule('first')
    await vi.advanceTimersByTimeAsync(500)
    controller.schedule('second')
    await vi.advanceTimersByTimeAsync(999)
    expect(onSave).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('second', {
      key: undefined,
      reason: 'change',
      revision: 2,
    })
  })

  it('sets saved state and timestamp after success', async () => {
    const { controller } = setup('initial')
    controller.schedule('changed')

    await vi.runAllTimersAsync()

    expect(controller.state.value).toEqual({
      status: 'saved',
      lastSavedAt: Date.now(),
      error: null,
      hasUnsavedChanges: false,
    })
    expect(controller.getLastSavedContent()).toBe('changed')
  })

  it('retains failed content and retries it without a new edit', async () => {
    const failure = new Error('save failed')
    const onSave = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined)
    const controller = createAutosaveController<string>(
      () => ({ delay: 1000, onSave }),
      'initial',
    )
    controller.schedule('changed')

    await vi.runAllTimersAsync()

    expect(controller.state.value).toEqual({
      status: 'error',
      lastSavedAt: null,
      error: failure,
      hasUnsavedChanges: true,
    })

    await controller.retry()

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave.mock.calls[1]?.[0]).toBe('changed')
    expect(onSave.mock.calls[1]?.[1]).toMatchObject({ reason: 'retry' })
    expect(controller.state.value.status).toBe('saved')
  })

  it('flushes pending content immediately with the requested reason', async () => {
    const { controller, onSave } = setup('initial')
    controller.schedule('changed')

    await controller.flush('manual')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]?.[1]).toMatchObject({ reason: 'manual' })
    expect(controller.state.value.status).toBe('saved')
  })

  it('does not save unchanged content twice', async () => {
    const { controller, onSave } = setup('initial')
    controller.schedule('changed')
    await vi.runAllTimersAsync()

    controller.schedule('changed')
    await vi.runAllTimersAsync()

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('never overlaps save calls and queues the latest revision', async () => {
    const first = deferred()
    const onSave = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(undefined)
    const controller = createAutosaveController<string>(
      () => ({ delay: 1000, onSave }),
      'initial',
    )

    controller.schedule('first')
    await vi.advanceTimersByTimeAsync(1000)
    expect(onSave).toHaveBeenCalledTimes(1)

    controller.schedule('second')
    controller.schedule('latest')
    await vi.advanceTimersByTimeAsync(1000)
    expect(onSave).toHaveBeenCalledTimes(1)

    first.resolve()
    await first.promise
    await vi.runAllTimersAsync()

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave.mock.calls[1]?.[0]).toBe('latest')
  })

  it('does not report saved when an older revision finishes with newer content queued', async () => {
    const first = deferred()
    const onSave = vi.fn().mockImplementation(() => first.promise)
    const controller = createAutosaveController<string>(
      () => ({ delay: 1000, onSave }),
      'initial',
    )

    controller.schedule('first')
    await vi.advanceTimersByTimeAsync(1000)
    controller.schedule('second')
    await vi.advanceTimersByTimeAsync(500)

    first.resolve()
    await first.promise
    await vi.advanceTimersByTimeAsync(0)

    expect(controller.state.value.status).toBe('dirty')
    expect(controller.state.value.hasUnsavedChanges).toBe(true)
  })

  it('continues with a newer ready revision after an older revision fails', async () => {
    const first = deferred()
    const failure = new Error('old failed')
    const onSave = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(undefined)
    const controller = createAutosaveController<string>(
      () => ({ delay: 1000, onSave }),
      'initial',
    )

    controller.schedule('first')
    await vi.advanceTimersByTimeAsync(1000)
    controller.schedule('latest')
    await vi.advanceTimersByTimeAsync(1000)

    first.reject(failure)
    await first.promise.catch(() => {})
    await vi.runAllTimersAsync()

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave.mock.calls[1]?.[0]).toBe('latest')
    expect(controller.state.value.status).toBe('saved')
  })

  it('reset cancels queued work', async () => {
    const { controller, onSave } = setup('initial')
    controller.schedule('old document')

    controller.reset('new document')
    await vi.runAllTimersAsync()

    expect(onSave).not.toHaveBeenCalled()
    expect(controller.state.value.status).toBe('idle')
    expect(controller.state.value.hasUnsavedChanges).toBe(false)
  })

  it('reset ignores stale in-flight completion', async () => {
    const pending = deferred()
    const onSave = vi.fn(() => pending.promise)
    const controller = createAutosaveController<string>(
      () => ({ delay: 0, onSave }),
      'initial',
    )
    controller.schedule('old document')
    await vi.runAllTimersAsync()

    controller.reset('new document')
    pending.resolve()
    await pending.promise
    await Promise.resolve()

    expect(controller.state.value).toEqual({
      status: 'idle',
      lastSavedAt: null,
      error: null,
      hasUnsavedChanges: false,
    })
  })

  it('snapshots the original key and callback for each save task', async () => {
    const saveFirst = vi.fn(async () => {})
    const saveSecond = vi.fn(async () => {})
    let options: AutosaveOptions<string> = {
      key: 'article-a',
      delay: 1000,
      onSave: saveFirst,
    }
    const controller = createAutosaveController<string>(() => options, 'initial')

    controller.schedule('article a content')
    options = {
      key: 'article-b',
      delay: 1000,
      onSave: saveSecond,
    }
    await vi.runAllTimersAsync()

    expect(saveFirst).toHaveBeenCalledWith('article a content', {
      key: 'article-a',
      reason: 'change',
      revision: 1,
    })
    expect(saveSecond).not.toHaveBeenCalled()
  })

  it('dispose clears timers and prevents later state transitions', async () => {
    const { controller, onSave } = setup('initial')
    controller.schedule('changed')
    const stateBeforeDispose = controller.state.value

    controller.dispose()
    await vi.runAllTimersAsync()

    expect(onSave).not.toHaveBeenCalled()
    expect(controller.state.value).toBe(stateBeforeDispose)
  })
})
