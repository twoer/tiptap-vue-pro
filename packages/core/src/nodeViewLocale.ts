import { resolveLocale, type LocaleTranslate } from './locale'

/**
 * NodeView 层的 UI 文案 locale 通道。
 *
 * NodeView(题注 placeholder 等)在 core 内手写 DOM,拿不到 useProEditor 的
 * options.locale;useProEditor 在 locale 解析后通过 setNodeViewLocale 注入
 * 翻译函数,NodeView 渲染时用 getNodeViewT() 取用。
 *
 * 注意:这是模块级状态——同页多编辑器实例用不同 locale 时,后解析的生效;
 * 典型应用单一 locale,该取舍可接受。序列化路径(renderHTML)不得使用本通道,
 * 文档 HTML 必须与查看者 locale 无关。
 */
let nodeViewT: LocaleTranslate = resolveLocale().t

export function setNodeViewLocale(t: LocaleTranslate) {
  nodeViewT = t
}

export function getNodeViewT(): LocaleTranslate {
  return nodeViewT
}
