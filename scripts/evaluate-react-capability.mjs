import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import assert from 'node:assert/strict'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {compileCloudSandbox} from '../sites/intelligent-ui/server/cloud-sandbox.mjs'
import {REACT_SURFACE_PROMPT} from '../shared/cardspec/react-surface-prompt.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
import {cases} from './react-capability-cases.mjs'

// Read the deployed prompt verbatim, without modifying or invoking the Site.
const cloudSource=await readFile(new URL('../sites/intelligent-ui/server/cloud-sandbox.mjs',import.meta.url),'utf8')
const promptExpression=cloudSource.match(/const PROMPT=([\s\S]*?)\n\nexport function/)[1]
// This expression is trusted checked-in host code, never model output.
const baseline=Function('REACT_SURFACE_PROMPT','return '+promptExpression)(REACT_SURFACE_PROMPT)
export const compact=`Return only export default function App({data,state,setState}){...} in JSX.
This is a pure React renderer inside QuickJS, NOT a browser page. React is supplied. Read persistent state from state; every update replaces the object, so preserve other fields. data is read-only.
Example: export default function App({state,setState}){return <div style={{width:"100%",minWidth:0}}><svg viewBox="0 0 100 40" height={100} style={{width:"100%"}}><rect width={state.n} height={30} fill="#38bdf8" style={{transition:"width 200ms ease"}}/></svg><button onClick={()=>setState(s=>({...s,n:s.n+1}))}>增加</button></div>}
Use inline CSS, SVG and ordinary buttons/inputs. One visual result, concise labels, controls wrap; fit 280–432px width and supplied height. SVG has viewBox and explicit height. Inputs read event.target.value; coordinates event.x/y. Use finite JSON state, computed values derive from state. No hooks needed for persistent state.
Host already handles reduced-motion CSS, resizing and persistence: DO NOT implement those. No window/document/network/timers/storage/imports/packages, external resources, style/script tags, HTML injection or DOM APIs. CSS transition handles state motion; surface-enter is an optional host animation class. SVG local gradients/clipPath url(#id) allowed. Return a complete component, not an explanation.`
const out=process.env.REACT_EVAL_DIR||'artifacts/react-capability-20261020'
await mkdir(out,{recursive:true})
const model=process.env.REACT_EVAL_MODEL||'glm-5.3-flash'
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model})
const Q=await getQuickJS()
const makeVM=process.argv.includes('--compat')?(await import('../artifacts/react-capability-20261020/experimental-engine.mjs')).createSandboxVM:createSandboxVM
export const flatten=t=>Array.isArray(t)?t.flatMap(flatten):t&&typeof t==='object'?[t,...t.children.flatMap(flatten)]:[]
const text=t=>typeof t==='string'?t:Array.isArray(t)?t.map(text).join(' '):t?.children?.map(text).join(' ')||''
function control(tree,label){
 const nodes=flatten(tree)
 const aliases={'输入值':['输入值','输入 x','x'],'权重':['权重','权重 w','w'],'下一项':['下一项','下一步']}[label]||[label]
 const hasLabel=s=>aliases.some(a=>a.length===1?s.trim()===a:s.includes(a))
 if(label==='@svg')return nodes.find(n=>n.type==='svg')
 const norm=s=>s.replace(/[✓✔☑]/g,'').trim()
 const button=nodes.find(n=>n.type==='button'&&norm(text(n))===label);if(button)return button
 const choice=nodes.find(n=>n.props.onClick&&(norm(text(n))===label||norm(text(n))==='选 '+label||norm(text(n))==='选择 '+label));if(choice)return choice
 const described=nodes.find(n=>n.type==='button'&&text(n).includes(label));if(described)return described
 if(label==='下一项'){const step=nodes.find(n=>n.type==='button'&&text(n).trim()==='下一步');if(step)return step}
 if(['A','B'].includes(label)){const tile=nodes.find(n=>n.props.onClick&&new RegExp('^'+label+'(?:\\s|$)').test(text(n).trim()));if(tile)return tile}
 if(label==='切换残差')return nodes.find(n=>n.type==='button'&&text(n).includes('残差'))||nodes.find(n=>n.type==='input'&&n.props.type==='checkbox')
 if(label==='暂停'){const resume=nodes.find(n=>n.type==='button'&&/^(继续|恢复|取消暂停)$/.test(text(n).trim()));if(resume)return resume}
 const input=nodes.find(n=>['input','select'].includes(n.type)&&(n.props['aria-label']===label||n.props.placeholder===label));if(input)return input
 const l=nodes.find(n=>n.type==='label'&&hasLabel(text(n)))
 if(l)return flatten(l).find(n=>n.type==='input')||nodes.find(n=>n.type==='input'&&n.props.id===l.props.htmlFor)
 // A visible adjacent caption still identifies a usable control; report
 // accessibility separately instead of calling it a broken state transition.
 return [...nodes].reverse().find(n=>hasLabel(text(n))&&flatten(n).filter(x=>x.type==='input').length===1)?.children.flatMap(flatten).find(n=>n.type==='input')
}
export async function validate(module,c){
 let vm,stage='render';const result={compile:true,render:false,interaction:false,restore:false}
 try{
  vm=makeVM(Q,{code:module.code,input:c.data,state:c.initial})
  let s=vm.snapshot();result.render=true;result.initial=s;stage='interaction'
  result.visual=flatten(s.tree).some(n=>n.type==='svg')
  for(const [label,expected,value,visible] of c.actions){
   const n=control(s.tree,label);assert.ok(n,'missing control: '+label);assert.ok(!n.props.disabled,'control disabled: '+label)
   const handler=n.props[label==='@svg'?'onClick':value!==undefined?'onChange':'onClick']||n.props.onInput||(n.props.type==='checkbox'&&n.props.onChange)
   assert.ok(handler,'missing handler: '+label)
   s=vm.event(handler.handler,label==='@svg'?value:value!==undefined?{value}:n.props.type==='checkbox'?{checked:!n.props.checked}:{})
   for(const [key,v]of Object.entries(expected))assert.deepEqual(s.state[key],v,'state.'+key+' after '+label)
   if(visible)assert.ok(text(s.tree).includes(visible),'missing displayed result '+visible)
   if(c.id==='queue'&&s.state.paused)assert.ok(control(s.tree,'下一项')?.props.disabled,'next item must be disabled while paused')
  }
  if(c.id==='energy'){
   for(let i=0;i<6;i++)s=vm.event(control(s.tree,'推进一步').props.onClick.handler,{})
   assert.equal(s.state.energy,0);assert.ok(control(s.tree,'推进一步').props.disabled,'energy boundary must disable advance')
   for(let i=0;i<10;i++){const n=control(s.tree,'充能');if(n.props.disabled)break;s=vm.event(n.props.onClick.handler,{})}
   assert.equal(s.state.energy,100);assert.equal(s.state.steps,6,'charging must preserve steps')
  }
  result.interaction=true;result.final=s;stage='restore';vm.dispose();vm=null
  vm=makeVM(Q,{code:module.code,input:c.data,state:s.state})
  const restored=vm.snapshot()
  assert.deepEqual(restored.state,s.state);assert.equal(text(restored.tree),text(s.tree));result.restore=true
  if(c.id==='filter'){
   try{const refreshed=vm.input({items:[...c.data.items,{id:'d',name:'新公园',cat:'nature'}]});assert.ok(text(refreshed.tree).includes('新公园'));result.dataRefresh=true}
   catch(e){result.dataRefresh=false;result.dataRefreshError=e.message}
  }
 }catch(e){result.error={stage,message:e.message.slice(0,650)}}finally{vm?.dispose()}
 return result
}
const results=[]
const repeat=Number(process.env.REACT_EVAL_REPEATS||1)
if(process.argv.includes('--replay')){
 const old=JSON.parse(await readFile(out+'/results.json','utf8'))
 for(const row of old)for(const a of row.attempts)if(a.module)a.recheck=await validate(a.module,cases.find(c=>c.id===row.case))
 await writeFile(out+(process.argv.includes('--compat')?'/compatibility.json':'/rechecked.json'),JSON.stringify(old,null,2))
 console.log(JSON.stringify(old.map(r=>({id:r.id,first:(r.attempts[0].recheck||r.attempts[0].check).restore,error:(r.attempts[0].recheck||r.attempts[0].check).error}))))
 process.exit(0)
}
if(await readFile(out+'/results.json','utf8').then(()=>true,()=>false))throw Error('Evaluation traces already exist; set REACT_EVAL_DIR to a new directory')
const tasks=Array.from({length:repeat},(_,r)=>cases.flatMap((c,i)=>(i%2?['compact','baseline']:['baseline','compact']).map(arm=>({c,arm,r})))).flat()
await writeFile(out+'/protocol.json',JSON.stringify({model,temperature:.4,maxTokens:5000,repeat,cases,baseline,compact,notes:'Fixed briefs isolate surface generation; no planning/CLI. Same one diagnostic repair allowed in both arms; production cloud repairs syntax only. Semantic tests check named controls, state transitions, visible computed outputs, and reload; not a human visual quality score.'},null,2))
async function run({c,arm,r}){
 const id=`${r+1}-${c.id}-${arm}`,messages=[{role:'system',content:arm==='baseline'?baseline:compact},{role:'user',content:JSON.stringify({brief:c.brief,data:c.data,initial:c.initial,size:{width:360,height:320}})}]
 const record={id,case:c.id,arm,model,attempts:[]}
 for(let attempt=0;attempt<2;attempt++){
  const start=Date.now();let raw='',reasoning='',usage,module,check
  try{
   const reply=await round(messages,{temperature:.4,maxTokens:5000,reasoningEffort:'low',signal:AbortSignal.timeout(120000),onPiece:p=>{raw+=p.content||'';reasoning+=p.reasoning||''},onUsage:u=>usage=u})
   if(reply.message.tool_calls?.length)throw Error('unexpected tool call')
   try{module=await compileCloudSandbox(raw);check=await validate(module,c)}catch(e){check={compile:false,error:{stage:'compile',message:e.message}}}
  }catch(e){check={error:{stage:'gateway',message:e.message}}}
  const item={attempt,ms:Date.now()-start,usage,raw,reasoning,module,check}
  record.attempts.push(item);await writeFile(`${out}/${id}.json`,JSON.stringify(record,null,2))
  if(check.restore||check.error?.stage==='gateway')break
  messages.push({role:'assistant',content:raw},{role:'user',content:`Correct this component once; keep the task behavior, return only complete JSX. Host validation failed at ${check.error.stage}: ${check.error.message}. Browser APIs are unavailable; host handles reduced motion. Preserve all state fields.`})
 }
 results.push(record);await writeFile(out+'/results.json',JSON.stringify(results,null,2))
 console.log(JSON.stringify({id,first:!!record.attempts[0].check.restore,final:!!record.attempts.at(-1).check.restore,errors:record.attempts.map(a=>a.check.error),ms:record.attempts.reduce((n,a)=>n+a.ms,0)}))
}
// Bounded two-call concurrency; no application server or OpenCLI session imports.
let index=0
await Promise.all([0,1].map(async()=>{while(index<tasks.length)await run(tasks[index++])}))
