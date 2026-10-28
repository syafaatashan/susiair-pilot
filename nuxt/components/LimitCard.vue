<script setup lang="ts">
import type { LimitCard } from '~/stores/flightHours'

const props = defineProps<{ card: LimitCard }>()

const pct = computed(() => (props.card.limit ? Math.min(100, (props.card.hours / props.card.limit) * 100) : 0))
const over = computed(() => props.card.hours > props.card.limit)
const tone = computed(() => (over.value ? 'danger' : pct.value >= 80 ? 'warning' : 'ok'))
const hours = computed(() => props.card.hours.toFixed(1))
</script>

<template>
  <article class="limit-card card">
    <header class="limit-card__head">
      <span class="limit-card__label">{{ card.label }}</span>
      <span class="limit-card__window">{{ card.window }}</span>
    </header>
    <p class="limit-card__value">
      <span class="num">{{ hours }}</span>
      <span class="limit-card__limit">/ {{ card.limit }} h</span>
    </p>
    <div class="limit-card__track" :class="`limit-card__track--${tone}`">
      <div class="limit-card__fill" :style="{ width: `${pct}%` }" />
    </div>
    <p class="limit-card__foot" :class="`limit-card__foot--${tone}`">
      {{ over ? `${(card.hours - card.limit).toFixed(1)} h over limit` : `${(card.limit - card.hours).toFixed(1)} h remaining` }}
    </p>
  </article>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.limit-card {
  padding: 12px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  &__label {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $navy;
  }

  &__window {
    font-size: 10px;
    color: $text-secondary;
    white-space: nowrap;
  }

  &__value {
    margin: 8px 0 8px;
    display: flex;
    align-items: baseline;
    gap: 4px;

    .num {
      font-size: 22px;
    }
  }

  &__limit {
    font-size: 12px;
    color: $text-secondary;
    font-weight: 600;
  }

  &__track {
    height: 6px;
    border-radius: $radius-pill;
    background: #eef0f3;
    overflow: hidden;

    &--ok .limit-card__fill {
      background: $chart-accent;
    }

    &--warning .limit-card__fill {
      background: $warning;
    }

    &--danger .limit-card__fill {
      background: $red;
    }
  }

  &__fill {
    height: 100%;
    border-radius: $radius-pill;
    transition: width 0.35s ease;
  }

  &__foot {
    margin-top: 6px;
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;

    &--danger {
      color: $red;
    }

    &--warning {
      color: #b9770e;
    }
  }
}
</style>
