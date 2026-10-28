/**
 * Auth-aware navigation guard.
 * `authenticated` is resolved from the httpOnly cookie on the server (once per
 * SSR render) and via /api/auth/session on the client, so a forged cookie value
 * does not get past this check.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  // A forged or expired token resolved to `authenticated: false` during SSR
  // (checkSession -> /api/auth/session -> backend 401). The redirect to
  // /login below is the real guard: no protected data is ever server-rendered,
  // and a real sign-in overwrites the cookie via the httpOnly Set-Cookie on
  // /api/auth/login, so a lingering forged value can never take effect.
  if (!auth.authenticated && to.path !== '/login') return navigateTo('/login')
  if (auth.authenticated && to.path === '/login') return navigateTo('/')
})
