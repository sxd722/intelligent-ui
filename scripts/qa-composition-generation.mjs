import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const out=process.env.COMPOSITION_QA_OUTPUT||'artifacts/composition-v2/generated';await mkdir(out,{recursive:true})
const jobs=[
 ['pearl','用月距力风格做一张专注时间配比卡。总计100分钟，初始专注65分钟，其余休息。拖动调节比例，能保存方案并看出尚未保存的更改。不要查资料，这是个人规划工具。'],
 ['atlas','用动态学术风格做一个小型颜色向量教学实验。展示3种颜色的RGB示意值，可以选择颜色/通道，切换原始值和降低亮度后的值，保持当前选中位置并说明变化。不要查资料。'],
 ['rebel','用persona风格做一个虚构周末演出菜单：四组风格不同的音乐人，各有时间和舞台，选择后加入我的行程，能看到已保存的阵容。所有演出明确是示例，不查实时资讯。'],
 ['default','用默认风格做一张会议茶歇预算卡：人数初始6，单人预算初始25元，可调人数和单价，显示总额，可以保存本次预算并重置。无需资料和图片。']
]
for(const [id,prompt] of jobs.filter(([id])=>!process.env.COMPOSITION_QA_IDS||process.env.COMPOSITION_QA_IDS.split(',').includes(id))){
 const started=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let error
 try{
 const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',toolsEnabled:false,debugGeneration:true,cardSize:'square',renderMode:'native',designPreference:id}),signal:AbortSignal.timeout(300000)})
 if(!response.ok)throw Error('HTTP '+response.status)
 const raw=await response.text();await writeFile(`${out}/${id}.sse`,raw)
 for(const line of raw.split('\n'))if(line.startsWith('data:')&&line.slice(5).trim()!=='[DONE]'){const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e)}
 }catch(e){error=e.message}
 const message=envelope.message||{},spec=message.metadata?.card_spec,source=message.content?.parts?.join('')||''
 const summary={id,prompt,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,diagnostics:message.metadata?.diagnostics,repairCount:message.metadata?.repair_count}
 await writeFile(`${out}/${id}.json`,JSON.stringify({...summary,spec,source,events},null,2));if(source)await writeFile(`${out}/${id}.dsl`,source)
 console.log(JSON.stringify({...summary,spec:!!spec,design:spec?.design,debug:spec?.generationDebug?.tests.map(t=>({status:t.status,elapsedMs:t.elapsedMs,diagnostics:t.diagnostics}))}))
}
