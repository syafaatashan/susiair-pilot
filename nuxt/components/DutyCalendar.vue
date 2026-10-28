<script setup lang="ts">
import type { LegendEntry, ScheduleEntry } from '~/types/api'

const props = defineProps<{
  year: number
  month: number
  entries: ScheduleEntry[]
  legend: LegendEntry[]
  today: string
}>()

const emit = defineEmits<{ select: [date: string] }>()

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const byDate = computed<Record<string, ScheduleEntry>>(() =>
  Object.fromEntries(props.entries.map((e) => [e.duty_date, e]))
)

function key(day: number) {
  return `${props.year}-${String(props.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const daysInMonth = computed(() => new Date(Date.UTC(props.year, props.month, 0)).getUTCDate())
/** Monday-first leading blanks. */
const leadOffset = computed(() => (new Date(Date.UTC(props.year, props.month - 1, 1)).getUTCDay() + 6) % 7)
const cells = computed(() => [
  ...Array.from({ length: leadOffset.value }, () => null as number | null),
  ...Array.from({ length: daysInMonth.value }, (_, i) => i + 1)
])

/** Badge: tick when count_logbooks === count_schedules, else remaining duties. */
function remaining(entry: ScheduleEntry) {
  return entry.count_logbooks === entry.count_schedules ? null : entry.count_schedules - entry.count_logbooks
}

/** base_color can be light (e.g. #FBA577) — pick readable text. */
function inkColor(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0E2138' : '#FFFFFF'
}
</script>

<template>
  <section class="cal">
    <header class="cal__head">
      <p class="cal__month">{{ MONTHS[month - 1] }} {{ year }}</p>
      <p class="cal__hint muted">Duty day · status</p>
    </header>

    <div class="cal__grid cal__grid--head">
      <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
    </div>

    <div class="cal__grid">
      <button
        v-for="(day, i) in cells"
        :key="i"
        type="button"
        class="cal__cell"
        :class="{ 'is-blank': day === null, 'is-today': day !== null && key(day) === today }"
        :disabled="day === null"
        @click="day !== null && emit('select', key(day))"
      >
        <template v-if="day !== null">
          <span class="cal__day">{{ day }}</span>
          <span
            v-if="byDate[key(day)]"
            class="cal__duty"
            :style="{ background: byDate[key(day)].base_color, color: inkColor(byDate[key(day)].base_color) }"
          >
            <span class="cal__base">{{ byDate[key(day)].base_name }}</span>
            <svg v-if="remaining(byDate[key(day)]) === null" class="cal__tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 13 4.5 4.5L19 6.5" />
            </svg>
            <span v-else class="cal__rem">{{ remaining(byDate[key(day)]) }}</span>
          </span>
        </template>
      </button>
    </div>

    <div v-if="legend.length" class="legend">
      <p class="legend__title">Legend</p>
      <ul class="legend__list">
        <li v-for="l in legend" :key="l.code" class="legend__item">
          <span class="legend__swatch" :style="{ background: l.color }" />
          <span class="legend__label">{{ l.label }}</span>
          <span class="legend__code">{{ l.code }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.cal {
  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  &__month {
    font-size: 16px;
    font-weight: 800;
  }

  &__hint {
    font-size: 11px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;

    &--head {
      margin-bottom: 4px;

      span {
        text-align: center;
        font-size: 10px;
        font-weight: 700;
        color: $text-secondary;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    }
  }

  &__cell {
    position: relative;
    aspect-ratio: 1 / 1;
    background: $bg;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 3px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: hidden;

    &.is-blank {
      background: transparent;
      cursor: default;
    }

    &.is-today {
      border-color: $navy;
      box-shadow: 0 0 0 1px $navy;
    }
  }

  &__day {
    font-size: 10px;
    font-weight: 700;
    color: $text-secondary;
    text-align: left;
    line-height: 1.1;
  }

  &__duty {
    flex: 1;
    margin-top: 2px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 1px 2px;
    min-height: 0;
  }

  &__base {
    font-size: 8px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tick {
    width: 10px;
    height: 10px;
    flex: 0 0 auto;
  }

  &__rem {
    font-size: 9px;
    font-weight: 800;
    min-width: 10px;
    text-align: center;
  }
}

.legend {
  margin-top: 16px;
  border-top: 1px solid #f0f2f5;
  padding-top: 12px;

  &__title {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $text-secondary;
    margin-bottom: 8px;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    min-width: 0;
  }

  &__swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  &__label {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__code {
    color: $text-secondary;
    font-size: 10px;
  }
}
</style>
