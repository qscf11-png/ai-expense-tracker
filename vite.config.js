import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
