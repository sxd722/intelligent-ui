import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { cpSync } from 'node:fs'

export default defineConfig({
  worker:{format:'es'},
  plugins: [react(), { name: 'copy-demos', closeBundle() { cpSync('demos', 'dist/demos', { recursive: true }) } }],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cardDebug: resolve(__dirname, 'card-debug.html'),
        catalog: resolve(__dirname, 'catalog.html'),
        cardspecLab: resolve(__dirname, 'cardspec-lab.html')
        ,designTemplates: resolve(__dirname, 'design-templates.html')
        ,pearlReview: resolve(__dirname, 'pearl-review.html')
        ,htmlReference: resolve(__dirname, 'html-reference.html')
        ,workbench: resolve(__dirname, 'workbench.html')
        ,agentWorkbench: resolve(__dirname, 'agent-workbench.html')
        ,experienceQa: resolve(__dirname, 'experience-qa.html')
        ,adaptiveReview: resolve(__dirname, 'adaptive-review.html')
        ,cardspecBaselines: resolve(__dirname, 'cardspec-baselines.html')
        ,javascriptReview: resolve(__dirname, 'javascript-review.html')
      }
    }
  }
})
