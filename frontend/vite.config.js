import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  esbuild: {
    // Automatically strip console.log, console.debug, and debugger statements in production
    drop: ['console', 'debugger'],
  },
  build: {
    rollupOptions: {
      output: {
        // Optimize bundle compilation by splitting vendor packages into distinct chunks
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'vendor-charts';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
