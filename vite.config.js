import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.svg'],
      manifest: {
        name: 'AI 語音記帳工具',
        short_name: 'AI記帳',
        description: '語音智慧記帳，自動分類消費',
        start_url: '/ai-expense-tracker/',
        scope: '/ai-expense-tracker/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',
        orientation: 'portrait',
        categories: ['finance', 'utilities'],
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-192.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // 快取策略：預先快取核心資源
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 執行時快取 API 回應
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            // 匯率 API
            urlPattern: /^https:\/\/open\.er-api\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'exchange-rate-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 } },
          },
        ],
      },
    }),
  ],
  base: '/ai-expense-tracker/',
  server: {
    proxy: {
      // 達哥 GAISF API 反向代理（解決 CORS + SSL）
      '/api/gaisf': {
        target: 'https://moxaingress-gaisf-ingress.azurewebsites.net',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/gaisf/, ''),
      },
    },
  },
})
