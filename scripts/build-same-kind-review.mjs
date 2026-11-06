import {build,loadConfigFromFile} from 'vite'
import {readFile,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {cases} from './same-kind-cases.mjs'
if(!process.argv.includes('--data-only')){const {config}=await loadConfigFromFile({command:'build',mode:'production'});await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/same-kind-qa/',build:{outDir:'dist/same-kind-qa',rollupOptions:{input:'artifacts/same-kind-qa/index.html'}}});await writeFile('dist/same-kind-qa/index.html',await readFile('dist/same-kind-qa/artifacts/same-kind-qa/index.html'))}
for(const c of cases){const b=JSON.parse(await readFile(`artifacts/same-kind-qa/${c.id}-baseline.json`,'utf8'));const spec=compileCard(c.source,{final:true,context:b.context,cardId:'qa-original-'+c.id}).spec;spec.sameKind={templateId:b.id};let reuse;try{reuse=JSON.parse(await readFile(`artifacts/same-kind-qa/${c.id}-reuse.json`,'utf8'))}catch{};await writeFile(`dist/same-kind-qa/${c.id}-display.json`,JSON.stringify({source:c.source,spec,reuse}))}
