// Live gateway test, without starting a server or touching OpenCLI/Owl.
import {mkdir,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {generateSandbox} from '../server/cardspec/sandbox.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {getQuickJS} from 'quickjs-emscripten'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
const out=process.env.WEB_QA_DIR||'artifacts/web-creation'
await mkdir(out,{recursive:true})
const model=process.env.MODEL_NAME||'glm-5.3-flash'
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model})
const energy='做一个可操纵的储能调度模拟器，用图形和平滑变化展示能量。示例规则：初始60，推进消耗10且步数加一，不足10禁止推进，充能加15且上限100，可重置。按钮名称为推进一步、充能、重置。少文字。'
const cases=[
 ['energy','hybrid',energy],
 ['vectors','hybrid','做一个向量投影实验，图形显示一条可调方向的单位向量及它在横轴的投影；调节角度时箭头和投影平滑变化，可重置。默认45度，显示x=cos(角度)，只做一屏可玩图解。'],
 ['native-energy','native',energy],
 ['checklist','hybrid','做一个简单行李清单：雨伞、充电器、身份证。可勾选并显示完成数。']
]
const walk=nodes=>nodes.flatMap(n=>[n,...walk(n.children||[])])
const buttons=tree=>Array.isArray(tree)?tree.flatMap(buttons):tree&&typeof tree==='object'?[...(tree.type==='button'&&!tree.props.disabled?[tree]:[]),...buttons(tree.children)]:[]
const results=[]
for(const [id,renderMode,prompt]of cases){
 if(process.env.WEB_QA_CASES&&!process.env.WEB_QA_CASES.split(',').includes(id))continue
 const start=Date.now(),trace=[];let calls=0
 const signal=AbortSignal.timeout(240000)
 const streamUpstream=async(messages,options)=>{
  const entry={messages,stage:options.stage||'card',pieces:[]};trace.push(entry);calls++
  return round(messages,{...options,onPiece:p=>{entry.pieces.push(p);options.onPiece?.(p)}})
 }
 const result={id,renderMode,prompt,model}
 try{
  const card=await generateCard({streamUpstream,signal,catalog:[],input:{prompt},view:{renderMode,generationMode:'direct',cardSize:'square'}})
  Object.assign(result,{card,cardMs:Date.now()-start})
  const sandbox=walk(card.spec.children).find(n=>n.type==='sandbox')
  result.usedSandbox=!!sandbox
  if(sandbox){
   const scope=makeScope(card.spec,createStore()),p=Object.fromEntries(Object.entries(sandbox.props).map(([k,v])=>[k,evaluate(v,scope)]))
   const surface=await generateSandbox({streamUpstream,signal,input:{prompt:p.brief,context:{data:p.input||{},initial:p.initial||{}}},view:{renderMode,height:p.height,width:320}})
   result.surface=surface;result.props=p
   const Q=await getQuickJS(),vm=createSandboxVM(Q,{code:surface.module.code,input:p.input||{},state:p.initial||{}})
   try{
    let value=vm.snapshot()
    if(id==='energy'){
     const click=label=>{const button=buttons(value.tree).find(b=>label.test(JSON.stringify(b.children)));if(!button)throw Error('Missing enabled '+label);value=vm.event(button.props.onClick.handler,{})}
     result.before=value.state
     click(/推进|步进/);result.afterStep=value.state
     click(/充能/);result.afterCharge=value.state
     if(JSON.stringify(result.before)===JSON.stringify(result.afterStep))throw Error('Action had no persisted feedback')
    }
    const saved=value.state,restored=createSandboxVM(Q,{code:surface.module.code,input:p.input||{},state:saved})
    try{result.restored=JSON.stringify(restored.snapshot().state)===JSON.stringify(saved)}finally{restored.dispose()}
   }finally{vm.dispose()}
  }
  result.status='passed'
 }catch(e){result.status='failed';result.error=e.message}
 Object.assign(result,{elapsedMs:Date.now()-start,calls,trace})
 await writeFile(`${out}/${id}.json`,JSON.stringify(result,null,2))
 const {trace:_,card,surface,props,...summary}=result;results.push(summary)
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2))
 console.log(JSON.stringify(summary))
}
