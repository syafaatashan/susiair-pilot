<template>
  <div class="login-shell">
    <div class="login-card">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.login-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, $navy 0%, #16304f 46%, $bg 46%, $bg 100%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: $surface;
  border-radius: 18px;
  box-shadow: 0 18px 44px rgba(14, 33, 56, 0.22);
  padding: 28px 22px;
}
</style>
