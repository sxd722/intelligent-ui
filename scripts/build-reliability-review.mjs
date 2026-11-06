import {build,loadConfigFromFile} from 'vite'
import {readFile,writeFile} from 'node:fs/promises'
const {config}=await loadConfigFromFile({command:'build',mode:'production'})
await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/build-reliability-qa/',build:{outDir:'dist/build-reliability-qa',rollupOptions:{input:'artifacts/build-reliability-qa/index.html'}}})
await writeFile('dist/build-reliability-qa/index.html',await readFile('dist/build-reliability-qa/artifacts/build-reliability-qa/index.html'))
for(const id of ['movie','learning','news'])try{await writeFile(`dist/build-reliability-qa/${id}-spec.json`,await readFile(`artifacts/build-reliability-qa/${id}-spec.json`))}catch{}
const esbuild=await import('esbuild')
await esbuild.build({entryPoints:['artifacts/build-reliability-qa/audit-fixture.js'],outfile:'dist/build-reliability-qa/audit-fixture.js',bundle:true,format:'esm'})
await writeFile('dist/build-reliability-qa/audit-fixture.html','<!doctype html><meta charset="utf-8"><title>布局诊断回归</title><h1>隐藏辅助内容与真实裁切</h1><div id="fixture" style="position:relative;width:320px"></div><pre id="result"></pre><script type="module" src="./audit-fixture.js"></script>')
