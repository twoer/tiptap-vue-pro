<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  graph: string
}>()

const containerRef = ref<HTMLElement | null>(null)
const source = computed(() => decodeURIComponent(props.graph))

let themeObserver: MutationObserver | undefined
let renderVersion = 0

async function renderDiagram() {
  if (!containerRef.value) {
    return
  }

  const currentVersion = ++renderVersion
  const mermaid = (await import('mermaid')).default
  const isDark = document.documentElement.classList.contains('dark')

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: isDark ? 'dark' : 'default',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
    themeVariables: {
      fontFamily: 'var(--vp-font-family-base)',
    },
  })

  try {
    const id = `tvp-mermaid-${Date.now()}-${currentVersion}`
    const { svg } = await mermaid.render(id, source.value)

    if (containerRef.value && currentVersion === renderVersion) {
      containerRef.value.innerHTML = svg
    }
  } catch (error) {
    if (!containerRef.value || currentVersion !== renderVersion) {
      return
    }

    containerRef.value.innerHTML = ''
    const pre = document.createElement('pre')
    pre.className = 'mermaid-diagram__error'
    pre.textContent = error instanceof Error ? error.message : String(error)
    containerRef.value.appendChild(pre)
  }
}

onMounted(async () => {
  await nextTick()
  await renderDiagram()

  themeObserver = new MutationObserver(() => {
    void renderDiagram()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
})

watch(source, () => {
  void renderDiagram()
})
</script>

<template>
  <div class="mermaid-diagram">
    <div ref="containerRef" class="mermaid-diagram__canvas" />
  </div>
</template>

<style scoped>
.mermaid-diagram {
  margin: 24px 0;
  padding: 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.mermaid-diagram__canvas {
  overflow-x: auto;
}

.mermaid-diagram__canvas :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

.mermaid-diagram__error {
  margin: 0;
  color: var(--vp-c-danger-1);
  white-space: pre-wrap;
}
</style>
