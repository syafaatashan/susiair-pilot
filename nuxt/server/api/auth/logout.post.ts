/** POST /api/auth/logout — drops the httpOnly session cookie. */
export default defineEventHandler((event) => {
  deleteCookie(event, 'susi_token', { path: '/' })
  return { ok: true }
})
