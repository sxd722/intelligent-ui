import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import {generateSandbox,compileSandbox} from '../server/cardspec/sandbox.mjs'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
const out=process.env.SANDBOX_LIVE_OUT||'artifacts/sandbox-linked-qa/live';await mkdir(out,{recursive:true})
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model:'glm-5.3-flash'})
const flatten=t=>Array.isArray(t)?t.flatMap(flatten):t&&typeof t==='object'?[t,...t.children.flatMap(flatten)]:[]
const cases=[
 {id:'energy',brief:'做一个SVG储能流动图，CSS keyframes自主展示能量流动。外部已有强度滑杆和刷新按钮，不重复它们。data.level是唯一强度，图中点击电池调用adjust并传value:75，点击数据源图形调用refresh。显示当前level/count/status。透明底，继承卡片材质。'},
 {id:'network',brief:'画可探索的神经网络传播示意，CSS自主动画表示信号沿边流动。外部已有强度滑杆、重置、查询按钮。data.level控制激活强度，点击输出节点调用adjust并传value:75，点击输入数据节点调用refresh，使用返回的data.count/status更新文字。不要模拟真实神经网络统计。透明底，内容适应340x220。'}
]
for(const c of cases){
 const start=Date.now(),trace=[],diagnostics=[],record={id:c.id,model:'glm-5.3-flash'};let vm
 const data={level:30,count:0,status:'idle'},capabilities=['adjust','refresh']
 try{
  const result=process.argv.includes('--replay')?await (async()=>{
   const old=JSON.parse(await readFile(`${out}/${c.id}.json`,'utf8'));let error
   for(let i=0;i<old.trace.length;i++)try{return {module:await compileSandbox(old.trace[i].raw,{input:data,capabilities}),repairCount:i}}catch(e){error=e}
   throw error
  })():await generateSandbox({input:{prompt:c.brief,context:{data,initial:{},actions:capabilities}},view:{renderMode:'hybrid',width:340,height:220},signal:AbortSignal.timeout(120000),emit:e=>diagnostics.push(e),streamUpstream:async(messages,options)=>{
   const attempt={messages:structuredClone(messages),raw:'',usage:null};trace.push(attempt)
   return round(messages,{...options,onPiece:p=>{attempt.raw+=p.content||'';options.onPiece(p)},onUsage:u=>{attempt.usage=u}})
  }})
  record.module=result.module;record.repairCount=result.repairCount
  vm=createSandboxVM(await getQuickJS(),{code:result.module.code,input:data,capabilities})
  const initial=vm.snapshot(),effects=[]
  for(let i=0;i<flatten(initial.tree).length;i++){
   const node=flatten(vm.snapshot().tree)[i],handler=node?.props.onClick||node?.props.onPointerUp
   if(handler)try{effects.push(...vm.event(handler.handler,{type:node.props.onClick?'click':'pointerup',x:170,y:100}).effects)}catch(e){record.eventError=e.message}
  }
  const refreshed=vm.input({level:75,count:7,status:'success'})
  record.checks={initialNoEffects:initial.effects.length===0,autonomousCSS:result.module.animated,adjust:effects.some(e=>e.name==='adjust'&&e.payload.value===75),refresh:effects.some(e=>e.name==='refresh'),reactiveInput:JSON.stringify(initial.tree)!==JSON.stringify(refreshed.tree),inputNoEffects:refreshed.effects.length===0}
  record.initial=initial;record.refreshed=refreshed
  record.passed=Object.values(record.checks).every(Boolean)&&!record.eventError
 }catch(e){record.error=e.message;record.passed=false}finally{vm?.dispose()}
 record.elapsedMs=Date.now()-start;record.trace=trace;record.diagnostics=diagnostics
 await writeFile(`${out}/${c.id}${process.argv.includes('--replay')?'-replay':''}.json`,JSON.stringify(record,null,2))
 console.log(JSON.stringify({id:record.id,passed:record.passed,checks:record.checks,error:record.error,eventError:record.eventError,repairCount:record.repairCount,elapsedMs:record.elapsedMs}))
}
