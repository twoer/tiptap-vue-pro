<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    title?: string
  }>(),
  {
    compact: false,
  },
)

const { lang } = useData()
const isEnglish = computed(() => lang.value === 'en-US')
const playgroundUrl = computed(() => `${import.meta.env.BASE_URL}playground/`)
const displayTitle = computed(() => props.title ?? (isEnglish.value ? 'Live Demo' : '在线体验'))
const openLabel = computed(() => isEnglish.value ? 'Open fullscreen' : '全屏打开')
</script>

<template>
  <section class="playground-embed" :class="{ 'is-compact': compact }">
    <div class="playground-embed__bar">
      <div class="playground-embed__window">
        <span />
        <span />
        <span />
      </div>
      <div class="playground-embed__title">
        {{ displayTitle }}
      </div>
      <a class="playground-embed__open" :href="playgroundUrl" target="_blank" rel="noreferrer">
        {{ openLabel }}
      </a>
    </div>
    <iframe
      class="playground-embed__frame"
      :src="playgroundUrl"
      title="Tiptap Vue Pro Playground"
      loading="lazy"
    />
  </section>
</template>

<style scoped>
.playground-embed {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--vp-c-divider), transparent 12%);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow:
    0 24px 70px color-mix(in srgb, var(--vp-c-text-1), transparent 90%),
    inset 0 1px 0 color-mix(in srgb, white, transparent 35%);
}

.playground-embed__bar {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--vp-c-bg-soft), white 18%), var(--vp-c-bg-soft));
}

.playground-embed__window {
  display: flex;
  gap: 7px;
}

.playground-embed__window span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-divider);
}

.playground-embed__window span:nth-child(1) {
  background: #ff6b6b;
}

.playground-embed__window span:nth-child(2) {
  background: #ffd166;
}

.playground-embed__window span:nth-child(3) {
  background: #43d17a;
}

.playground-embed__title {
  overflow: hidden;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 650;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playground-embed__open {
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 650;
  text-decoration: none;
}

.playground-embed__open:hover {
  color: var(--vp-c-brand-2);
}

.playground-embed__frame {
  display: block;
  width: 100%;
  height: min(72vh, 760px);
  min-height: 560px;
  border: 0;
  background: var(--vp-c-bg);
}

.playground-embed.is-compact .playground-embed__frame {
  height: 520px;
  min-height: 420px;
}

@media (max-width: 760px) {
  .playground-embed {
    border-radius: 8px;
  }

  .playground-embed__bar {
    grid-template-columns: 54px minmax(0, 1fr) auto;
    padding: 0 10px;
  }

  .playground-embed__window {
    gap: 5px;
  }

  .playground-embed__window span {
    width: 8px;
    height: 8px;
  }

  .playground-embed__frame,
  .playground-embed.is-compact .playground-embed__frame {
    height: 640px;
    min-height: 640px;
  }
}
</style>
