// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  imports: { dirs: ['stores'] },
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/scss/main.scss'],
  runtimeConfig: {
    public: {
      // Override with NUXT_PUBLIC_API_BASE at runtime.
      apiBase: 'http://localhost:3010'
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Susi Air — Pilot',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0E2138' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
        }
      ]
    }
  }
})
