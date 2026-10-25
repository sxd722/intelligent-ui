import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const experience=process.env.QA_PROFILE==='experience'
const out=experience?'artifacts/experience-preference-qa':'artifacts/generation-layout-qa'
await mkdir(out,{recursive:true})
const prompt='做一张咖啡入门互动阅读卡：冲煮比例、研磨、水温、时间、口味调整五个部分，每部分简短解释。可以输入咖啡粉克数和粉水比，显示所需水量；不要图片或查询工具。'
const jobs=experience?[{name:'browser-flow',cardSize:'auto',mode:'direct',prompt:'解释浏览器从输入网址到显示页面的过程，面向初学者。'},{name:'weekend',cardSize:'square',mode:'direct',prompt:'做一张杭州周末出游决策卡，帮我按天气和兴趣选择活动。'}]:[{cardSize:'auto',mode:'direct'},{cardSize:'square',mode:'direct'},{cardSize:'auto',mode:'staged'}]
const results=[]
for(const job of jobs){
  const started=Date.now(),applier=createDeltaApplier(),envelope={},phases=[]
  let status,error,buffer='',done=false,calls=0
  const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...job,format:'cardspec',toolsEnabled:experience,messages:[{role:'user',content:job.prompt||prompt}]}),signal:AbortSignal.timeout(210000)})
  const decoder=new TextDecoder()
  for await(const bytes of response.body){
    buffer+=decoder.decode(bytes,{stream:true});let boundary
    while((boundary=/\r?\n\r?\n/.exec(buffer))){
      const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length)
      for(const line of block.split('\n'))if(line.startsWith('data:')){
        const data=line.slice(5).trim();if(data==='[DONE]'){done=true;continue}
        const frame=JSON.parse(data)
        if(frame.type==='phase_begin')phases.push(frame.phase)
        if(frame.type==='stream_error')error=frame.error
        if(frame.type==='message_stream_complete')status=frame.status
        if(!isControlEvent(frame))applier.apply(envelope,frame)
      }
    }
  }
  const message=envelope.message||{},source=message.content?.parts?.join('')||'',spec=message.metadata?.card_spec
  const types=[];const walk=nodes=>{for(const n of nodes||[]){types.push(n.type);walk(n.children)}};walk(spec?.children)
  const result={...job,components:[...new Set(types)],tools:Object.values(spec?.bindings||{}).map(b=>b.tool),actions:Object.keys(spec?.actions||{}),status,done,error,elapsedMs:Date.now()-started,phases,sourceCharacters:source.length,repairCount:message.metadata?.repair_count,layout:message.metadata?.generation_layout,contextSize:spec?.context?.cardSize,diagnostics:message.metadata?.diagnostics,passed:status==='succeeded'&&done&&spec?.context?.cardSize===job.cardSize&&source.length<=24000}
  const name=job.name||`${job.cardSize}-${job.mode}`
  await writeFile(`${out}/${name}.dsl`,source)
  results.push(result);await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(result))
}
if(results.some(r=>!r.passed))process.exitCode=1
