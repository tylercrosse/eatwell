import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Calorie Tracker',
        short_name: 'Calories',
        description: 'Snap a photo, log calories and macros',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. Never cache /api or /photos requests.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/photos/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      // Keep the service worker off in dev to avoid stale-cache confusion.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // Forward /api and /photos to FastAPI so the frontend calls same-origin in dev (no CORS).
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/photos': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
