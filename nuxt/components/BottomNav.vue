<script setup lang="ts">
const route = useRoute()

// Logbook / More are intentionally non-functional placeholders (per brief).
const items = [
  { key: 'home', label: 'Home', to: '/', enabled: true },
  { key: 'schedule', label: 'Schedule', to: '/schedule', enabled: true },
  { key: 'logbook', label: 'Logbook', to: '', enabled: false },
  { key: 'more', label: 'More', to: '', enabled: false }
]

function isActive(item: (typeof items)[number]) {
  return item.enabled && route.path === item.to
}

const paths: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  schedule: 'M7 3v3m10-3v3M4 8.5h16M5.5 5.5h13A1.5 1.5 0 0 1 20 7v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 1.5-1.5Z',
  logbook: 'M5 4.5h11A2.5 2.5 0 0 1 18.5 7v13H7.5A2.5 2.5 0 0 1 5 17.5v-13Zm0 13A2.5 2.5 0 0 1 7.5 15H18.5M9 8.5h6',
  more: 'M6 12h.01M12 12h.01M18 12h.01'
}
</script>

<template>
  <nav class="bottom-nav">
    <ul class="bottom-nav__list">
      <li v-for="item in items" :key="item.key">
        <NuxtLink
          v-if="item.enabled"
          :to="item.to"
          class="bottom-nav__item"
          :class="{ 'is-active': isActive(item) }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path :d="paths[item.key]" />
          </svg>
          <span>{{ item.label }}</span>
        </NuxtLink>
        <button v-else class="bottom-nav__item is-disabled" type="button" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path :d="paths[item.key]" />
          </svg>
          <span>{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(#{$shell-width}, 100vw);
  background: $surface;
  border-top: 1px solid $border;
  box-shadow: 0 -4px 18px rgba(14, 33, 56, 0.05);
  padding-bottom: env(safe-area-inset-bottom, 0);

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  &__item {
    width: 100%;
    background: none;
    border: none;
    padding: 10px 0 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: $text-secondary;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;

    svg {
      width: 22px;
      height: 22px;
    }

    &.is-active {
      color: $red;
    }

    &.is-disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
}
</style>
