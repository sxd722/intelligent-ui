import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out=process.env.COMPOSITION_QA_OUTPUT||'artifacts/six-styles/generated';await mkdir(out,{recursive:true})
const jobs=[
 ['parchment','用羊皮纸风格做一张火星探测故事卡：三个简短章节，能前后翻章并切换工程师与旅行者视角。使用 folio 章节表现，说明是虚构故事，无需工具。'],
 ['business','用专业商务风格做一张项目效率比较卡。三组虚构变化数据，能切换本周与上周，保留当前选择。使用 comparison 共用正负刻度，不调用工具。'],
 ['academy','用辉石学院风格做一张灵感选择卡。三个不同创作方向，先揭示，再点选查看一句建议。使用 spread，内容是自省提示，不调用工具。']
]
for(const [id,prompt] of jobs.filter(([id])=>!process.env.COMPOSITION_QA_IDS||process.env.COMPOSITION_QA_IDS.split(',').includes(id))){
 const started=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let error
 try{
 const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',toolsEnabled:false,debugGeneration:false,cardSize:'square',renderMode:'native',designPreference:id}),signal:AbortSignal.timeout(300000)})
 if(!response.ok)throw Error('HTTP '+response.status)
 const raw=await response.text();await writeFile(`${out}/${id}.sse`,raw)
 for(const line of raw.split('\n'))if(line.startsWith('data:')&&line.slice(5).trim()!=='[DONE]'){const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e)}
 }catch(e){error=e.message}
 const message=envelope.message||{},spec=message.metadata?.card_spec,source=message.content?.parts?.join('')||''
 const summary={id,prompt,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,diagnostics:message.metadata?.diagnostics,repairCount:message.metadata?.repair_count}
 await writeFile(`${out}/${id}.json`,JSON.stringify({...summary,spec,source,events},null,2));if(source)await writeFile(`${out}/${id}.dsl`,source)
 console.log(JSON.stringify({...summary,spec:!!spec,design:spec?.design,debug:spec?.generationDebug?.tests.map(t=>({status:t.status,elapsedMs:t.elapsedMs,diagnostics:t.diagnostics}))}))
}
