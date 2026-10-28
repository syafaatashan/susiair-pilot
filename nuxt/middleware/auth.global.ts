/**
 * Auth-aware navigation guard.
 * - unauthenticated → /login
 * - authenticated hitting /login → /
 * All other pages keep running (pinia persists state across client-side navigation).
 */
export default defineNuxtRouteMiddleware((to) => {
  const tokenCookie = useCookie<string | null>('susi_token')
  const auth = useAuthStore()
  const authed = !!auth.token || !!tokenCookie.value

  if (!authed && to.path !== '/login') return navigateTo('/login')
  if (authed && to.path === '/login') return navigateTo('/')
})
