# 后台富文本表单

这个 recipe 适合文章、公告、商品详情、帮助中心等后台表单。核心思路是:标题、摘要等普通字段仍由业务表单管理,富文本正文由 `ProEditorElementPlus` 通过 `v-model` 管理,提交时统一组装 payload。

[在线体验这个场景](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=business-form)

## 最小接入

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const title = ref('')
const summary = ref('')
const content = ref('<h2>产品更新公告</h2><p>这里填写正文。</p>')
const saving = ref(false)

const titleError = computed(() => title.value.trim().length === 0)
const contentError = computed(() => content.value.replace(/<[^>]+>/g, '').trim().length === 0)
const canSubmit = computed(() => !titleError.value && !contentError.value && !saving.value)

async function submitArticle() {
  if (!canSubmit.value) {
    ElMessage.warning('请填写标题和正文')
    return
  }

  saving.value = true
  try {
    await fetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: title.value,
        summary: summary.value,
        content: content.value,
      }),
    })
    ElMessage.success('已保存')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="标题" :error="titleError ? '请输入标题' : ''">
      <el-input v-model="title" placeholder="请输入标题" />
    </el-form-item>

    <el-form-item label="摘要">
      <el-input
        v-model="summary"
        type="textarea"
        :rows="3"
        placeholder="可选,用于列表页或 SEO 描述"
      />
    </el-form-item>

    <el-form-item label="正文" :error="contentError ? '请输入正文' : ''">
      <ProEditorElementPlus
        v-model="content"
        toolbar-layout="compact"
        placeholder="请输入正文..."
      />
    </el-form-item>

    <el-button type="primary" :loading="saving" @click="submitArticle">
      保存文章
    </el-button>
  </el-form>
</template>
```

## 替换成其他 Adapter

三套 Adapter 的编辑器 props 保持一致。替换时只改 UI 库组件和编辑器入口:

| UI 库 | 编辑器组件 | 样式入口 |
| --- | --- | --- |
| Element Plus | `ProEditorElementPlus` | `tiptap-vue-pro-element-plus/style.css` |
| Naive UI | `ProEditorNaive` | `tiptap-vue-pro-naive/style.css` |
| Ant Design Vue | `ProEditorAntDesignVue` | `tiptap-vue-pro-ant-design-vue/style.css` |

## 常见坑

- 不要把标题、分类、状态等业务字段塞进富文本 HTML;它们应该继续由业务表单管理。
- 如果后端需要 JSON,把 `output="json"` 传给编辑器,同时调整保存接口的 payload。
- 提交前校验不要只判断 HTML 字符串长度,最好移除标签后再检查可见文本。
