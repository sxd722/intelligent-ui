// Explicit publication preparation. No local runtime, sessions, reports or keys are copied.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const target=path.join(root,'sites/intelligent-ui/showcase')
await mkdir(target,{recursive:true})
const excluded=new Set(['src/cardspec/RecoveryLab.jsx','shared/cardspec/recovery-train-fixture.mjs'])
for(const dir of ['src','shared'])await cp(path.join(root,dir),path.join(target,dir),{
 recursive:true,filter:p=>!excluded.has(path.relative(root,p).replaceAll('\\','/'))
})
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'))
pkg.scripts={build:'vite build'}
await writeFile(path.join(target,'package.json'),JSON.stringify(pkg,null,2)+'\n')
await cp(path.join(root,'package-lock.json'),path.join(target,'package-lock.json'))
await cp(path.join(root,'cardspec-baselines.html'),path.join(target,'index.html'))
await writeFile(path.join(target,'vite.config.js'),`import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
 base:'/cardspec-showcase/',publicDir:false,worker:{format:'es'},plugins:[react()],
 define:{'import.meta.env.VITE_BASELINE_DEMO_ONLY':JSON.stringify('1')},
 build:{outDir:'dist'}
})
`)
// Only bundled runtime assets may be fetched. This blocks API calls even if a UI
// regression tries to bypass the demo transport. Relative paths are not valid CSP sources.
const origins=['https://your-site.example.invalid','http://127.0.0.1:8792']
const assets=origins.map(x=>x+'/cardspec-showcase/assets/').join(' ')
const csp=`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src ${assets}; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'`
const html=await readFile(path.join(target,'index.html'),'utf8')
await writeFile(path.join(target,'index.html'),html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'"/>').replace('五个原生 CardSpec 基线','CardSpec 能力上限 · 互动演示'))
console.log('Prepared isolated static showcase source; existing application and live server untouched.')
