import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      stream: path.resolve(__dirname, './src/utils/node-polyfill.js'),
      fs: path.resolve(__dirname, './src/utils/node-polyfill.js'),
    }
  },
  server: {
    proxy: {
      '/api-wilayah': {
        target: 'https://use.api.co.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-wilayah/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('x-api-co-id', 'bsvpXqFhfiLquJCM70fdk1MvyWeZ2zLl9t778a7nLl02TzdHcr');
          });
        }
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            return 'vendor-base'; // other shared libraries like date-fns, etc.
          }
        }
      }
    }
  }
})
