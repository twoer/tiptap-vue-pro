export type ProEditorDebugLevel = 'debug' | 'info' | 'warn' | 'error'

export type ProEditorDebugChannel =
  | 'lifecycle'
  | 'content'
  | 'selection'
  | 'transaction'
  | 'command'
  | 'upload'
  | 'markdown'
  | 'adapter'
  | 'table'

export type ProEditorDebugSource =
  | 'core'
  | 'element-plus'
  | 'naive'
  | 'ant-design-vue'

export interface ProEditorDebugOptions {
  enabled?: boolean
  level?: ProEditorDebugLevel
  channels?: ProEditorDebugChannel[]
  includeContent?: boolean
}

export interface ProEditorDebugEntry {
  time: number
  level: ProEditorDebugLevel
  channel: ProEditorDebugChannel
  event: string
  source: ProEditorDebugSource
  payload?: Record<string, unknown>
  error?: unknown
}

export type ProEditorDebugLogger = (entry: ProEditorDebugEntry) => void

export type ProEditorDebugLogFn = (
  channel: ProEditorDebugChannel,
  event: string,
  payload?: Record<string, unknown>,
  level?: ProEditorDebugLevel,
  error?: unknown,
) => void

const TABLE_GRIP_DEBUG_STORAGE_KEY = 'tvp:table-grip-debug'

const DEBUG_LEVEL_ORDER: Record<ProEditorDebugLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const SENSITIVE_PAYLOAD_KEYS = new Set([
  'authorization',
  'content',
  'doc',
  'html',
  'json',
  'password',
  'secret',
  'text',
  'token',
])

// 共享的静态解析结果:debug 解析在热路径上(每次 transaction/按键都会走一遍),
// 静态形态返回冻结常量,避免每按键分配新对象。调用方只读不写(isDebugEnabledFor)。
const FROZEN = <T extends object>(value: T) => Object.freeze(value) as unknown as T
const DISABLED_DEBUG_OPTIONS = FROZEN<Required<ProEditorDebugOptions>>({
  enabled: false,
  level: 'debug',
  channels: [],
  includeContent: false,
})
const BOOLEAN_ENABLED_DEBUG_OPTIONS = FROZEN<Required<ProEditorDebugOptions>>({
  enabled: true,
  level: 'debug',
  channels: [],
  includeContent: false,
})
const TABLE_GRIP_DEBUG_OPTIONS = FROZEN<Required<ProEditorDebugOptions>>({
  enabled: true,
  level: 'debug',
  channels: ['table'],
  includeContent: false,
})

// localStorage 表格抓手调试开关带 TTL 缓存:保持"运行时可切"的调试体验,
// 但避免每次日志调用都同步读 storage。显式调用 refreshDebugOptionsCache 立即失效。
const TABLE_GRIP_DEBUG_CACHE_TTL_MS = 1_000
let tableGripStorageCache: { enabled: boolean; at: number } | null = null

/** 使 localStorage 调试开关缓存立即失效(测试/调试面板切换后调用)。 */
export function refreshDebugOptionsCache() {
  tableGripStorageCache = null
}

function isTableGripStorageDebugEnabled() {
  const now = Date.now()
  if (tableGripStorageCache && now - tableGripStorageCache.at < TABLE_GRIP_DEBUG_CACHE_TTL_MS) {
    return tableGripStorageCache.enabled
  }
  let enabled = false
  try {
    enabled = globalThis.localStorage?.getItem(TABLE_GRIP_DEBUG_STORAGE_KEY) === '1'
  } catch {
    enabled = false
  }
  tableGripStorageCache = { enabled, at: now }
  return enabled
}

export function resolveDebugOptions(
  debug?: boolean | ProEditorDebugOptions,
): Required<ProEditorDebugOptions> {
  if (typeof debug === 'boolean') {
    return debug ? BOOLEAN_ENABLED_DEBUG_OPTIONS : DISABLED_DEBUG_OPTIONS
  }

  if (debug) {
    return {
      enabled: debug.enabled ?? true,
      level: debug.level ?? 'debug',
      channels: debug.channels ?? [],
      includeContent: debug.includeContent ?? false,
    }
  }

  if (isTableGripStorageDebugEnabled()) {
    return TABLE_GRIP_DEBUG_OPTIONS
  }

  return DISABLED_DEBUG_OPTIONS
}

export function isDebugEnabledFor(
  options: Required<ProEditorDebugOptions>,
  channel: ProEditorDebugChannel,
  level: ProEditorDebugLevel,
) {
  if (!options.enabled) return false
  if (DEBUG_LEVEL_ORDER[level] < DEBUG_LEVEL_ORDER[options.level]) return false
  return options.channels.length === 0 || options.channels.includes(channel)
}

export function sanitizeDebugPayload(
  payload?: Record<string, unknown>,
  includeContent = false,
): Record<string, unknown> | undefined {
  if (!payload) return undefined
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.toLowerCase()
    if (!includeContent && SENSITIVE_PAYLOAD_KEYS.has(normalizedKey)) continue

    if (normalizedKey === 'url' || normalizedKey.endsWith('url')) {
      const host = getUrlHost(value)
      if (host) {
        sanitized[`${key}Host`] = host
        continue
      }
    }

    sanitized[key] = value
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function createDebugLogger(options: {
  debug?: boolean | ProEditorDebugOptions
  debugLogger?: ProEditorDebugLogger
  source: ProEditorDebugSource
}): ProEditorDebugLogFn {
  return (
    channel,
    event,
    payload,
    level = 'debug',
    error,
  ) => {
    const resolved = resolveDebugOptions(options.debug)
    if (!isDebugEnabledFor(resolved, channel, level)) return

    const entry: ProEditorDebugEntry = {
      time: Date.now(),
      level,
      channel,
      event,
      source: options.source,
      payload: sanitizeDebugPayload(payload, resolved.includeContent),
      error,
    }

    if (entry.payload == null) delete entry.payload
    if (entry.error == null) delete entry.error

    try {
      if (options.debugLogger) {
        options.debugLogger(entry)
      } else {
        globalThis.console?.debug?.('[tiptap-vue-pro]', entry)
      }
    } catch {
      // Diagnostics must never affect editor behavior.
    }
  }
}

function getUrlHost(value: unknown) {
  if (typeof value !== 'string') return ''
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}
