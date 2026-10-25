import {runReadWorkflow} from './workflow.mjs'
import {TOOLS,validateToolInput} from '../../shared/cardspec/tools.mjs'
import {validateAnnotations,analysisInput} from './datasets.mjs'
export async function executeHostWorkflow(tool,input,{invoke,analyze,signal}){
 if(tool==='workflow.run'){
  // Preflight every call before starting the graph, including those after a dependency.
  for(const step of input.steps){
   const t=TOOLS[step.tool]
   if(!t||t.readOnly!==true||t.provider==='host'||step.tool==='glm.generate')throw Error('workflow permits only registered readonly data tools')
   validateToolInput(step.tool,step.input)
  }
  const graph=await runReadWorkflow(input,async(tool,input,signal)=>(await invoke(tool,input,signal)).value,signal)
  const items=graph.steps.flatMap(s=>s.status==='succeeded'?(s.result.items||[]).map((r,i)=>({...r,originalId:r.rowKey??r.id??String(i),rowKey:s.id+':'+String(r.rowKey??r.id??i),source:r.source||s.result.source||s.tool})):[])
  return {items,source:'workflow',fetchedAt:new Date().toISOString(),truncated:!graph.complete||graph.steps.some(s=>s.result?.truncated),
   steps:graph.steps.map(s=>({id:s.id,tool:s.tool,status:s.status,...(s.error?{error:s.error,code:s.code||'ERROR'}:{}),returned:s.result?.items?.length||0,coverage:s.result?.coverage||null}))}
 }
 if(tool==='dataset.analyze'){
  const r={value:{items:input.items}},annotations=validateAnnotations(r,await analyze({rows:analysisInput(r),instruction:input.instruction},signal)),byId=new Map(annotations.map(a=>[a.id,a])),counts={}
  const items=input.items.map((r,i)=>{const a=byId.get(String(r.rowKey??r.id??`row-${i}`)),label=a?.label||'未分类';counts[label]=(counts[label]||0)+1;return {...r,analysisLabel:label,analysisQuote:a?.quote||''}})
  return {items,source:'model annotation of supplied sample',fetchedAt:new Date().toISOString(),truncated:false,analysis:{counts,classified:annotations.length,total:items.length,scope:'supplied sample only'}}
 }
 throw Error('Unknown host workflow')
}
