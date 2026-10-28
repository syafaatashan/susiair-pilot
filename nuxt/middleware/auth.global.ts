/**
 * Auth-aware navigation guard.
 * `authenticated` is resolved from the httpOnly cookie on the server (once per
 * SSR render) and via /api/auth/session on the client, so a forged cookie value
 * does not get past this check.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.authenticated && to.path !== '/login') return navigateTo('/login')
  if (auth.authenticated && to.path === '/login') return navigateTo('/')
})
