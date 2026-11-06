import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {CASES,roles,envelope} from './cases.mjs'
import {checkMapping,normalize,transportFor} from './engine.mjs'
const dir='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2',checks=[];
async function check(c,name,fn){try{await fn();checks.push({case:c.id,name,passed:true})}catch(e){checks.push({case:c.id,name,passed:false,error:e.message})}}
for(const c of CASES.filter(c=>!c.static&&!c.write)){
 for(const role of Object.keys(roles)){
  await check(c,'mapped-'+role,()=>{const row=normalize(c.rows,c.map)[0];assert.equal(row[role],c.rows[0][c.map[role]]??null)})
  await check(c,'missing-'+role,()=>{const row={...c.rows[0]};delete row[c.map[role]];assert.equal(normalize([row],c.map)[0][role],null)})
  await check(c,'null-'+role,()=>{const row={...c.rows[0],[c.map[role]]:null};assert.equal(normalize([row],c.map)[0][role],null)})
 }
 await check(c,'empty-preserved',()=>assert.deepEqual(normalize([],c.map),[]));
 await check(c,'raw-preserved',()=>assert.deepEqual(normalize(c.rows,c.map)[0].raw,c.rows[0]));
 await check(c,'reorder-preserves-identity',()=>assert.equal(normalize([...c.rows].reverse(),c.map)[0].id,c.rows.at(-1)[c.map.id]));
 await check(c,'unknown-field-rejected',()=>assert.throws(()=>checkMapping(c,{title:'nonexistent_field'})));
 if(c.map.metric)await check(c,'string-metric-rejected',()=>assert.throws(()=>checkMapping({...c,rows:[{...c.rows[0],[c.map.metric]:'unknown'}]},c.map)));
 if(c.detail){const call=transportFor(c,'A0',c.map,[]),fixed=c.detail.fixed||{};
  await check(c,'wrong-entity-rejected',()=>assert.rejects(()=>call({tool:c.detail.tool,input:{...fixed,[c.detail.param]:'wrong-ui-key'}})));
  await check(c,'real-business-id-accepted',async()=>assert.deepEqual((await call({tool:c.detail.tool,input:{...fixed,[c.detail.param]:c.rows[0][c.map.id]}})).value,c.details(c.rows[0][c.map.id])));
 }
}
const maps=JSON.parse(await readFile(dir+'/maps.json','utf8'));const result={scope:'Adapter and controlled-transport checks, not live service validation',checks,passed:checks.filter(x=>x.passed).length,total:checks.length,mappingAgreement:maps.scores.map(s=>({case:s.case,arm:s.arm,exactRoles:s.checks.filter(x=>x.pass).length,total:s.checks.length,note:'Exact role agreement; optional-role alternatives may be semantically acceptable. Gold-config arms are plumbing controls, not learned generalization.'}))};await writeFile(dir+'/offline.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,total:result.total,failures:checks.filter(x=>!x.passed)}));if(result.passed!==result.total)process.exitCode=1;

