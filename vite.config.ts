import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { validateProductionUrl } from './shared/deploymentConfig.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') validateProductionUrl(loadEnv(mode, process.cwd(), '').VITE_CONVEX_URL)
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@convex': fileURLToPath(new URL('./convex', import.meta.url)),
    },
  },
  }
})
