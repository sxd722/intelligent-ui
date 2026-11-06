import fs from 'node:fs/promises';import path from 'node:path';import {compileCard} from '../../shared/cardspec/compiler.mjs';
const root='artifacts/vision-ab-20261103',r=JSON.parse(await fs.readFile(root+'/antarctic-on.json')),last=r.events.findLast(e=>e.type==='debug_feedback');
const dir='artifacts/generation-debug/42cbcfa8-3fd7-48f9-8af1-ff43b4c0dad6/'+last.version,source=await fs.readFile(path.join(dir,'candidate.cardspec'),'utf8');
const old=JSON.parse(await fs.readFile('artifacts/rsi-adaptive/runs/6dc4f140-3ce4-4e7c-8839-2d09f5a80752.json'));
const compiled=compileCard(source,{final:true,context:{...old.artifacts[0].spec.context,expressionDialect:'js-v1',renderMode:'native'}});
const out={...r,title:'南极直传 · 超时前候选，非交付成功',source,spec:compiled.spec,status:'diagnostic',metadata:{card_spec:compiled.spec},candidateOnly:true};
await fs.writeFile(root+'/antarctic-on-candidate.json',JSON.stringify(out));await fs.writeFile('dist/vision-ab/runs/antarctic-on.json',JSON.stringify(out));console.log({version:last.version,compileComplete:compiled.complete});
