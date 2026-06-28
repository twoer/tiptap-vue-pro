/**
 * 轻量 HTML 格式化(美化)函数。
 *
 * 用途:playground 的「输出」区把 Tiptap 吐出的紧凑 HTML
 * (<h2>..</h2><p>..</p> 全挤一行)格式化成带缩进、可读的形式。
 *
 * 实现思路:用浏览器原生 DOMParser 把字符串解析成 DOM 树,再递归序列化。
 * 比手写正则切分可靠——浏览器帮我们处理了标签嵌套、实体转义、void 元素等。
 *
 * 规则:
 * 1. 块级元素(div/p/h1-6/ul/ol/li/table/tr/td/th/blockquote/section/article
 *    /header/footer/nav/pre/hr 等):开标签、内容、闭标签各自独占一行,内容缩进 +1。
 * 2. 内联元素(span/strong/em/a/u/s/mark/code/b/i/sub/sup 等):不换行,跟文本流一起。
 * 3. void 元素(img/br/hr/input/meta/link 等):独占一行,无闭标签。
 * 4. <pre> 内部原样保留:里面的换行/空白是代码内容的一部分,不能动,只输出原始 innerHTML。
 * 5. 文本节点:trim 两侧空白,非空才输出(避免纯空白文本造成大量空行)。
 *
 * 局限:这是展示用的「美化」,不是精确还原。对极端嵌套或冷门标签可能不完美,
 * 但覆盖 Tiptap 富文本的全部产出(标题/段落/列表/表格/引用/代码块/图片/任务列表)足够。
 */

// 块级元素集合:这些标签会触发换行 + 缩进。
// 判断依据 HTML 标准 + Tiptap 实际产出,刻意把 pre 也算块级(内部特殊处理)。
const BLOCK_TAGS = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'section', 'article',
  'header', 'footer', 'nav', 'aside', 'main', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'hr',
])

// void(自闭合)元素:没有闭标签,也不含子节点。
const VOID_TAGS = new Set([
  'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base',
  'col', 'embed', 'source', 'track', 'wbr',
])

/**
 * 把一个元素序列化成「开标签 + 属性」字符串。
 * 例如 <span style="color: red"> → '<span style="color: red">'
 * 属性顺序沿用 DOM 解析后的顺序(与源串一致),不做重排。
 */
function serializeOpenTag(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}="${a.value}"`)
    .join(' ')
  return attrs ? `<${tag} ${attrs}>` : `<${tag}>`
}

/**
 * 递归序列化节点,结果追加到 out 数组。
 *
 * @param node   当前节点
 * @param depth  当前缩进深度(块级元素每进一层 +1)
 * @param out    累积输出的行数组
 */
function serializeNode(node: Node, depth: number, out: string[]): void {
  // 文本节点:trim 后非空才输出,用当前缩进。
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim()
    if (text) out.push(`${'  '.repeat(depth)}${text}`)
    return
  }

  // 注释/文档类型等非元素节点:跳过(展示场景不需要)。
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const indent = '  '.repeat(depth)

  // void 元素:自闭合,独占一行。
  if (VOID_TAGS.has(tag)) {
    out.push(`${indent}${serializeOpenTag(el)}`)
    return
  }

  // pre 元素:内部空白是代码内容,原样输出 innerHTML,不递归、不缩进内容。
  if (tag === 'pre') {
    out.push(`${indent}${serializeOpenTag(el)}`)
    const inner = el.innerHTML.trim()
    if (inner) {
      // pre 内容按现有换行拆分,每行加一层缩进,保持代码块缩进结构
      inner.split('\n').forEach((line) => {
        out.push(`${indent}  ${line}`)
      })
    }
    out.push(`${indent}</${tag}>`)
    return
  }

  const isBlock = BLOCK_TAGS.has(tag)
  const childNodes = Array.from(el.childNodes)

  if (isBlock) {
    // 块级:开标签独占一行,子节点缩进 +1,闭标签独占一行。
    out.push(`${indent}${serializeOpenTag(el)}`)
    childNodes.forEach((c) => serializeNode(c, depth + 1, out))
    // 空块级元素(如 <ul></ul>)不输出多余空行,直接紧跟闭标签
    out.push(`${indent}</${tag}>`)
  } else {
    // 内联:把开标签 + 所有子节点(含文本)+ 闭标签拼成一行。
    // 内联元素内容通常很短(一段带格式的文字),挤一行可读性最好。
    const inner: string[] = []
    childNodes.forEach((c) => serializeInline(c, depth, inner))
    const innerStr = inner.filter((s) => s.trim()).join('')
    out.push(`${indent}${serializeOpenTag(el)}${innerStr}</${tag}>`)
  }
}

/**
 * 内联序列化:不产生独立行,而是把标签和文本拼接到传入的 parts 数组。
 * 供内联元素把自己的子内容「平铺」成一行的场景使用。
 */
function serializeInline(node: Node, _depth: number, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim()
    if (text) parts.push(text)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as Element
  const tag = el.tagName.toLowerCase()

  if (VOID_TAGS.has(tag)) {
    // 内联里的 void(如 <a> 里插 <br>):拼进当前行
    parts.push(serializeOpenTag(el))
    return
  }

  parts.push(serializeOpenTag(el))
  Array.from(el.childNodes).forEach((c) => serializeInline(c, _depth, parts))
  parts.push(`</${tag}>`)
}

/**
 * 格式化一段 HTML 字符串。
 *
 * @param html 原始 HTML(通常来自 editor.getHTML(),紧凑无换行)
 * @returns     带缩进、换行的美化 HTML;解析失败时原样返回(降级,不崩)
 */
export function formatHTML(html: string): string {
  if (!html) return ''
  try {
    // 用 DOMParser 解析成 body 子树,取 body 的子节点逐个序列化。
    // 用 body 而非整个 document,避免把 <html><head><body> 也输出出来。
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const out: string[] = []
    Array.from(doc.body.childNodes).forEach((n) => serializeNode(n, 0, out))
    return out.join('\n')
  } catch {
    // 解析异常时降级返回原文,保证输出区不空白
    return html
  }
}
