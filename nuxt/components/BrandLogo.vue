<script setup lang="ts">
/**
 * Susi Air wordmark. susiair.com's raster asset is not redistributable here, so
 * this is an original SVG mark in the brand palette (navy + brand red) — swap
 * `mark` for the official file if it is added to `public/`.
 */
withDefaults(defineProps<{ variant?: 'dark' | 'light' }>(), { variant: 'dark' })
</script>

<template>
  <span class="brand" :class="`brand--${variant}`">
    <span class="brand__mark">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M4 24c5.2.6 9.3-.3 12.6-2.6 3.2-2.2 5.6-5.6 7.2-10.2.3-.9 1.5-.9 1.7.1.7 3.9-.2 7.4-2.6 10.3-2.4 2.9-6 4.6-10.7 5.1-1.2.1-1.4-1.3-.2-1.7 2.6-.9 4.6-2.3 6-4.3"
          stroke="currentColor"
          stroke-width="2.1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="25.2" cy="9.4" r="1.5" fill="currentColor" />
      </svg>
    </span>
    <span class="brand__text">
      <span class="brand__name">SUSI AIR</span>
      <span class="brand__sub">Pilot App</span>
    </span>
  </span>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;

  &__mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;

    svg {
      width: 22px;
      height: 22px;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  &__name {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  &__sub {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  // on navy surfaces
  &--light {
    .brand__mark {
      background: $red;
      color: #fff;
    }

    .brand__name {
      color: #fff;
    }

    .brand__sub {
      color: rgba(255, 255, 255, 0.6);
    }
  }

  // on white surfaces
  &--dark {
    .brand__mark {
      background: $navy;
      color: $chart-accent;
    }

    .brand__name {
      color: $navy;
    }

    .brand__sub {
      color: $text-secondary;
    }
  }
}
</style>
