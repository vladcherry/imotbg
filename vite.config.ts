import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = '/<repo-name>/' for a GitHub Pages project site served from a subfolder.
// For a user/organization page (user.github.io) set '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE ?? '/imotbg/',
})
