import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises'
import {probe} from './probe-glm-audit.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {makeScope,createStore} from '../shared/cardspec/store.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
const dir=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'artifacts/glm-audit-2026-10-15-final'
const sourceDir=process.argv.find(a=>a.startsWith('--source='))?.slice(9)||dir
await mkdir(dir,{recursive:true})
const results=[]
for(const file of (await readdir(sourceDir)).filter(f=>f.endsWith('-cardspec.json'))){
 const run=JSON.parse(await readFile(`${sourceDir}/${file}`,'utf8'));if(run.result.status!=='succeeded'){results.push({id:run.result.id,skipped:'generation failed'});continue}
 const spec=run.message.metadata.card_spec,scope=makeScope(spec,createStore()),bindings={}
 for(const [id,b] of Object.entries(spec.bindings)){
  const tool=TOOLS[b.tool];if(!tool||b.tool==='glm.generate')continue
  const rows=[0,1].map(i=>{
   const row={};for(const field of [...(tool.columns||[]),...(tool.additionalFields||[])]){
    row[field]=tool.fieldTypes?.[field]==='boolean'?true:/rating|score|rank|price|count|temp|humidity|pm25|aqi|high|low/i.test(field)?i+8:`QA ${field} ${i+1}`
   }
   return {...row,id:String(1001+i),rowKey:`row:qa-${id}-${i}`,series_id:String(2001+i),type:'movie',title:`QA item ${i+1}`,name:`QA item ${i+1}`,label:`QA item ${i+1}`,url:'https://example.com/qa',author:'QA',rank:i+1,score:8+i,scoreLabel:'QA score',comments:2,tags:[],rating:8+i,value:i+1}
  })
  let input;try{input=evaluate(b.input,scope)}catch{input={}}
  bindings[id]={status:'success',value:{items:rows,source:'SYNTHETIC QA ONLY',fetchedAt:'2026-10-15T00:00:00Z',...(tool.provider==='opencli'?{truncated:false}:{})},updatedAt:'2026-10-15T00:00:00Z',inputKey:JSON.stringify(input),definitionKey:JSON.stringify(input),version:1}
 }
 results.push({id:run.result.id,empty:probe(spec),populated:probe(spec,{bindings})})
}
await writeFile(`${dir}/interaction-probes.json`,JSON.stringify({fixture:'Two synthetic nonempty rows per declared read tool, not real external results. Effect-free breadth first traversal depth 5 / 100 states.',results},null,2))
console.log(JSON.stringify(results.map(r=>({id:r.id,skipped:r.skipped,emptyFailures:r.empty?.failures,populatedFailures:r.populated?.failures,states:r.populated?.states})),null,2))
