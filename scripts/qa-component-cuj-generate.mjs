import {mkdir,writeFile} from 'node:fs/promises'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/component-cuj-qa/generated';await mkdir(root,{recursive:true})
const cases=[
 {id:'shopping',renderMode:'native',prompt:'做一张购物预算练习卡。固定商品：书30元、杯子20元、耳机80元，预算100元，不查询工具。能多选商品并显示真实合计与余额；超预算时不能确认，取消后能继续；确认后展示本次所选明细，可返回修改；刷新保留选择。请按题材选择一个明确的设计风格，紧凑但易于比较，不堆长文。'},
 {id:'motion',renderMode:'hybrid',prompt:'做一张观察匀速运动的交互学习卡。用一个内联严格React/SVG沙箱展示小车和位移刻度，原生滑杆控制速度1至5；时间固定10秒，修改速度后位移必须等于速度乘10并改变图形位置；可以揭晓计算解释后返回观察；刷新保留速度。采用适合学习的设计风格，不查询工具，不需要计时器或持续动画。'},
]
for(const c of cases){
 const payload={messages:[{role:'user',content:c.prompt}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:false,stitchComparison:false,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'full',renderMode:c.renderMode,turnId:'component-cuj-'+c.id+'-'+Date.now()}
 const started=Date.now(),events=[],applier=createDeltaApplier(),envelope={};let error
 try{
  const response=await fetch('http://127.0.0.1:8787/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8787'},body:JSON.stringify(payload),signal:AbortSignal.timeout(240000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  let buffer='';const decoder=new TextDecoder();for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))applier.apply(envelope,e)}}
 }catch(e){error=e.message}
 const message=envelope.message||{},spec=message.metadata?.card_spec,source=message.content?.parts?.join('')||''
 const r={id:c.id,request:payload,elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,spec,source,events}
 await writeFile(root+'/'+c.id+'.json',JSON.stringify(r,null,2));if(source)await writeFile(root+'/'+c.id+'.cardspec',source)
 console.log(JSON.stringify({id:c.id,status:r.status,error,spec:!!spec,elapsedMs:r.elapsedMs,design:spec?.design,disclosure:spec?.componentDisclosure?.names.length,cuj:spec?.requirementCoverage?.status,debug:spec?.generationDebug?.tests.at(-1)?.status}))
}
