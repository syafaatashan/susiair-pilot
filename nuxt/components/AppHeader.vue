<script setup lang="ts">
const auth = useAuthStore()
const pilot = usePilotStore()
const router = useRouter()

// NOTE: Pinia unwraps store refs, so `pilot.profile` is the plain Pilot object here.
const profile = computed(() => pilot.profile)

// Cosmetic only — wall-clock greeting. It never influences data values; every
// "today" in the UI comes from the API's `today` field.
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

async function logout() {
  await auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__row">
      <div class="app-header__id">
        <div class="app-header__brand">
          <BrandLogo variant="light" />
        </div>

        <template v-if="profile">
          <p class="app-header__greet">{{ greeting }},</p>
          <h1 class="app-header__name">{{ profile.name }}</h1>
          <div class="app-header__hours">
            <span class="num">{{ hours }}</span>
            <span class="app-header__hours-unit">total flight hours</span>
          </div>
        </template>
        <template v-else>
          <p class="app-header__greet">Pilot profile unavailable</p>
          <h1 class="app-header__name">—</h1>
          <div class="app-header__hours">
            <span class="app-header__hours-unit">total flight hours unavailable</span>
          </div>
        </template>
      </div>

      <div class="app-header__actions">
        <div class="app-header__avatar">
          <img v-if="profile?.avatarUrl" :src="profile.avatarUrl" :alt="profile.name" />
          <span v-else>{{ initials }}</span>
        </div>
        <button class="app-header__logout" type="button" @click="logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 4.5h3A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3M11 8l-4 4 4 4M7 12h9" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.app-header {
  background: $navy;
  color: #fff;
  padding: 20px 16px 24px;
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
    margin-bottom: 12px;
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

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
  }

  &__avatar {
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

  &__logout {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: $radius-pill;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 10px;
    white-space: nowrap;

    svg {
      width: 13px;
      height: 13px;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.18);
    }
  }
}
</style>
