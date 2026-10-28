<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const password = ref('')

async function submit() {
  const ok = await auth.login(username.value.trim(), password.value)
  if (!ok) return
  // Warm the profile so Home paints with real data immediately after login.
  await usePilotStore().fetchProfile()
  await router.push('/')
}
</script>

<template>
  <div class="login">
    <BrandLogo variant="dark" />

    <h1 class="login__title">Sign in</h1>
    <p class="login__sub muted">Use your pilot credentials to continue.</p>

    <form class="login__form" @submit.prevent="submit">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" autocomplete="username" placeholder="johndoe" required />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
      </div>

      <!-- Bad-credentials message straight from the API error envelope. -->
      <p v-if="auth.error" class="login__error" role="alert">{{ auth.error }}</p>

      <button class="btn-primary" type="submit" :disabled="auth.loading">
        {{ auth.loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p class="login__hint muted">Demo account — johndoe / susiairtest</p>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.login {
  display: flex;
  flex-direction: column;

  &__title {
    margin-top: 22px;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  &__sub {
    margin-top: 4px;
  }

  &__form {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__error {
    background: rgba(230, 55, 87, 0.1);
    border-left: 3px solid $red;
    color: $red;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    padding: 10px 12px;
  }

  &__hint {
    margin-top: 16px;
    text-align: center;
    font-size: 12px;
  }
}
</style>
