<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'element-plus/dist/index.css'

// 编辑器内容
const content = ref(
  '<h2>你好,tiptap-vue-pro 👋</h2>' +
    '<p>这是一个基于 <strong>Tiptap v3</strong> + <em>Element Plus</em> 的富文本编辑器组件。</p>' +
    '<ul><li>开箱即用</li><li>支持图片上传</li><li>支持表格、代码块、列表</li></ul>' +
    '<blockquote>试试上面的工具栏。</blockquote>',
)

// 模拟图片上传:这里用 FileReader 转 dataURL 演示,实际项目换成 OSS/COS 上传
async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <div class="page">
    <header class="page__header">
      <h1>tiptap-vue-pro</h1>
      <p>Vue3 + Tiptap v3 + Element Plus 的富文本编辑器(非官方社区项目)</p>
    </header>

    <section class="demo">
      <h3>编辑器</h3>
      <ProEditorElementPlus
        v-model="content"
        output="html"
        placeholder="开始输入..."
        :upload-image="uploadImage"
      />
    </section>

    <section class="demo">
      <h3>输出(HTML)</h3>
      <pre class="output">{{ content }}</pre>
    </section>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #303133;
}

.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 20px;
}

.page__header {
  margin-bottom: 32px;
}

.page__header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.page__header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.demo {
  margin-bottom: 32px;
}

.demo h3 {
  margin: 0 0 12px;
  font-size: 15px;
  color: #606266;
}

.output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  overflow-x: auto;
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
