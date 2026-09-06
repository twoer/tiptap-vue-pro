/**
 * 浮层菜单视口定位:三个 UI 适配器共用的视口夹紧计算。
 *
 * 水平方向把菜单夹在视口内(左右各留 margin),避免 SlashCommandMenu
 * 等浮层在选区靠近屏幕边缘时溢出。SSR 下退回固定宽度视口。
 */
export function getViewportWidth(fallback: number): number {
  return typeof window === 'undefined' ? fallback : window.innerWidth
}

export function clampFloatingMenuLeft(left: number, width: number, margin = 8): number {
  const viewportWidth = getViewportWidth(width)
  return Math.max(margin, Math.min(left, viewportWidth - width - margin))
}
