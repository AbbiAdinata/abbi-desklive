import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@components': path.resolve(__dirname, './src/components'),
      '@theme': path.resolve(__dirname, './src/theme'),
      '@routes': path.resolve(__dirname, './src/routes'),
    },
  },
  server: {
    open: true,
    port: 5173,
    host: true,
    // ═══════════════════════════════════════════════════════════
    // PROXY: Hanya public API (ticker, depth, candles)
    // PERUBAHAN: Proxy /tapi DIHAPUS — private API pindah ke backend
    // ═══════════════════════════════════════════════════════════
    proxy: {
      // Public API — ticker, ticker_all, depth (masih via Vite proxy untuk CORS)
      '/api/indodax': {
        target: 'https://indodax.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/indodax/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Proxy Error]', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Proxy Request]', req.method, req.url, '→', proxyReq.path);
          });
        },
      },
      // ❌ REMOVED: /tapi proxy — private API sekarang via backend server
      // Backend berjalan di port 3002, frontend fetch langsung ke backend
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          charts: ['recharts'],
        },
      },
    },
  },
})