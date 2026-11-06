import {mkdir,writeFile} from 'node:fs/promises'
import {createSameKindService} from '../server/cardspec/same-kind.mjs'
import {cases} from './same-kind-cases.mjs'
const root='artifacts/same-kind-qa';await mkdir(root,{recursive:true});const service=createSameKindService({}),context={expressionDialect:'js-v1',renderMode:'native',cardSize:'square',modelProfile:'default'}
for(const c of cases.filter(c=>!process.argv[2]||c.id===process.argv[2])){const at=Date.now();try{const b=await service.registerVerified({source:c.source,context:{...context,userGoal:c.full},steps:c.steps},AbortSignal.timeout(60000));await writeFile(`${root}/${c.id}-baseline.json`,JSON.stringify({id:b.id,source:c.source,context:b.context,steps:c.steps,elapsedMs:Date.now()-at}));console.log(c.id,'verified',Date.now()-at,b.id)}catch(e){console.log(c.id,'failed',e.message);await writeFile(`${root}/${c.id}-baseline-error.json`,JSON.stringify({error:e.message}))}}
