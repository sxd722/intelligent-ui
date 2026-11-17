// Fixed-input model repair experiment. Never owns or touches OpenCLI/Owl.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createModelClient} from '../server/research/model-client.mjs'
import {loadApiKey} from '../server/env.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createRsiJournal} from '../server/rsi-journal.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {createStore,executeAction} from '../shared/cardspec/store.mjs'
const root='artifacts/shared-action-rsi-qa';await mkdir(root,{recursive:true})
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model:'volcengine/deepseek-v4.1-flash'})
const journal=createRsiJournal({autoAnalyze:false,round})
const simple=(label)=>`<card><title>${label}</title><state id="sel" type="string" initial="a"/><collection id="rows" label="候选" items={[{id:"a",title:"A"},{id:"b",title:"B"}]} selectedId={state.sel} onSelect="pick"/><button id="jump" args={{id:"a"}} onPress="pick">返回A</button><text>{state.sel}</text><action id="pick"><set target="sel" value={event.id}/></action></card>`
const cases=[{id:'lovecraft',source:await readFile('artifacts/generation-debug/a76a2c50-a61a-4a69-b75c-9df7b7585a99/f8f3e1f09ded1912fa2e/candidate.cardspec','utf8')},{id:'shopping',source:simple('选购与返回')},{id:'learning',source:simple('学习章节与复习')}]
const summary=[]
for(const c of cases)for(const arm of ['single-error','joint']){
 const id=`qa-${c.id}-${arm}-${Date.now()}`,res={write(){return true},end(){this.writableEnded=true},setHeader(){}};const start=Date.now();let source=c.source,rounds=0,compile
 await journal.capture({headers:{'x-rsi-record-id':id}},res,{kind:'repair-experiment',experiment:{arm,case:c.id,fixedContent:true}},async()=>{
  await journal.describe({prompt:`修复${c.id}共享动作，保留原内容与交互，不删除组件。`})
  for(let i=0;i<3;i++){
   compile=compileCard(source,{final:true,expressionDialect:'js-v1',context:{expressionDialect:'js-v1'}})
   if(compile.complete)break
   let ds=compile.diagnostics.filter(d=>d.severity==='error');if(arm==='single-error')ds=ds.filter(d=>d.code!=='shared_action_payload').slice(0,1)
   await journal.append(id,'frames',{frame:{type:'debug',round:i,diagnostics:ds}})
   const messages=[{role:'system',content:'修复CardSpec。只返回JSON {"replacements":[{"old":"精确旧文本","new":"替换文本"}]}。保留全部内容和控件；只能改动作及调用。onSelect(event.id)与button(args)载荷不同；不能假设一个控件具有另一控件的载荷。禁止改测试或删除功能。不要新增计划。'},{role:'user',content:JSON.stringify({source,diagnostics:ds})}]
   const result=await journal.model(round,messages,{maxTokens:6000,temperature:0.1,signal:AbortSignal.timeout(100000)});rounds++
   try{const parsed=JSON.parse(result.message.content.replace(/^```(?:json)?\s*|\s*```$/g,''));for(const r of parsed.replacements){if(!r.old||!source.includes(r.old))throw Error('Replacement target missing');source=source.replaceAll(r.old,r.new)}}catch(e){await journal.append(id,'frames',{frame:{type:'patch_error',error:e.message}});break}
  }
  compile=compileCard(source,{final:true,expressionDialect:'js-v1',context:{expressionDialect:'js-v1'}})
  const elapsedMs=Date.now()-start,dir=`${root}/${c.id}-${arm}`;await mkdir(dir,{recursive:true});await writeFile(dir+'/candidate.cardspec',source)
  let browser,actionProbes=[]
  if(compile.complete){
   const spec=compile.spec;spec.context={...spec.context,rsiRecordId:id,expressionDialect:'js-v1',renderMode:'native'}
   // Verify independent caller channels using their actual component contracts.
   const walk=nodes=>(nodes||[]).flatMap(n=>[n,...walk(n.children)])
   for(const n of walk(spec.children).filter(n=>n.props?.onSelect||n.props?.onPress)){
    const action=n.props.onSelect?.value||n.props.onPress?.value;if(!action||!spec.actions[action])continue
    if(!['map','collection','button'].includes(n.type))continue
    const store=createStore(spec),eventId=c.id==='lovecraft'?'innsmouth':'b'
    try{executeAction(spec,store,action,{event:{id:eventId},args:n.type==='button'?{id:c.id==='lovecraft'?'arkham':'a'}:{}});actionProbes.push({type:n.type,action,state:store.values})}catch(e){actionProbes.push({type:n.type,action,error:e.message})}
   }
   if(arm==='joint')browser=await runDebugBrowser(spec,{scenarios:['normal'],size:'full',viewports:[432,320],captureSteps:true,artifactDir:dir,steps:c.id==='lovecraft'?[]:[{op:'click',name:'B',role:'button',expect:{state:{sel:'b'}}},{op:'click',name:'返回A',role:'button',expect:{state:{sel:'a'}}},{op:'reload',expect:{state:{sel:'a'}}}],signal:AbortSignal.timeout(90000)})
   await journal.append(id,'results',{results:[{spec,source}]})
  }
  const result={id,case:c.id,arm,rounds,elapsedMs,complete:compile.complete,diagnostics:compile.diagnostics,actionProbes,browser}
  summary.push(result);await writeFile(dir+'/result.json',JSON.stringify(result,null,2));await journal.append(id,'frames',{frame:{type:'debug',...result}});res.end();console.log(JSON.stringify({case:c.id,arm,rounds,elapsedMs,complete:compile.complete,browser:browser?.status,id}))
 })
 await writeFile(root+'/results.json',JSON.stringify(summary,null,2))
}
