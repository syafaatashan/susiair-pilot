<script setup lang="ts">
const schedule = useScheduleStore()
const selected = ref<string | null>(null)

// SSR-safe initial month load; month switches re-call the API via schedule.step().
if (!schedule.data) await schedule.fetchMonth()

function selectDate(date: string) {
  selected.value = date
}
</script>

<template>
  <div class="schedule">
    <div v-if="schedule.error" class="inline-error">{{ schedule.error }}</div>

    <div class="card schedule__card">
      <div class="schedule__nav">
        <button class="btn-ghost" type="button" :disabled="schedule.loading" @click="schedule.step(-1)">‹ Prev</button>
        <span class="schedule__today muted">{{ schedule.today ? `today · ${schedule.today}` : '' }}</span>
        <button class="btn-ghost" type="button" :disabled="schedule.loading" @click="schedule.step(1)">Next ›</button>
      </div>

      <DutyCalendar
        :year="schedule.year"
        :month="schedule.month"
        :entries="schedule.entries"
        :legend="schedule.legend"
        :today="schedule.today"
        @select="selectDate"
      />
      <p v-if="schedule.loading" class="muted schedule__loading">Loading {{ schedule.year }}-{{ String(schedule.month).padStart(2, '0') }}…</p>
    </div>

    <p v-if="selected" class="schedule__selected muted">Selected date: <strong>{{ selected }}</strong></p>

    <div v-if="selected" class="card schedule__placeholder">
      <h2 class="section-title">Detail page coming soon</h2>
      <p class="muted">Duty detail for {{ selected }} is not part of this test build.</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.schedule {
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__today {
    font-size: 11px;
  }

  &__loading {
    font-size: 12px;
  }

  &__selected strong {
    color: $navy;
  }

  &__placeholder {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}

.inline-error {
  background: rgba(230, 55, 87, 0.1);
  border-left: 3px solid $red;
  color: $red;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  padding: 10px 12px;
}
</style>
