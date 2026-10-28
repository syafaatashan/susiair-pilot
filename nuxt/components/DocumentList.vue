<script setup lang="ts">
import type { DocumentStatus, PilotDocument } from '~/types/api'

defineProps<{ items: PilotDocument[]; loading?: boolean }>()

const TONE: Record<DocumentStatus, string> = { safe: 'ok', soon: 'warn', expired: 'bad' }
const LABEL: Record<DocumentStatus, string> = { safe: 'Valid', soon: 'Expiring soon', expired: 'Expired' }

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[Number(m) - 1]} ${y}`
}
</script>

<template>
  <ul class="docs">
    <li v-for="doc in items" :key="doc.id" class="docs__item">
      <div class="docs__text">
        <p class="docs__label">{{ doc.label }}</p>
        <p class="docs__date">Expires {{ formatDate(doc.expiryDate) }}</p>
      </div>
      <!-- Badge state comes straight from the API `status`. -->
      <span class="docs__badge" :class="`docs__badge--${TONE[doc.status]}`">{{ LABEL[doc.status] }}</span>
    </li>
    <li v-if="!items.length && !loading" class="docs__empty muted">No documents returned by the API.</li>
  </ul>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.docs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    &:first-child {
      padding-top: 0;
    }
  }

  &__label {
    font-size: 14px;
    font-weight: 700;
  }

  &__date {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 2px;
  }

  &__badge {
    flex: 0 0 auto;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: $radius-pill;
    white-space: nowrap;

    &--ok {
      background: rgba(31, 191, 143, 0.14);
      color: #0f8f6a;
    }

    &--warn {
      background: rgba(245, 158, 11, 0.16);
      color: #b9770e;
    }

    &--bad {
      background: rgba(230, 55, 87, 0.14);
      color: $red;
    }
  }

  &__empty {
    padding: 8px 0;
  }
}
</style>
