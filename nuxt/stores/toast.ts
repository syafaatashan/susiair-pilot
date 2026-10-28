export type ToastKind = 'error' | 'success' | 'info'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
}

/** API errors / feedback surface here; the banner in the default layout renders it. */
export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])
  let seq = 0

  function show(message: string, kind: ToastKind = 'error', ttl = 6000) {
    const id = ++seq
    items.value = [{ id, message, kind }, ...items.value].slice(0, 3)
    if (import.meta.client && ttl > 0) setTimeout(() => dismiss(id), ttl)
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return { items, show, dismiss }
})
