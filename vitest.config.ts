import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({ resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), '@convex': fileURLToPath(new URL('./convex', import.meta.url)) } }, test: { include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 15000 } })
