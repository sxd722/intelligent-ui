import {randomUUID} from 'node:crypto'
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {DISCOVERY_CASES,assessSelection} from './discovery-cases.mjs'
import {toolDiscovery} from './semantic-discovery.mjs'
import {createGenerationTools} from '../cardspec/generation-tools.mjs'
import {generationToolDisclosure} from '../cardspec/tool-disclosure.mjs'
import {toolDiscoveryReference,expandedToolIds} from '../../shared/cardspec/tool-discovery.mjs'
import {TOOLS,toolReference,validateToolInput} from '../../shared/cardspec/tools.mjs'

const finalTool={type:'function',function:{name:'submit_selection',description:'提交最小工具方案；需要前一步实体ID的调用用after注明，不能编造ID。无需工具可空数组。',parameters:{type:'object',properties:{selected:{type:'array',maxItems:6,items:{type:'object',properties:{id:{type:'string'},input:{type:'object'},after:{type:'string'},purpose:{type:'string'}},required:['id','purpose'],additionalProperties:false}},clarification:{type:'string'}},required:['selected'],additionalProperties:false}}}
const selectionTask='你是交互卡片的工具选择器。本轮只选工具，不生成卡片。按用户意图选最小且充分的能力；必要时分解多个意图。候选只是提示，不必选。对要用的每个工具先cli_describe核实参数，之后submit_selection一次提交。可立即执行的项必须给完整input；缺真实实体ID的详情项用after=前置工具ID，不填假ID。未给必要地点等信息先clarification。写操作只规划，不执行。日期按当前本地日期计算。'
const legacyDiscover=async(catalog,query)=>{const words=query.toLowerCase().split(/\s+/);return {tools:catalog.filter(t=>TOOLS[t.id]&&!t.unsupportedReason&&t.readOnly!==false&&t.provider!=='host'&&t.id!=='glm.generate').map(t=>({id:t.id,purpose:t.description,available:!!t.available,score:words.reduce((n,w)=>n+Number((t.id+' '+t.description+' '+t.group).toLowerCase().includes(w)),0)})).filter(t=>t.score).sort((a,b)=>b.score-a.score).slice(0,12)}}

// Score API/schema correctness separately from disclosure discipline. Older
// stored probes confused "not explicitly described" with malformed arguments.
// Keep original traces untouched; expose the same versioned evaluator for both arms.
export function scoreDiscoveryJob(job){
 if(!Array.isArray(job.selected))return job
 const fixture=DISCOVERY_CASES.find(c=>c.id===job.caseId);if(!fixture)return job
 const inspected=new Set((job.rounds||[]).flatMap(r=>(r.response?.tool_calls||[]).filter(c=>c.function.name==='cli_describe').map(c=>{try{return JSON.parse(c.function.arguments).id}catch{return null}})))
 const initial=JSON.stringify(job.initialPrompt||[]),selected=job.selected,byId=new Map(selected.map(s=>[s.id,s]))
 const contracts=selected.map(s=>{const known=inspected.has(s.id)||initial.includes('\\"id\\":\\"'+s.id+'\\"');try{
  const t=TOOLS[s.id];if(!t||t.unsupportedReason)throw Error('unknown/unsupported tool')
  if(s.after){const seen=new Set([s.id]);let dep=s.after;while(dep){if(!byId.has(dep)||seen.has(dep))throw Error('missing or cyclic dependency');seen.add(dep);dep=byId.get(dep).after}return {id:s.id,status:'deferred',after:s.after,contractDisclosed:known}}
  if(!s.input||typeof s.input!=='object'||Array.isArray(s.input))throw Error('missing structured input; user input or dependency required')
  validateToolInput(s.id,s.input);return {id:s.id,status:'valid',contractDisclosed:known,readOnly:t.readOnly!==false}
 }catch(e){return {id:s.id,status:'invalid',error:e.message,contractDisclosed:known}}})
 const blocked=!selected.length&&!!job.clarification&&fixture.expected.groups.length>0&&fixture.expected.groups.every(g=>g.every(id=>job.candidates?.some(t=>t.id===id&&t.available===false)&&job.clarification.includes(id)))
 return {...job,blocked,expected:fixture.expected,assessment:assessSelection(fixture,selected),contracts,evaluationVersion:2,evaluationNote:'Schema有效性、契约披露、依赖待定分别计分；旧trace保留原样，所有流程统一重评。'}
}

