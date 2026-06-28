# 图片功能对标飞书 — 设计文档

> 分支:`feature/image-feishu`(基于 `main`)· worktree:`.worktrees/image-feishu`
> 日期:2026-06-28

## 一、目标

对标飞书文档的图片交互体验,把当前 MVP 级图片功能(仅「上传/粘贴/拖拽插入原生 `<img>`」)提升到「可调整大小 + 可对齐 + 有题注 + 选中浮动工具条」的完整能力。

### MVP 范围(4 项,均已确认)

| 能力 | 现状 | 目标 |
| --- | --- | --- |
| 调整大小 | ❌ 原生 `<img>`,无 NodeView | 拖拽四角手柄缩放 + 尺寸预设(小/中/大/原始) |
| 对齐切换 | ❌ | 左/居中/右,`data-align` 属性存储 |
| 选中浮动工具条 | ❌(BubbleMenu 只管文字/表格) | 图片被 NodeSelection 选中时浮现工具条 |
| 图片题注 caption | ❌ | Image 节点加 `data-caption` 属性,图片下方可编辑输入框 |

**顺带修复/增强:**
- 粘贴/拖拽失败有 toast(当前空 catch 静默)
- 工具栏新增「插入网络图片 URL」入口

### 不在本次范围(YAGNI)

- 上传前裁剪(P1-8,后续单独做)
- 图片浮动/环绕文字(飞书有,本次不做)
- 批量上传进度条下沉到 core(playground 示例已有)

---

## 二、技术调研结论(Tiptap v3 能力边界)

调研确认(基于 `@tiptap/extension-image@3.27.1` 实际 d.ts 与官方文档):

1. **resize 是 Image 扩展原生选项**:v3 的 `Image.configure({ resize: { enabled, directions, minWidth, alwaysPreserveAspectRatio } })` 内置,`setImage({width,height})` 命令已支持。**调整大小零新依赖。**
2. **对齐不在原生范围内**:v3 的 ResizableNodeView 不带 alignment。需自定义 Image 子扩展给节点加 `data-align` 属性。
3. **没有官方 Figure 扩展**:caption 走「Image 加属性」轻量方案,不做 Figure 节点。
4. **Markdown 不带对齐/题注**:`![alt](src "title")` 无对应语法 → 导出时丢失(与现有「颜色/对齐丢失」同类限制,设计文档标注)。

**依赖:** 全部用 `@tiptap/*` 3.27.x 已有包,**不引入任何新 npm 依赖**。

---

## 三、架构约束(严守 AGENTS.md)

`core/` 必须保持 UI 无关。本次涉及 NodeView,关键决策:

- ✅ **core 的 Image 子扩展用 `addNodeView` 返回原生 DOM**(原生 `figcaption` + `<input>`),不引 `.vue`、不引任何 UI 库。
- ✅ 两个 adapter(element-plus / naive)的 ImageBubbleMenu 完全复用 core 的 NodeView,**adapter 只新增浮动工具条 UI 组件**。
- ✅ 「提示」走 `NotifyFn` 注入(Core 决定时机文案,adapter 注入组件)。
- ✅ 依赖方向单向:adapter → core。

---

## 四、Core 层改动(UI 无关)

### 4.1 自定义 Image 子扩展

**新文件 `packages/core/src/extensions/image.ts`**:扩展官方 `Image`。

```ts
import Image from '@tiptap/extension-image'

export const ImageExtended = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // 对齐:存 data-align,渲染时加属性(CSS 控制居中/左右)
      align: {
        default: 'center',
        parseHTML: el => el.getAttribute('data-align') || 'center',
        renderHTML: ({ align }) => (align && align !== 'center' ? { 'data-align': align } : {}),
      },
      // 题注:存 data-caption
      caption: {
        default: '',
        parseHTML: el => el.getAttribute('data-caption') || '',
        renderHTML: ({ caption }) => (caption ? { 'data-caption': caption } : {}),
      },
    }
  },
  // 用原生 DOM NodeView 渲染 figcaption 可编辑输入框(core 无 .vue)
  addNodeView() { /* 见 4.5 */ },
}).configure({
  inline: false,
  allowBase64: false,
  resize: {
    enabled: true,
    directions: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
    minWidth: 60,
    alwaysPreserveAspectRatio: true, // 锁比例,飞书行为
  },
})
```

`extensions.ts` 中 `import Image from '@tiptap/extension-image'` 改为引用 `ImageExtended`。

### 4.2 命令扩展(`ProEditorCommands`)

新增 5 个命令(每个对应工具条一个/一组按钮):

| 命令 | 签名 | 实现 |
| --- | --- | --- |
| `setImageAlign` | `(align: 'left'\|'center'\|'right') => void` | `updateAttributes('image', { align })` |
| `setImageSize` | `(preset: 'small'\|'medium'\|'large'\|'original') => void` | 按容器宽度 25%/50%/75%/原始像素,`updateAttributes('image', { width })` |
| `setImageCaption` | `(text: string) => void` | `updateAttributes('image', { caption: text })` |
| `replaceImage` | `() => void` | 触发 adapter 文件选择,替换 src(保留尺寸/对齐) |
| `removeImage` | `() => void` | deleteSelection 删当前 NodeSelection 节点 |

`setImageSize` 需 `getActiveImageAttrs()` helper 读当前节点原始尺寸算比例。

