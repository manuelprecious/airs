import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    // Force no caching in development
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  },
  build: {
    // Add hash to file names to prevent caching
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },
  // Clear screen when restarting
  clearScreen: true
})