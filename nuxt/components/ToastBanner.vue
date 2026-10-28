<script setup lang="ts">
const toast = useToastStore()
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="t in toast.items" :key="t.id" class="toast" :class="`toast--${t.kind}`">
      <span class="toast__msg">{{ t.message }}</span>
      <button class="toast__close" aria-label="Dismiss" @click="toast.dismiss(t.id)">×</button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.toasts {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 92px;
  width: min(448px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 60;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 10px 26px rgba(14, 33, 56, 0.24);

  &--error {
    background: $red;
  }

  &--success {
    background: $success;
  }

  &--info {
    background: $navy;
  }

  &__msg {
    flex: 1;
  }

  &__close {
    background: none;
    border: none;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    opacity: 0.85;
  }
}
</style>
