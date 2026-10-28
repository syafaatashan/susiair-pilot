<script setup lang="ts">
// The header lives outside the page's async setup, so fetch the pilot here:
// an awaited setup suspends the whole layout subtree until the profile is in.
// The auth plugin has already resolved the session, so a missing cookie would
// have been redirected to /login by the global middleware before this runs.
const pilot = usePilotStore()
await (pilot.profile ? Promise.resolve() : pilot.fetchProfile())
</script>

<template>
  <div class="shell">
    <div class="shell__inner">
      <AppHeader />
      <main class="shell__main">
        <slot />
      </main>
    </div>
    <ToastBanner />
    <BottomNav />
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.shell {
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  background: $bg;

  &__inner {
    width: 100%;
    max-width: $shell-width;
    padding-bottom: 84px; // room for the fixed bottom nav
  }

  &__main {
    padding: 0 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
}
</style>
