import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    // VITE_BASE_URL is set in CI to /repo-name/ for GitHub Pages; locally stays /
    base: env.VITE_BASE_URL || '/',
  }
})
