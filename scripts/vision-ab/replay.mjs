import fs from 'node:fs/promises';import path from 'node:path';import {createDebugSession} from '../../server/cardspec/debug-session.mjs';
const root='artifacts/generation-debug/42cbcfa8-3fd7-48f9-8af1-ff43b4c0dad6/64663f496faa7f211f02';const file='test-6.json';const before=JSON.parse(await fs.readFile(path.join(root,file))),source=await fs.readFile(path.join(root,'candidate.cardspec'),'utf8');
const old=JSON.parse(await fs.readFile('artifacts/rsi-adaptive/runs/6dc4f140-3ce4-4e7c-8839-2d09f5a80752.json'));
const ctx={...old.artifacts[0].spec.context,expressionDialect:'js-v1',renderMode:'native'};
const session=createDebugSession({context:()=>ctx,cardId:'vision-ab-replay'}),start=Date.now();
const after=await session.test({source,steps:before.steps},{signal:AbortSignal.timeout(90000)});
await fs.writeFile('artifacts/vision-ab-20261103/test-harness-replay.json',JSON.stringify({sourceUnchanged:true,sourceVersion:before.version,before:{status:before.status,diagnostics:before.diagnostics},after,elapsedMs:Date.now()-start},null,2));console.log(JSON.stringify({status:after.status,elapsedMs:Date.now()-start,diagnostics:after.diagnostics}));
