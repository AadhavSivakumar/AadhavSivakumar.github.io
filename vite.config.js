import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No manualChunks: Rollup's automatic splitting keeps the whole three.js
// stack inside the chunk created by About.jsx's lazy import of Lanyard.
// Hand-rolled chunking here previously created a vendor<->three cycle that
// broke React inside the three chunk — don't reintroduce it.
export default defineConfig({
  plugins: [react()],
  base: '/',
  assetsInclude: ['**/*.glb'],
  build: {
    chunkSizeWarningLimit: 3500,
  }
})