export function createDiscoveryLab({catalog,round,invoke,model='glm-5.3-flash',directory=fileURLToPath(new URL('../../artifacts/tool-discovery-qa/',import.meta.url))}){
 const jobs=new Map();let running=0
 async function persist(job){await mkdir(directory,{recursive:true});const path=directory+'/'+job.id+'.json',tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(job,null,2));await rename(tmp,path)}
 async function history(){const data=await import('node:fs/promises');try{const files=(await data.readdir(directory)).filter(f=>/^[a-f0-9-]+\.json$/.test(f));const rows=await Promise.all(files.map(async f=>{try{return JSON.parse(await readFile(directory+'/'+f,'utf8'))}catch{return null}}));return rows.filter(Boolean).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,150)}catch{return []}}
 async function run(job,fixture){
  const start=performance.now(),signal=AbortSignal.timeout(150000)
  try{
   const current=await catalog();job.catalog={total:current.length,opencli:current.filter(t=>t.provider==='opencli').length,available:current.filter(t=>t.available&&!t.unsupportedReason).length}
   const disclosure=job.mode==='hybrid'?await generationToolDisclosure(current,fixture.prompt,{signal}):{discovery:toolDiscoveryReference(current,fixture.prompt,{compact:true}),binding:toolReference(true,expandedToolIds(current,fixture.prompt),{expressionDialect:'js-v1'}),retrieval:{method:'legacy-keyword',elapsedMs:0},candidates:expandedToolIds(current,fixture.prompt).map(id=>({id}))}
   job.retrieval=disclosure.retrieval;job.candidates=disclosure.candidates
   const messages=[{role:'system',content:selectionTask+'\n'+disclosure.discovery+'\n'+disclosure.binding},{role:'user',content:JSON.stringify({request:fixture.prompt,localDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())})}]
   job.initialPrompt=structuredClone(messages);job.initialCharacters=JSON.stringify(messages).length;job.status='selecting';await persist(job)
   const described=new Set(job.mode==='legacy'?expandedToolIds(current,fixture.prompt):[]),ext=createGenerationTools({catalog:current,allowPlanning:false,discover:job.mode==='legacy'?legacyDiscover:toolDiscovery.discover})
   const tools=[...ext.tools().filter(t=>['cli_discover','cli_describe'].includes(t.function.name)),finalTool]
   for(let i=0;i<6;i++){
    const t=performance.now(),request=structuredClone({messages,tools,tool_choice:'required',model,temperature:.1,max_tokens:3072,reasoning_effort:'low'})
    const trace={round:i+1,request};job.rounds.push(trace)
    const response=await round(messages,{tools,toolChoice:'required',modelOverride:model,temperature:.1,maxTokens:3072,reasoningEffort:'low',signal})
    trace.elapsedMs=Math.round(performance.now()-t);trace.usage=response.usage;trace.response=response.message;trace.model=response.model
    messages.push(response.message)
    const calls=response.message.tool_calls||[]
    if(!calls.length)throw Error('model did not submit a tool selection')
    let submitted=false
    for(const call of calls){
     let value
     try{
      const input=JSON.parse(call.function.arguments)
      if(call.function.name==='submit_selection'){
       if(submitted||!Array.isArray(input.selected)||input.selected.length>6)throw Error('invalid selection submission')
       const ids=input.selected.map(s=>s.id);if(new Set(ids).size!==ids.length)throw Error('duplicate selected tool')
       job.selected=input.selected;job.clarification=input.clarification||''
       job.contracts=input.selected.map(s=>{try{const tool=current.find(t=>t.id===s.id);if(!tool||tool.unsupportedReason)throw Error('unknown/unsupported tool');if(s.after){if(!ids.includes(s.after)||s.after===s.id)throw Error('unresolved dependency');return {id:s.id,status:'deferred',after:s.after,contractDisclosed:described.has(s.id)}}validateToolInput(s.id,s.input);return {id:s.id,status:'valid',contractDisclosed:described.has(s.id),available:tool.available,readOnly:tool.readOnly!==false}}catch(e){return {id:s.id,status:'invalid',error:e.message}}})
       job.assessment=assessSelection(fixture,input.selected);value={accepted:true};submitted=true
      }else if(['cli_describe','cli_discover'].includes(call.function.name)){
       value=await ext.execute(call.function.name,input,signal);if(call.function.name==='cli_describe')described.add(input.id)
      }else throw Error('unknown tool')
     }catch(e){value={error:e.message}}
     messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(value)})
    }
    await persist(job)
    if(submitted)break
   }
   if(!job.selected)throw Error('selection not completed within six rounds')
   job.selectionMs=Math.round(performance.now()-start)
   if(job.live){job.status='invoking';for(const chosen of job.selected.filter(s=>!s.after&&fixture.live.includes(s.id)).slice(0,2)){
    const t=current.find(t=>t.id===chosen.id);if(!t?.available||t.readOnly===false||job.contracts.find(c=>c.id===chosen.id)?.status!=='valid'){job.invocations.push({id:chosen.id,status:'blocked',reason:t?.reason||'unavailable or invalid parameters'});continue}
    const began=performance.now();try{
     const result=await invoke({tool:chosen.id,input:chosen.input,target:'binding',cause:'generation',requestId:randomUUID(),pageId:'discovery-lab',sessionId:'discovery-lab'},AbortSignal.any([signal,AbortSignal.timeout(40000)]))
     job.invocations.push({id:chosen.id,input:chosen.input,status:'succeeded',elapsedMs:Math.round(performance.now()-began),itemCount:result.value?.items?.length??null,fields:Object.keys(result.value?.items?.[0]||result.value||{}),fetchedAt:result.value?.fetchedAt,source:result.value?.source})
    }catch(e){job.invocations.push({id:chosen.id,input:chosen.input,status:'failed',elapsedMs:Math.round(performance.now()-began),error:e.message,code:e.errorInfo?.code||e.code})}
   }}
   job.status='completed'
  }catch(e){job.status='failed';job.error=e.message}
  finally{job.elapsedMs=Math.round(performance.now()-start);job.finishedAt=new Date().toISOString();running--;await persist(job)}
 }
 return {async list(){return {cases:DISCOVERY_CASES,results:(await history()).map(scoreDiscoveryJob).map(j=>({...j,rounds:j.rounds.map(({request,response,...r})=>({...r,calls:response?.tool_calls}))})),model,scope:'工具发现/契约/调用测试，不生成卡片、不代表完整交互通过；预期列不发送给模型。'}},async start({caseId,mode='hybrid',live=false}){
  const fixture=DISCOVERY_CASES.find(c=>c.id===caseId);if(!fixture||!['hybrid','legacy'].includes(mode)||typeof live!=='boolean')throw Error('invalid case or mode')
  if(running>=2)throw Object.assign(Error('最多同时测试两行'),{statusCode:429})
  if([...jobs.values()].some(j=>j.caseId===caseId&&j.mode===mode&&['starting','selecting','invoking'].includes(j.status)))throw Error('this case is already running')
  const job={id:randomUUID(),caseId,mode,live,prompt:fixture.prompt,model,expected:fixture.expected,startedAt:new Date().toISOString(),status:'starting',rounds:[],invocations:[]}
  jobs.set(job.id,job);if(jobs.size>150)for(const [id,j] of jobs){if(['completed','failed'].includes(j.status)){jobs.delete(id);break}}
  running++;await persist(job);void run(job,fixture).catch(e=>{job.status='failed';job.error=e.message});return {id:job.id,status:job.status}
 },async get(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('invalid job id');return scoreDiscoveryJob(jobs.get(id)||JSON.parse(await readFile(directory+'/'+id+'.json','utf8')))}}
}
