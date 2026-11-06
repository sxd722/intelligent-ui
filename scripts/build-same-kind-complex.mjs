import {build,loadConfigFromFile} from 'vite'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {complexCases} from './same-kind-complex-cases.mjs'
if(!process.argv.includes('--data-only')){const {config}=await loadConfigFromFile({command:'build',mode:'production'});await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/same-kind-complex/',build:{outDir:'dist/same-kind-complex',rollupOptions:{input:'artifacts/same-kind-complex/index.html'}}});await writeFile('dist/same-kind-complex/index.html',await readFile('dist/same-kind-complex/artifacts/same-kind-complex/index.html'))}
await mkdir('dist/same-kind-complex',{recursive:true})
for(const c of complexCases){let baseline,reuse;try{baseline=JSON.parse(await readFile(`artifacts/same-kind-complex/${c.id}-baseline.json`,'utf8'))}catch{}try{reuse=JSON.parse(await readFile(`artifacts/same-kind-complex/${c.id}-reuse.json`,'utf8'))}catch{};await writeFile(`dist/same-kind-complex/${c.id}-display.json`,JSON.stringify({baseline,reuse,prompt:c.prompt}))}
