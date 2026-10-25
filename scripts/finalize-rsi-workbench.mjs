import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {WORKBENCH_RUN} from '../shared/workbench-cases.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex'),data=JSON.parse(await readFile('public/workbench/data.json','utf8'))
const files=['server/cardspec/prompt.mjs','server/cardspec/generation.mjs','shared/cardspec/registry.mjs','src/cardspec/Renderer.jsx','scripts/generate-rsi-workbench.mjs']
data.manifest.engineFingerprint=Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(p))])))
data.manifest.originalStartedAt='2026-10-16T07:16:23.650Z';data.manifest.finalizedAt=new Date().toISOString()
for(const r of data.records){r.sourceHash=hash(r.source||'');r.artifactVersion=r.sourceHash.slice(0,12)}
for(const dir of ['public/workbench','dist/workbench'])await writeFile(dir+'/data.json',JSON.stringify(data,null,2))
await writeFile(`artifacts/${WORKBENCH_RUN}/manifest.json`,JSON.stringify(data.manifest,null,2))
const results=data.records.map(({source,spec,resources,deck,...r})=>r)
await writeFile(`artifacts/${WORKBENCH_RUN}/results.json`,JSON.stringify({manifest:data.manifest,results},null,2))
await writeFile(`artifacts/${WORKBENCH_RUN}/results.csv`,'case,format,status,seconds,compile_repairs,regenerations,source_hash\n'+results.map(r=>[r.id,r.format,r.status,(r.elapsedMs/1000).toFixed(1),r.repairCount||0,r.priorAttempts?.length||0,r.artifactVersion].join(',')).join('\n'))
console.log(JSON.stringify({ready:results.filter(r=>r.status==='succeeded').length,total:results.length,failures:results.filter(r=>r.status!=='succeeded').map(r=>r.id)}))
