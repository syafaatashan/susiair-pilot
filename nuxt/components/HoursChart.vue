<script setup lang="ts">
import type { ChartPoint, SummaryRange } from '~/types/api'

const props = defineProps<{ points: ChartPoint[]; limit: number; yMax: number; today: string; range: SummaryRange }>()

// Fixed viewBox; CSS scales it to the card width (mobile-first).
const W = 320
const H = 150
const PAD = { t: 12, r: 10, b: 22, l: 30 }
const plotW = W - PAD.l - PAD.r
const plotH = H - PAD.t - PAD.b

const todayX = computed(() => {
  const i = props.points.findIndex((p) => p.date === props.today)
  return i
})

/** Clamp so values above the limit line (dataset has them) still render on-canvas. */
function y(value: number) {
  const max = props.yMax || 1
  const clamped = Math.max(0, Math.min(value, max))
  return PAD.t + plotH - (clamped / max) * plotH
}

function x(i: number) {
  const n = props.points.length || 1
  return PAD.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
}

const coords = computed(() => props.points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value), i })))
const line = computed(() => coords.value.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' '))
const area = computed(() => {
  if (!coords.value.length) return ''
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${first.cx.toFixed(1)},${(PAD.t + plotH).toFixed(1)} ${line.value} ${last.cx.toFixed(1)},${(PAD.t + plotH).toFixed(1)}`
})
const limitY = computed(() => y(props.limit))
const gridValues = computed(() => [1, 0.75, 0.5, 0.25, 0])

function label(date: string) {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}
</script>

<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`Flight hours trend for range ${range}`">
      <defs>
        <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22C5E8" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#22C5E8" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- grey grid -->
      <g class="chart__grid">
        <line v-for="g in gridValues" :key="g" :x1="PAD.l" :x2="W - PAD.r" :y1="y(g * yMax)" :y2="y(g * yMax)" />
        <line v-if="todayX >= 0" class="chart__today-line" :x1="x(todayX)" :x2="x(todayX)" :y1="PAD.t" :y2="PAD.t + plotH" />
      </g>

      <polygon class="chart__area" :points="area" fill="url(#hoursFill)" />
      <polyline class="chart__line" :points="line" />

      <!-- red limit line -->
      <line class="chart__limit" :x1="PAD.l" :x2="W - PAD.r" :y1="limitY" :y2="limitY" />
      <text class="chart__limit-label" :x="W - PAD.r" :y="limitY - 4" text-anchor="end">limit {{ limit }}h</text>

      <circle
        v-for="p in coords"
        :key="p.date"
        class="chart__dot"
        :class="{ 'is-today': p.date === today }"
        :cx="p.cx"
        :cy="p.cy"
        :r="p.date === today ? 4 : 2.4"
      />

      <!-- y axis -->
      <text class="chart__axis" :x="PAD.l - 6" :y="PAD.t + 4" text-anchor="end">{{ yMax }}</text>
      <text class="chart__axis" :x="PAD.l - 6" :y="PAD.t + plotH + 4" text-anchor="end">0</text>
    </svg>

    <div class="chart__xlabels">
      <span>{{ points.length ? label(points[0].date) : '' }}</span>
      <span class="chart__xlabels-today">{{ today ? label(today) : '' }} · today</span>
      <span>{{ points.length ? label(points[points.length - 1].date) : '' }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.chart {
  width: 100%;

  svg {
    width: 100%;
    height: 150px;
    display: block;
    overflow: visible;
  }

  &__grid line {
    stroke: #e8ebef;
    stroke-width: 1;
  }

  &__today-line {
    stroke: #cfd6de;
    stroke-dasharray: 2 3;
  }

  &__area {
    stroke: none;
  }

  &__line {
    fill: none;
    stroke: $chart-accent;
    stroke-width: 2.2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  &__limit {
    stroke: $red;
    stroke-width: 1.6;
    stroke-dasharray: 5 4;
  }

  &__limit-label {
    fill: $red;
    font-size: 8px;
    font-weight: 700;
    font-family: $font;
  }

  &__dot {
    fill: $surface;
    stroke: $chart-accent;
    stroke-width: 1.6;

    &.is-today {
      fill: $chart-accent;
      stroke: $surface;
      stroke-width: 1.6;
    }
  }

  &__axis {
    fill: $text-secondary;
    font-size: 8px;
    font-family: $font;
  }

  &__xlabels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: $text-secondary;
    padding: 0 2px;
    margin-top: 2px;
  }

  &__xlabels-today {
    color: $navy;
    font-weight: 700;
  }
}
</style>
