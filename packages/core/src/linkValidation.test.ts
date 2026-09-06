import { describe, expect, it } from 'vitest'
import {
  hasSupportedLinkProtocol,
  isSupportedLinkUrl,
  looksLikeLinkAddress,
} from './linkValidation'

describe('linkValidation', () => {
  it('接受受支持的协议', () => {
    expect(hasSupportedLinkProtocol('https://example.com')).toBe(true)
    expect(hasSupportedLinkProtocol('HTTP://EXAMPLE.COM')).toBe(true)
    expect(hasSupportedLinkProtocol('mailto:me@example.com')).toBe(true)
    expect(hasSupportedLinkProtocol('tel:+10000000000')).toBe(true)
    expect(hasSupportedLinkProtocol('javascript:alert(1)')).toBe(false)
    expect(hasSupportedLinkProtocol('example.com')).toBe(false)
  })

  it('识别域名样式输入', () => {
    expect(looksLikeLinkAddress('example.com')).toBe(true)
    expect(looksLikeLinkAddress('sub.example.io')).toBe(true)
    expect(looksLikeLinkAddress('example')).toBe(false)
    expect(looksLikeLinkAddress('example.1a')).toBe(false)
  })

  it('协议或域名样式任一命中即合法', () => {
    expect(isSupportedLinkUrl('https://example.com')).toBe(true)
    expect(isSupportedLinkUrl('example.com')).toBe(true)
    expect(isSupportedLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isSupportedLinkUrl('')).toBe(false)
  })
})
