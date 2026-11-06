import {mkdir,writeFile} from 'node:fs/promises'
import {EXAMPLE_PROMPTS,examplePrompt} from '../src/example-prompts.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out='artifacts/interaction-purpose-qa';await mkdir(out,{recursive:true})
await Promise.all((process.env.QA_CASES||'fluid,bicycle').split(',').map(async id=>{
 const prompt=id==='pendulum'?'用一张动画教学卡解释单摆：用户改变摆长，看到周期与摆动速度如何变化，并显示一句原因。小角度、地球重力的教学示意，计算用T=2π√(L/g)，用SVG呈现。保持界面紧凑。':examplePrompt(EXAMPLE_PROMPTS.find(x=>x.id===id)),frames=[],state={},apply=createDeltaApplier(),start=Date.now();let buffer='';const decoder=new TextDecoder()
 try{
  const r=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',messages:[{role:'user',content:prompt}],toolsEnabled:false,renderMode:'hybrid',cardSize:'square',expressionDialect:'js-v1',modelProfile:process.env.QA_MODEL||'deep',generationProfile:'adaptive-v1',debugGeneration:process.env.QA_DEBUG==='1',buildMode:'quick'}),signal:AbortSignal.timeout(900000)})
  if(!r.ok)throw Error('HTTP '+r.status)
  for await(const b of r.body){buffer+=decoder.decode(b,{stream:true});let i;while((i=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);for(const line of block.split('\n'))if(line.startsWith('data:')){const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))apply.apply(state,f)}}}
 }catch(e){frames.push({type:'qa_error',message:e.message})}
 const result={id,elapsedMs:Date.now()-start,status:frames.findLast(f=>f.type==='message_stream_complete')?.status,error:frames.findLast(f=>f.type==='qa_error')}
 await writeFile(`${out}/${id}.json`,JSON.stringify({result,prompt,state,frames},null,2));console.log(JSON.stringify(result))
}))
