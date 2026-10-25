// Generates/validates cards only. Does not mount them or invoke their CLI bindings.
import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out='artifacts/tool-discovery-qa';await mkdir(out,{recursive:true})
const jobs=[
 {name:'dining',mode:'staged',prompt:'杭州饭店推荐。查真实饭店，可以改关键词、查看详情；未取得数据时明确说明。不要示例饭店，不需要图片。',expect:['opencli.dianping.search']},
 {name:'podcasts',mode:'direct',prompt:'通勤路上有什么值得听的？查找真实的中文播客节目，让我筛选并浏览，来源清楚，不用示例数据，不需要图片。',expect:['opencli.apple-podcasts.search']},
 {name:'travel',mode:'staged',prompt:'安排周末出游：先查询杭州天气，再让我输入到达城市查询酒店。不编造结果，不需要图片。',expect:[['opencli.wttr.current','opencli.wttr.forecast'],'opencli.ctrip.hotel-search']},
 {name:'static',mode:'direct',prompt:'做一张增加、减少和归零的计数卡。完全本地交互，不查外部数据，不需要图片。',expect:[]},
]
const results=[]
async function run(job){
 const frames=[],envelope={},applier=createDeltaApplier();let status='incomplete'
 try{
  const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:job.mode,messages:[{role:'user',content:job.prompt}]}),signal:AbortSignal.timeout(210000)})
  let buffer='';const decoder=new TextDecoder()
  for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let boundary
   while((boundary=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length)
    for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const frame=JSON.parse(raw);frames.push(frame);if(frame.type==='message_stream_complete')status=frame.status;if(!isControlEvent(frame))applier.apply(envelope,frame)}
   }
  }
 }catch(e){status=e.message}
 const metadata=envelope.message?.metadata||{},tools=Object.values(metadata.card_spec?.bindings||{}).map(b=>b.tool)
 const source=envelope.message?.content?.parts?.[0]||''
 const declaredTools=[...new Set([...source.matchAll(/<binding\b[^>]*\btool="([^"]+)"/g)].map(m=>m[1]))]
 const toolSelectionPassed=job.expect.length?job.expect.every(id=>(Array.isArray(id)?id:[id]).some(t=>declaredTools.includes(t))):declaredTools.length===0
 const diagnostics=frames.findLast(f=>f.type==='stream_error')?.error?.message||null
 const repairs=metadata.repair_count??frames.findLast(f=>f.type==='server_ste_metadata')?.metadata?.repair_count
 const result={name:job.name,mode:job.mode,status,tools,declaredTools,expected:job.expect,toolSelectionPassed,selectionPassed:status==='succeeded'&&toolSelectionPassed,repairs,diagnostics,disclosure:metadata.tool_disclosure}
 await writeFile(`${out}/${job.name}.json`,JSON.stringify({...result,prompt:job.prompt,source:envelope.message?.content?.parts?.[0],frames},null,2));results.push(result);console.log(JSON.stringify(result))
}
await Promise.all(Array.from({length:2},async()=>{while(jobs.length)await run(jobs.shift())}))
await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2))
