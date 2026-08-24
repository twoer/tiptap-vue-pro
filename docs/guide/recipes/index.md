# 业务 Recipes

Recipes 是面向真实业务接入的示例页。它们不是 API 清单,而是回答一个更直接的问题:「我现在要把编辑器放进后台业务里,应该怎么写?」

如果你还没安装包,先看 [快速开始](/guide/quick-start)。如果你想完整浏览所有 props,看 [Props](/api/props)。

## 推荐阅读顺序

1. [后台富文本表单](/guide/recipes/business-editor-form)
   文章、公告、商品详情、帮助中心等最常见的后台编辑场景。

2. [自动保存 + 本地草稿](/guide/recipes/autosave-drafts)
   适合长文档、知识库和不允许丢稿的业务。

3. [图片、视频和附件上传](/guide/recipes/uploads)
   从本地 mock 上传过渡到生产接口、OSS、COS、S3 或 CDN。

4. [只读预览和详情页](/guide/recipes/readonly-preview)
   同一份内容在编辑态、预览态和详情页之间复用。

## Playground 对应场景

在线体验页已经内置对应场景:

- [基础编辑器](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=basic)
- [后台富文本表单](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=business-form)
- [自动保存 + 本地草稿](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=autosave-drafts)
- [图片、视频和附件上传](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=uploads)
- [只读预览](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=readonly-preview)
- [Markdown 导入导出](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=markdown)

你可以先在 Playground 切换 Element Plus、Naive UI、Ant Design Vue,确认交互符合预期后再复制 recipe 代码进项目。
