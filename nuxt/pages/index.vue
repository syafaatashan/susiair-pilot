<script setup lang="ts">
import { SUMMARY_RANGES } from '~/stores/flightHours'

const hours = useFlightHoursStore()
const docs = useDocumentsStore()

const rangeLabels: Record<string, string> = { '1w': '1w', '1m': '1m', '3m': '3m', '6m': '6m', '1y': '1y' }

// SSR-safe: awaited in setup (not onMounted, which never runs on the server) so the
// first paint already carries real API data. Kept OUT of useAsyncData's callback —
// awaiting inside it detaches the Nuxt instance and the Pinia stores go stale.
// The pilot profile is fetched by the default layout (the header needs it first).
await Promise.all([hours.fetchAll(), docs.fetchAll()])
</script>

<template>
  <div class="home">
    <!-- Hours to limit -->
    <section class="home__section">
      <div class="home__section-head">
        <h2 class="section-title">Hours to Limit</h2>
        <span v-if="hours.today" class="muted">as of {{ hours.today }}</span>
      </div>

      <div v-if="hours.error" class="inline-error">{{ hours.error }}</div>

      <div class="home__cards">
        <LimitCard v-for="card in hours.cards" :key="card.key" :card="card" />
      </div>

      <div class="card chart-card">
        <div class="chart-card__head">
          <div>
            <p class="chart-card__title">Flight Hours Trend</p>
            <p class="muted">
              {{ hours.summary ? `Rolling ${rangeLabels[hours.range]} window · limit ${hours.summary.limit}h` : 'Loading…' }}
            </p>
          </div>
          <div class="toggle" role="tablist" aria-label="Chart range">
            <button
              v-for="r in SUMMARY_RANGES"
              :key="r"
              type="button"
              role="tab"
              class="toggle__btn"
              :class="{ 'is-active': hours.range === r }"
              :aria-selected="hours.range === r"
              @click="hours.setRange(r)"
            >
              {{ r }}
            </button>
          </div>
        </div>

        <HoursChart
          v-if="hours.summary"
          :points="hours.summary.chartData"
          :limit="hours.summary.limit"
          :y-max="hours.summary.yMax"
          :today="hours.summary.today"
          :range="hours.summary.range"
        />
        <p v-else class="muted">Loading chart…</p>
      </div>
    </section>

    <!-- Documents -->
    <section class="home__section">
      <div class="home__section-head">
        <h2 class="section-title">My Documents</h2>
        <span class="muted">expiry status</span>
      </div>
      <div v-if="docs.error" class="inline-error">{{ docs.error }}</div>
      <div class="card">
        <DocumentList :items="docs.items" :loading="docs.loading" />
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.home {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}

.chart-card {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  &__title {
    font-size: 14px;
    font-weight: 800;
  }
}

.toggle {
  display: inline-flex;
  background: $bg;
  border-radius: $radius-pill;
  padding: 3px;

  &__btn {
    border: none;
    background: transparent;
    border-radius: $radius-pill;
    font-size: 11px;
    font-weight: 700;
    color: $text-secondary;
    padding: 5px 9px;

    &.is-active {
      background: $navy;
      color: #fff;
    }
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
