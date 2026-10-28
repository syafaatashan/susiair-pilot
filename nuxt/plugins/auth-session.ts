/**
 * Resolves the session once per page load by asking the server whether the
 * httpOnly cookie is backed by a working token. This is what makes the route
 * guard real instead of presence-only: a forged or expired cookie resolves to
 * `authenticated: false`. Runs during SSR (redirects correctly on first paint)
 * and on the client (before client-side navigation).
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  // On the client the SSR payload already carries a verified answer — don't
  // re-ask and risk clobbering it with a transient failure.
  if (import.meta.server || !auth.authenticated) await auth.checkSession()
})
