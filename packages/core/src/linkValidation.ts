/**
 * 链接输入校验:三个 UI 适配器共用的快捷链接/链接编辑合法性判断。
 *
 * 规则:带受支持的协议(http/https/mailto/tel),或长得像域名
 * (含 `.` + 至少两位字母后缀)即视为可接受的链接地址。
 */
const LINK_PROTOCOL_PATTERN = /^(https?:|mailto:|tel:)/i
const LINK_TLD_LIKE_PATTERN = /\.[a-z]{2,}/i

export function hasSupportedLinkProtocol(href: string): boolean {
  return LINK_PROTOCOL_PATTERN.test(href)
}

export function looksLikeLinkAddress(href: string): boolean {
  return LINK_TLD_LIKE_PATTERN.test(href)
}

export function isSupportedLinkUrl(href: string): boolean {
  return hasSupportedLinkProtocol(href) || looksLikeLinkAddress(href)
}
