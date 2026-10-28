<script setup lang="ts">
const profile = computed(() => usePilotStore().profile)
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})
const initials = computed(() =>
  (profile.value?.name || 'Pilot')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
)
const hours = computed(() =>
  profile.value ? profile.value.totalFlightHours.toLocaleString('en-US', { minimumFractionDigits: 1 }) : '—'
)
</script>

<template>
  <header class="app-header">
    <div class="app-header__row">
      <div class="app-header__id">
        <div class="app-header__brand">SUSI AIR</div>
        <p class="app-header__greet">{{ greeting }},</p>
        <h1 class="app-header__name">{{ profile?.name || 'Pilot' }}</h1>
        <div class="app-header__hours">
          <span class="num">{{ hours }}</span>
          <span class="app-header__hours-unit">total flight hours</span>
        </div>
      </div>
      <div class="app-header__avatar">
        <img v-if="profile?.avatarUrl" :src="profile.avatarUrl" :alt="profile.name" />
        <span v-else>{{ initials }}</span>
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.app-header {
  background: $navy;
  color: #fff;
  padding: 22px 16px 26px;
  border-radius: 0 0 20px 20px;
  margin-bottom: 20px;

  &__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    max-width: $shell-width;
    margin: 0 auto;
  }

  &__brand {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: $chart-accent;
    margin-bottom: 10px;
  }

  &__greet {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.62);
  }

  &__name {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-top: 2px;
  }

  &__hours {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-top: 10px;

    .num {
      font-size: 20px;
      color: #fff;
    }
  }

  &__hours-unit {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.62);
  }

  &__avatar {
    flex: 0 0 auto;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.12);
    border: 2px solid rgba(255, 255, 255, 0.25);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 18px;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
