import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = '/<repo-name>/' для GitHub Pages в подпапке.
// Для user/organization page (user.github.io) поставь '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE ?? '/imotbg/',
})
