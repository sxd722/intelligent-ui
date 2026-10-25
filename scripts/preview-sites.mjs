// Local verification of the actual Cloudflare Worker build; never writes secrets.
import { Miniflare } from '../sites/intelligent-ui/node_modules/miniflare/dist/src/index.js'
import { loadApiKey, loadPexelsKey } from '../server/env.mjs'
import { fileURLToPath } from 'node:url'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
const dir = fileURLToPath(new URL('../sites/intelligent-ui/', import.meta.url))
const workerRoot = path.join(dir, 'dist/server')
const files = (await readdir(workerRoot, { recursive: true })).filter(file => /\.(m?js|wasm)$/.test(file))
const mf = new Miniflare({
  modules: ['index.js', ...files.filter(file => file !== 'index.js')].map(file => ({ type: file.endsWith('.wasm') ? 'CompiledWasm' : 'ESModule', path: path.join(workerRoot, file) })), modulesRoot: workerRoot,
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  host: '127.0.0.1', port: 8792, inspectorPort: undefined,
  bindings: { MODEL_API_KEY: loadApiKey().value || '', PEXELS_API_KEY: loadPexelsKey().value || '', MODEL_NAME: 'glm-5.3-flash' },
  assets: { directory: dir + 'dist/client', routerConfig: { has_user_worker: true } },
})
console.log('Sites Worker preview:', String(await mf.ready))
const close = async () => { await mf.dispose(); process.exit(0) }
process.on('SIGINT', close)
process.on('SIGTERM', close)
