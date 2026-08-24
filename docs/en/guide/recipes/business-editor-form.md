# Admin Rich Text Form

Use this recipe for articles, announcements, product descriptions, help-center entries, and similar admin forms. Keep title and summary in your business form, keep the rich text body in the editor `v-model`, then submit them as one payload.

[Try this scenario online](https://twoer.github.io/tiptap-vue-pro/playground/#/element-plus?scenario=business-form)

## Minimal integration

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'element-plus/dist/index.css'
import 'tiptap-vue-pro-element-plus/style.css'

const title = ref('')
const summary = ref('')
const content = ref('<h2>Product update</h2><p>Write the body here.</p>')
const saving = ref(false)

const titleError = computed(() => title.value.trim().length === 0)
const contentError = computed(() => content.value.replace(/<[^>]+>/g, '').trim().length === 0)
const canSubmit = computed(() => !titleError.value && !contentError.value && !saving.value)

async function submitArticle() {
  if (!canSubmit.value) {
    ElMessage.warning('Please enter a title and body')
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
    ElMessage.success('Saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="Title" :error="titleError ? 'Enter a title' : ''">
      <el-input v-model="title" placeholder="Enter a title" />
    </el-form-item>

    <el-form-item label="Summary">
      <el-input
        v-model="summary"
        type="textarea"
        :rows="3"
        placeholder="Optional list or SEO summary"
      />
    </el-form-item>

    <el-form-item label="Body" :error="contentError ? 'Enter body content' : ''">
      <ProEditorElementPlus
        v-model="content"
        toolbar-layout="compact"
        placeholder="Write the body..."
      />
    </el-form-item>

    <el-button type="primary" :loading="saving" @click="submitArticle">
      Save article
    </el-button>
  </el-form>
</template>
```

## Switching adapters

The editor props are aligned across adapters. Replace only the UI library components and editor entry:

| UI library | Editor component | Style entry |
| --- | --- | --- |
| Element Plus | `ProEditorElementPlus` | `tiptap-vue-pro-element-plus/style.css` |
| Naive UI | `ProEditorNaive` | `tiptap-vue-pro-naive/style.css` |
| Ant Design Vue | `ProEditorAntDesignVue` | `tiptap-vue-pro-ant-design-vue/style.css` |

## Common pitfalls

- Do not put title, category, publish status, or other business fields into editor HTML.
- If your backend stores JSON, pass `output="json"` to the editor and update your payload type.
- Do not validate only by HTML string length; strip tags before checking visible text.
