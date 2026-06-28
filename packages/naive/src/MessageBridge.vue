<script setup lang="ts">
/**
 * 无渲染桥接组件:在 NMessageProvider 内部用 useMessage() 拿到 message API,
 * 通过 expose 暴露给父组件,父组件再转成 notify 注入 Core。
 *
 * 为什么需要:Napptive 的 useMessage 必须在 NMessageProvider 的后代组件里调用,
 * 而 ProEditorNaive 自身(创建 useProEditor 的地方)不能直接用——它可能是 provider
 * 本身。所以拆一个零渲染子组件住在 provider 里,拿到实例后回传。
 */
import { onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'

const message = useMessage()
const ready = ref(false)
onMounted(() => {
  ready.value = true
})

defineExpose({
  get: () => message,
  ready,
})

// 不渲染任何 DOM
</script>

<template><span style="display:none" /></template>
