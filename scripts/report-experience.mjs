import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {experienceDiagnostics} from '../shared/cardspec/experience.mjs'
import {probe} from './probe-glm-audit.mjs'
import {TOOLS,validateJson} from '../shared/cardspec/tools.mjs'
function fixtureField(field,tool,index){
 if(tool==='opencli.wttr.current'&&!['location','region','country','observedAt','description','windDirection'].includes(field))return 18+index
 if(field==='train_no')return '560000G13860'
 if(field==='code'&&tool.startsWith('opencli.12306.'))return 'G1386'
 if(field==='from_station')return '杭州东'
 if(field==='to_station')return '上海南'
 if(/date$/i.test(field))return '2026-10-15'
 if(/start_time|arrive_time/.test(field))return '14:30'
 if(/observedAt/.test(field))return '2026-10-15T14:00:00+08:00'
 return /rating|score|rank|price|count|temp|humidity|aqi|high|low/i.test(field)?index+8:`示例 ${field} ${index+1}`
}
const base='artifacts/experience-qa',rows=[],samples=[],variantDir=process.env.EXPERIENCE_VARIANT||'variant-final'
for(const arm of ['baseline','variant'])for(const file of (await readdir(base+'/'+(arm==='variant'?variantDir:arm))).filter(f=>/-r\d\.json$/.test(f))){
 const sourceDir=arm==='variant'?variantDir:arm,j=JSON.parse(await readFile(base+'/'+sourceDir+'/'+file,'utf8')),spec=j.message?.metadata?.card_spec
 const row={...j.result,arm,sourceDir,plan:j.message?.metadata?.experiencePlanning}
 if(spec&&j.result.status==='succeeded'){
  const toolValues={},bindings={}
  for(const [id,b]of Object.entries(spec.bindings||{})){if(b.tool==='glm.generate')continue;const t=TOOLS[b.tool],items=[0,1].map(i=>{
   const entry=Object.fromEntries([...(t?.columns||[]),...(t?.additionalFields||[])].map(f=>[f,t?.fieldTypes?.[f]==='boolean'?true:fixtureField(f,b.tool,i)]))
   return {...entry,id:String(1001+i),rowKey:'row:qa-'+i,series_id:String(2001+i),type:'movie',title:'示例对象 '+(i+1),name:'示例对象 '+(i+1),label:'示例对象 '+(i+1),url:'https://example.org/qa',author:'QA',score:8+i,rank:i+1,rating:8+i,value:i+1,tags:[],comments:2}
  });const value={items,source:'SYNTHETIC QA ONLY',fetchedAt:'2026-10-15T00:00:00Z',truncated:false};validateJson(value,t.outputSchema);toolValues[b.tool]=value;bindings[id]={value,status:'success',updatedAt:value.fetchedAt,error:''}}
  row.quality=experienceDiagnostics(spec,{plan:spec.experiencePlan,bindings});row.empty=probe(spec);row.populated=probe(spec,{bindings})
  row.blindId=createHash('sha256').update(arm+file).digest('hex').slice(0,8)
  samples.push({blindId:row.blindId,prompt:j.prompt,spec,toolValues})
 }
 rows.push(row)
}
try{samples.push(JSON.parse(await readFile(base+'/asset-sample.json','utf8')))}catch{}
try{samples.push(JSON.parse(await readFile(base+'/session-sample.json','utf8')))}catch{}
for(const id of ['webb','westlake']){try{const j=JSON.parse(await readFile(base+'/real-final/'+id+'.json','utf8'));if(j.result.status==='succeeded')samples.push({blindId:'real-'+id,prompt:j.prompt,spec:j.spec,resources:j.metadata?.resources||{},toolValues:{}})}catch{}}
await mkdir('public',{recursive:true});await writeFile('public/experience-qa-samples.json',JSON.stringify(samples.sort((a,b)=>a.blindId.localeCompare(b.blindId))));await writeFile(base+'/analysis.json',JSON.stringify(rows,null,2))
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)]
for(const arm of ['baseline','variant']){const r=rows.filter(r=>r.arm===arm);console.log({arm,total:r.length,first:r.filter(x=>x.firstPass).length,passed:r.filter(x=>x.status==='succeeded').length,medianMs:median(r.map(x=>x.elapsed)),medianText:median(r.filter(x=>x.quality).map(x=>x.quality.metrics.textCharacters)),planningFailures:r.filter(x=>x.plan?.status==='fallback').length,interactionFailures:r.filter(x=>x.populated?.failures?.length).length})}
