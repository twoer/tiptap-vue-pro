import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDebugLogger,
  resolveDebugOptions,
  sanitizeDebugPayload,
} from './debug'
import type { ProEditorDebugEntry } from './debug'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('debug diagnostics', () => {
  it('debug omitted emits nothing', () => {
    const logger = vi.fn()
    const debugLog = createDebugLogger({
      source: 'core',
      debugLogger: logger,
    })

    debugLog('lifecycle', 'init')

    expect(logger).not.toHaveBeenCalled()
  })

  it('debug=true emits structured entries to custom logger', () => {
    const logger = vi.fn()
    const debugLog = createDebugLogger({
      source: 'core',
      debug: true,
      debugLogger: logger,
    })

    debugLog('lifecycle', 'init', { editable: true })

    expect(logger).toHaveBeenCalledTimes(1)
    expect(logger.mock.calls[0][0]).toMatchObject<Partial<ProEditorDebugEntry>>({
      level: 'debug',
      channel: 'lifecycle',
      event: 'init',
      source: 'core',
      payload: { editable: true },
    })
    expect(typeof logger.mock.calls[0][0].time).toBe('number')
  })

  it('filters by channel', () => {
    const logger = vi.fn()
    const debugLog = createDebugLogger({
      source: 'core',
      debug: { channels: ['table'] },
      debugLogger: logger,
    })

    debugLog('content', 'update')
    debugLog('table', 'select-line')

    expect(logger).toHaveBeenCalledTimes(1)
    expect(logger.mock.calls[0][0]).toMatchObject({
      channel: 'table',
      event: 'select-line',
    })
  })

  it('filters by level', () => {
    const logger = vi.fn()
    const debugLog = createDebugLogger({
      source: 'core',
      debug: { level: 'warn' },
      debugLogger: logger,
    })

    debugLog('content', 'update', undefined, 'debug')
    debugLog('upload', 'image:error', undefined, 'error')

    expect(logger).toHaveBeenCalledTimes(1)
    expect(logger.mock.calls[0][0]).toMatchObject({
      level: 'error',
      event: 'image:error',
    })
  })

  it('falls back to console.debug when no custom logger is provided', () => {
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const debugLog = createDebugLogger({
      source: 'core',
      debug: true,
    })

    debugLog('lifecycle', 'init')

    expect(consoleDebug).toHaveBeenCalledTimes(1)
    expect(consoleDebug.mock.calls[0][0]).toBe('[tiptap-vue-pro]')
    expect(consoleDebug.mock.calls[0][1]).toMatchObject({
      channel: 'lifecycle',
      event: 'init',
    })
  })

  it('swallows logger errors', () => {
    const logger = vi.fn(() => {
      throw new Error('logger failed')
    })
    const debugLog = createDebugLogger({
      source: 'core',
      debug: true,
      debugLogger: logger,
    })

    expect(() => debugLog('lifecycle', 'init')).not.toThrow()
  })

  it('localStorage table-grip fallback enables only table events', () => {
    localStorage.setItem('tvp:table-grip-debug', '1')
    const resolved = resolveDebugOptions(undefined)

    expect(resolved).toMatchObject({
      enabled: true,
      channels: ['table'],
      level: 'debug',
      includeContent: false,
    })
  })

  it('public debug option wins over localStorage fallback', () => {
    localStorage.setItem('tvp:table-grip-debug', '1')
    const resolved = resolveDebugOptions({ channels: ['upload'] })

    expect(resolved).toMatchObject({
      enabled: true,
      channels: ['upload'],
    })
  })

  it('sanitizes content-like payload fields by default', () => {
    const payload = sanitizeDebugPayload({
      html: '<p>secret</p>',
      json: { type: 'doc' },
      text: 'secret',
      token: 'abc',
      url: 'https://example.com/file.png?token=abc',
      contentLength: 12,
    })

    expect(payload).toEqual({
      urlHost: 'example.com',
      contentLength: 12,
    })
  })

  it('keeps content-like payload fields when includeContent=true', () => {
    const payload = sanitizeDebugPayload({
      html: '<p>visible</p>',
      text: 'visible',
    }, true)

    expect(payload).toEqual({
      html: '<p>visible</p>',
      text: 'visible',
    })
  })
})
