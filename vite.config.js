import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: ['**/work/**', '**/*.sqlite*'] }, proxy: { '/api/alerts': { target: 'https://www.saibot92.auction', changeOrigin: true, secure: true }, '/api/augustus-product': { target: 'http://127.0.0.1:8791' }, '/api/augustus-canary': { target: 'http://127.0.0.1:8791' }, '/api/augustus': { target: 'http://127.0.0.1:8788' } } },
})
