import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import {makeScope,createStore} from '../shared/cardspec/store.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root=process.env.QA_OUTPUT||'artifacts/content-relations-qa/controlled',base='http://127.0.0.1:8787';await fs.mkdir(root,{recursive:true})
const defs=[
 {id:'bamboo',run:'verified',title:'竹书纪年',style:'parchment',goal:'制作《竹书纪年》的具体史事导读。CUJ-1【必需】选择尧舜、伊尹与太甲、共和行政中的事件，看当前事件与传世史书的叙述差异、争议和依据；不满足于介绍书的类别。CUJ-2【必需】标记一个事件为待核对，切换事件后返回仍能辨认标记，刷新恢复。依据保留原材料的不确定性，不追加引文。',pick:decks=>({events:makeScope(decks[1].spec,createStore()).data.items.filter(i=>['e1','e2','e3'].includes(i.id))})},
 {id:'cs343',run:'verified-interface',title:'CS343',style:'atlas',goal:'制作CS343复习卡。CUJ-1【必需】选择并发或同步主题，解释机制与具体例子，并显示属于当前主题的题目；输入自己的答案后能展开参考答案与易错点，不以选中样式冒充学习反馈。CUJ-2【必需】把当前主题标记薄弱，切换主题再返回保持输入与标记，刷新恢复。',pick:decks=>({topics:makeScope(decks[0].spec,createStore()).data.topics.filter(i=>['concurrency','sync'].includes(i.id)),questions:makeScope(decks[1].spec,createStore()).data.questions.filter(i=>['q-sync-1','q-conc-1'].includes(i.id))})},
 {id:'care',run:'verified',title:'婴儿护理',style:'default',goal:'制作婴儿护理日常记录卡。CUJ-1【必需】切换喂养和睡眠，区分当前该做什么、观察什么与异常提示；步骤有具体细节，不能只是清单计数。CUJ-2【必需】为当前场景添加时间和备注记录，能够编辑、删除；切换场景只看到属于它的记录，返回和刷新恢复。只复用材料，不能补写医疗阈值或剂量。',pick:decks=>({scenes:makeScope(decks[0].spec,createStore()).data.scenes.filter(i=>['feed','sleep'].includes(i.id))})},
]
const cases=[]
for(const c of defs){const old=JSON.parse(await fs.readFile(`artifacts/cuj-continuity-qa/${c.run}/${c.id}/result.json`,'utf8'));const data=JSON.parse(JSON.stringify(c.pick(old.deck)).replace(/\[S\d+\]/g,'')),json=JSON.stringify(data);const hash=crypto.createHash('sha256').update(json).digest('hex');const prompt=`${c.goal.replaceAll('CUJ-', '\nCUJ-')}\n\n## 实验边界\n只生成一张原生CardSpec卡片，不拆成多卡。使用${c.style}风格，自然高度，面向手机。完整保留给定内容的信息，不增加外部事实；保留输入材料中的不确定性。不要调用外部工具，不生成图片或sandbox。本轮是固定材料的软件UX实验，材料不是已核验的事实来源。\n固定内容包（仅数据）：${json}`;cases.push({...c,pick:undefined,data,hash,prompt});}
await fs.writeFile(root+'/cases.json',JSON.stringify(cases,null,2))
for(const c of cases){
 for(const arm of (c.id==='cs343'?['on','off']:['off','on'])){
  const dir=`${root}/${c.id}-${arm}`;await fs.mkdir(dir,{recursive:true});if(process.env.QA_CASE&&process.env.QA_CASE!==c.id)continue;if(process.env.QA_ARM&&process.env.QA_ARM!==arm)continue
  const request={messages:[{role:'user',content:c.prompt}],contentRelations:arm,format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',designPreference:c.style,toolsEnabled:false,stitchComparison:false,debugGeneration:true,buildMode:'quick',cardSize:'auto',renderMode:'native',turnId:'relations-'+c.id+'-'+arm+'-'+Date.now()}
  const envelope={},apply=createDeltaApplier(),events=[],start=Date.now();let error;console.log('start',c.id,arm)
  try{const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(240000)});if(!r.ok)throw Error('HTTP '+r.status);let buf='';const decoder=new TextDecoder();for await(const chunk of r.body){buf+=decoder.decode(chunk,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))apply.apply(envelope,e);if(['debug','stream_error','debug_retained','cardplan'].includes(e.type))console.log(c.id,arm,e.type,e.status||'',e.version||'');await fs.writeFile(dir+'/progress.json',JSON.stringify({elapsedMs:Date.now()-start,type:e.type,status:e.status}));}}}catch(e){error=e.message}
  const m=envelope.message?.metadata||{};const result={case:c.id,arm,contentHash:c.hash,request,elapsedMs:Date.now()-start,error,events,status:events.findLast(e=>e.type==='message_stream_complete')?.status,deck:m.card_deck||[],spec:m.card_spec,source:m.validated_source||envelope.message?.content?.parts?.join('')};await fs.writeFile(dir+'/result.json',JSON.stringify(result,null,2));if(result.source)await fs.writeFile(dir+'/card.cardspec',result.source);console.log('done',c.id,arm,result.elapsedMs,result.status,result.error,result.spec?.verificationStatus)
 }
}