### 4.3 粘贴/拖拽失败提示(修复)

`handleImageFiles(files, upload, editor, onError?)` 增加可选 `onError?: (file: File, err: unknown) => void`。adapter 注入 `notify` 实现,粘贴/拖拽失败也有 toast。**保持向后兼容**(第 4 参可选)。

### 4.4 Markdown 导入导出

- 导出:`![alt](src "title")`,对齐/题注**丢失**(格式限制,文档标注)。
- 导入:`@tiptap/markdown` 默认行为,带 `data-align`/`data-caption` 的 HTML 片段粘贴时保留。

### 4.5 caption NodeView(原生 DOM)

core 的 Image 子扩展 `addNodeView` 返回一个 NodeView:
- 渲染 `<img>` + 下方一个 `<input class="tvp-img-caption" placeholder="添加题注">`(contenteditable=false,纯 input)。
- `data-caption` 有值时预填,input 的 `input` 事件 `updateAttributes({ caption })`。
- 飞书交互:题注输入框默认显示(placeholder「添加题注」),失焦空值时隐藏。

---

## 五、Adapter 层改动(两个 adapter 对等)

### 5.1 新增 `ImageBubbleMenu.vue`(EP / Naive 各一个)

仿 `TableBubbleMenu.vue`(feature/table-operations 分支刚做过的模式),用 `@tiptap/extension-bubble-menu` 的 `BubbleMenu` 插件,`shouldShow` 判断 `NodeSelection` 且节点 `type.name === 'image'`。

工具条内容(从左到右):
```
[小][中][大][原始] | [左][中][右] | [题注] [替换] [删除]
```
- 尺寸预设:`ctx.commands.setImageSize(preset)`
- 对齐:`ctx.commands.setImageAlign(align)`,当前激活高亮
- 题注:聚焦到当前图片的 caption input(core NodeView 暴露方式:TBD,可能用 data-attribute 标记后 querySelector)
- 替换:`ctx.commands.replaceImage()`
- 删除:`ctx.commands.removeImage()`

主组件 `ProEditorElementPlus.vue` / `ProEditorNaive.vue` 挂载 ImageBubbleMenu(与现有 BubbleMenu/TableBubbleMenu 并列)。

### 5.2 工具栏「插入网络图片 URL」

`Toolbar.vue` 图片按钮旁加入口(EP `ElMessageBox.prompt` / Naive 对等),输入 URL → `ctx.commands.setImage({ src })`。

### 5.3 选中态样式

主组件全局 CSS 加:
```css
.tvp-content .ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid var(--tvp-primary, #409eff);
  outline-offset: 2px;
}
```

### 5.4 题注样式

```css
.tvp-content .tvp-img-caption {
  display: block; width: 100%; margin-top: 4px;
  border: none; background: transparent;
  text-align: center; font-size: 13px; color: #999;
}
.tvp-content .tvp-img-caption:focus { outline: none; }
```

---

## 六、实现顺序(垂直迭代,每步可提交)

按 brainstorming 确认的「按能力垂直迭代」推进:

1. **调整大小**(core Image 子扩展 + resize 配置 + 尺寸预设命令 + 单测)
2. **对齐**(align 属性 + setImageAlign 命令 + 单测)
3. **caption**(caption 属性 + 原生 DOM NodeView + setImageCaption 命令 + 单测)
4. **浮动工具条**(两个 adapter 的 ImageBubbleMenu + 工具栏网络图片入口 + 选中态/题注样式)
5. **粘贴失败提示**(handleImageFiles onError + 两个 adapter 注入)
6. **playground 演示**(初始内容预置一张图,演示全流程)

每个能力完成后:跑 `pnpm typecheck && pnpm test`,提交一次(`feat:` 前缀,中文 message)。

---

## 七、测试

| 测试 | 覆盖 |
| --- | --- |
| `extensions/image.test.ts`(新) | ImageExtended schema(parseHTML/renderHTML 对 align/caption 的处理)、resize 配置生效 |
| `useProEditor.test.ts`(扩展) | setImageAlign/setImageSize/setImageCaption/replaceImage/removeImage 产出真实 HTML;getActiveImageAttrs |
| `handleImageUpload.test.ts`(扩展) | onError 回调:单张失败触发、不中断其余 |

adapter 层(ImageBubbleMenu 等 UI)靠 playground 手测,与现状一致(AGENTS.md P0-2 未覆盖 adapter)。

---

## 八、验收清单

- [ ] core 无 UI 依赖(grep 确认无 element-plus / naive-ui / lucide import)
- [ ] 两个 adapter 能力对等
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 全绿(core 必须全绿)
- [ ] playground 演示:调整大小、对齐、题注、工具条全流程可用
- [ ] `ProEditorCommands` 契约更新同步到两个 adapter 的 index.ts re-export

---

## 参考

- [Tiptap v3 Image extension](https://tiptap.dev/docs/editor/extensions/nodes/image) — resize 选项
- [Tiptap v3 Resizable Node Views](https://tiptap.dev/docs/editor/api/resizable-nodeviews)
- [Tiptap Image Align Button](https://tiptap.dev/docs/ui-components/components/image-align-button)
- `docs/feature-gap-analysis.md` P1-5(图片尺寸/对齐)、P1-8(裁剪,本次不做)
