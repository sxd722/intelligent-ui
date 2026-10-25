import {mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
const base='http://127.0.0.1:8787',out=process.env.TOOL_OUT||'artifacts/tools-qa/live';await mkdir(out,{recursive:true})
const cases=[
 ['live','做一张Hacker News真实热门榜单卡，用可用的CLI绑定加载4条内容，可见时每60秒更新。标注来源和时间，无数据时显示等待，不编造数据。'],
 ['search','做一个Hacker News搜索卡，初始关键词Rust，可输入关键词，点击搜索后调用CLI更新结果，结果可打开真实链接。'],
 ['refresh','做DEV真实开发者文章卡，显示4篇，手动刷新，刷新期间保留旧数据和我输入的阅读笔记。'],
 ['slot','做Hacker News真实资讯卡，显示3条并选择，点击解释按钮调用glm.generate，只更新detail slot的中文解释，保留我的笔记。'],
 ['page','做Hacker News真实资讯卡，显示3条，选择一条后点击深入探索，调用glm.generate在同一卡片生成下一页，宿主提供历史导航。'],
 ['journey','做一个互动学习入口卡：用户输入想学的概念（默认勒贝格测度），点击开始调用glm.generate生成下一页的概念解释和小测验；下一页应有继续探索按钮，可以再次调用glm.generate。使用宿主前进后退，不另写分页按钮。']
]
async function frames(response){const text=await response.text();return text.split(/\r?\n/).filter(s=>s.startsWith('data:')&&s.slice(5).trim()!=='[DONE]').map(s=>JSON.parse(s.slice(5)))}
async function invoke(tool,input,target='binding',view={}){
 const fs=await frames(await fetch(base+'/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input,target,view,requestId:randomUUID(),pageId:'smoke',sessionId:'tools-smoke',cause:'user'}),signal:AbortSignal.timeout(190000)}))
 const error=fs.find(f=>f.type==='error');if(error)throw Object.assign(new Error(error.error),{toolDiagnostics:fs.filter(f=>f.type==='diagnostics')})
 const result=fs.find(f=>f.type==='result')?.result;if(!result)throw new Error('missing tool result');return result
}
const results=[]
function controls(nodes,scope){return nodes.flatMap(n=>{
 if(n.props?.visible&&!evaluate(n.props.visible,scope)||n.type==='if'&&!evaluate(n.props.test,scope))return []
 if(n.type==='each')return evaluate(n.props.items,scope).flatMap((item,index)=>controls(n.children,{...scope,item,index,[n.props.as?.value||'item']:item}))
 if(['button','pressable','chip'].includes(n.type)&&n.props.onPress&&!(n.props.disabled&&evaluate(n.props.disabled,scope)))return [{action:evaluate(n.props.onPress,scope),args:n.props.args?evaluate(n.props.args,scope):{}}]
 return controls(n.children||[],scope)
})}
for(const [id,prompt] of cases.filter(([id])=>!process.env.TOOL_CASES||process.env.TOOL_CASES.split(',').includes(id))){
 const r={id,prompt,status:'failed',interactions:[]},started=Date.now()
 try{
  const fs=await frames(await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode:'direct',toolsEnabled:true,messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(210000)}))
  const applier=createDeltaApplier(),envelope={};for(const f of fs)if(!isControlEvent(f))applier.apply(envelope,f)
  const error=fs.find(f=>f.type==='stream_error');if(error)throw new Error(error.error.message)
  const spec=envelope.message?.metadata?.card_spec;if(!spec)throw new Error('missing card')
  r.spec=spec;r.source=envelope.message.content.parts[0];r.repairCount=envelope.message.metadata.repair_count||0;r.frames=fs
  const store=createStore(),bindings={};makeScope(spec,store)
  for(const [name,b] of Object.entries(spec.bindings||{}))if(b.tool!=='glm.generate'){
   const input=evaluate(b.input,makeScope(spec,store,{bindings}));const result=await invoke(b.tool,input)
   bindings[name]={value:result.value,status:'success',updatedAt:new Date().toISOString(),error:''};r.interactions.push({binding:name,tool:b.tool,status:'passed',count:result.value.items?.length})
  }
  if(['slot','page','journey'].includes(id)){
   const action=Object.entries(spec.actions).find(([,steps])=>steps.some(s=>s.type==='invoke'&&(id==='slot'?s.target?.startsWith('slot:'):s.target==='page')))
   if(!action)throw new Error('required generation action missing')
   let trigger=controls(spec.children,makeScope(spec,store,{bindings})).find(b=>b.action===action[0])
   if(!trigger){const pick=controls(spec.children,makeScope(spec,store,{bindings})).find(b=>spec.actions[b.action].every(s=>s.type!=='invoke'));if(pick)executeAction(spec,store,pick.action,{bindings,args:pick.args,event:{}});trigger=controls(spec.children,makeScope(spec,store,{bindings})).find(b=>b.action===action[0])}
   if(!trigger)throw new Error('required generation action is not reachable after selecting content')
   const effects=[];executeAction(spec,store,action[0],{bindings,args:trigger.args,event:{},effects})
   const effect=effects.find(e=>e.tool==='glm.generate');if(!effect)throw new Error('generation disabled in initial state; requires user selection')
   const generated=await invoke(effect.tool,effect.input,effect.target,{goal:prompt,summary:spec.intro});r.generated=generated;r.interactions.push({tool:'glm.generate',target:effect.target,status:'passed'})
   if(id==='journey'){
    const nextSpec=generated.spec,nextStore=createStore();makeScope(nextSpec,nextStore)
    let continuation
    for(let attempt=0;attempt<4&&!continuation;attempt++){
      const buttons=controls(nextSpec.children,makeScope(nextSpec,nextStore))
      const choice=buttons.find(b=>nextSpec.actions[b.action].some(s=>s.type==='invoke'&&s.target==='page'))||buttons.find(b=>nextSpec.actions[b.action].every(s=>s.type!=='invoke'))
      if(!choice)break
      const effects=[];executeAction(nextSpec,nextStore,choice.action,{args:choice.args,event:{},effects});continuation=effects.find(e=>e.target==='page')
    }
    if(!continuation)throw new Error('generated page lacks reachable continue-generation action')
    r.secondGenerated=await invoke(continuation.tool,continuation.input,'page',{goal:prompt,summary:nextSpec.intro});r.interactions.push({tool:'glm.generate',target:'second-page',status:'passed'})
   }
  }
  r.status='passed'
 }catch(e){r.error=e.message;if(e.toolDiagnostics)r.toolDiagnostics=e.toolDiagnostics}
 r.elapsed=Date.now()-started;results.push(r);await writeFile(`${out}/${id}.json`,JSON.stringify(r,null,2));await writeFile(`${out}/summary.json`,JSON.stringify(results.map(({spec,source,frames,generated,...rest})=>rest),null,2));console.log(id,r.status,r.error||'',r.elapsed)
}
