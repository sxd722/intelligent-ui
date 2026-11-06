import {DISCOVERY_CASES,assessSelection} from '../../server/tools/discovery-cases.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {S2_CASES} from '../binding-experiment/s2-cases.mjs'
import {toolDiscovery} from '../../server/tools/semantic-discovery.mjs'
import {browseTools} from '../../server/tools/discovery-tree.mjs'
import {createGenerationTools} from '../../server/cardspec/generation-tools.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {loadApiKey} from '../../server/env.mjs'
const strictOnly=process.env.DISCOVERY_STRICT_ONLY==='1';const dir='artifacts/tooling-p0p1-20261103/'+(strictOnly?'discovery-strict':'discovery-v2');await mkdir(dir,{recursive:true})
const response=await fetch('http://127.0.0.1:8787/api/tools').then(r=>r.json()),catalog=response.tools||response
const key=loadApiKey();if(!key.ok)throw Error('missing model credential')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'deepseek-v4-flash'})
await toolDiscovery.warm(catalog).catch(()=>{})
const jobs=S2_CASES.flatMap(c=>(strictOnly?['strict']:['flat','hierarchical']).map(arm=>({c,arm}))),results=[]
let saving=Promise.resolve()
try{await Promise.all(Array.from({length:2},async()=>{while(jobs.length){
 const {c,arm}=jobs.shift(),start=Date.now(),g=createGenerationTools({catalog,invoke:async()=>{throw Error('Discovery experiment never executes tools')}})
 const initial=arm==='flat'?await toolDiscovery.discover(catalog,c.prompt):browseTools(catalog)
 const submit={type:'function',function:{name:'submit_selection',description:'提交最终工具选择，不执行工具',parameters:{type:'object',properties:{tools:{type:'array',items:{type:'string'}},reason:{type:'string'}},required:['tools','reason'],additionalProperties:false}}};
 const tools=g.tools().filter(t=>['cli_discover','cli_describe'].includes(t.function.name));if(arm==='strict'){const f=tools.find(t=>t.function.name==='cli_discover').function;delete f.parameters.properties.query;f.parameters.required=['level'];f.description='严格按领域→来源→工具浏览，不提供全局查询'};const messages=[{role:'system',content:'选择完成用户任务需要的已注册工具，不执行。用途明确可以直接query全局检索；也可浏览领域/来源，按需批量describe核实。最多3轮检索，最后只输出JSON {"tools":["工具ID"],"reason":"简短理由"}。不支持的能力不编造；静态任务可以空数组。'}, {role:'user',content:JSON.stringify({request:c.prompt,candidates:initial})}],trace=[],r={id:c.id,arm,prompt:c.prompt,expected:c.sources.map(s=>s.tool),selected:[],calls:[]}
 try{for(let turn=0;turn<4;turn++){
  const response=await round(messages,{tools:turn<3?[...tools,submit]:[submit],...(turn===3?{toolChoice:{type:'function',function:{name:'submit_selection'}}}:{}),maxTokens:1800,temperature:.2,thinking:{type:'disabled'},signal:AbortSignal.timeout(60000)})
  trace.push({messages:structuredClone(messages),response});messages.push(response.message)
  if(!response.message.tool_calls?.length){const text=response.message.content,match=text.match(/\{[\s\S]*\}/),value=JSON.parse(match?.[0]||text);if(!Array.isArray(value.tools))throw Error('missing tools array');r.selected=value.tools;r.reason=value.reason;break}
  let submitted=false;for(const call of response.message.tool_calls){const input=JSON.parse(call.function.arguments);if(call.function.name==='submit_selection'){r.selected=input.tools;r.reason=input.reason;submitted=true;break}let result;try{if(arm==='strict'&&input.query)throw Error('strict hierarchy has no global query');result=await g.execute(call.function.name,input)}catch(e){result={error:e.message}}r.calls.push({name:call.function.name,input});messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)})}if(submitted)break
 }
 const fixture=DISCOVERY_CASES.find(f=>f.id===c.id);if(fixture)r.assessment=assessSelection(fixture,r.selected.map(id=>({id})));
 r.validIds=r.selected.every(id=>catalog.some(t=>t.id===id));r.missing=r.expected.filter(id=>!r.selected.includes(id));r.recall=r.expected.length?(r.expected.length-r.missing.length)/r.expected.length:r.selected.length?0:1
 }catch(e){r.error=e.message}
 r.elapsedMs=Date.now()-start;r.usage=trace.reduce((s,t)=>s+(t.response.usage?.total_tokens||0),0);results.push(r)
 await writeFile(dir+'/'+c.id+'-'+arm+'-trace.json',JSON.stringify(trace,null,2));saving=saving.then(()=>writeFile(dir+'/results.json',JSON.stringify(results,null,2)));await saving;console.log(JSON.stringify({id:c.id,arm,recall:r.recall,ms:r.elapsedMs,error:r.error}))
}}))}finally{toolDiscovery.close()}
