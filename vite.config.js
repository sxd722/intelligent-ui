import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { cpSync,writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { SANDBOX_RENDER_SCRIPT } from './src/cardspec/sandbox-document.mjs'

export default defineConfig({
  worker:{format:'es'},
  plugins: [{name:'freeze-trusted-sandbox-script',enforce:'pre',transform(code,id){if(!id.replaceAll('\\','/').endsWith('/src/cardspec/sandbox-document.mjs'))return;const a=code.indexOf('export const SANDBOX_RENDER_SCRIPT='),b=code.indexOf('export function sandboxDocument',a);if(a<0||b<a)throw Error('sandbox export boundary changed');return code.slice(0,a)+'export const SANDBOX_RENDER_SCRIPT='+JSON.stringify(SANDBOX_RENDER_SCRIPT)+';\n'+code.slice(b)},closeBundle(){writeFileSync('dist/sandbox-renderer-hash.json',JSON.stringify({sha256:createHash('sha256').update(SANDBOX_RENDER_SCRIPT.replace(/\r\n?/g,'\n')).digest('base64')}))}},react(), { name: 'copy-demos', closeBundle() { cpSync('demos', 'dist/demos', { recursive: true }) } }],
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
        taskComposition: resolve(__dirname, 'task-composition-qa.html'),
        toolDiscovery: resolve(__dirname, 'tool-discovery-lab.html'),
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
