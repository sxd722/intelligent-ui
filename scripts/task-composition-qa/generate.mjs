import {writeFile,readFile} from 'node:fs/promises'
import {loadApiKey} from '../../server/env.mjs'
import {createModelClient} from '../../server/research/model-client.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {COMPOSITION_REFERENCE} from '../../shared/cardspec/task-composition.mjs'
import {TOOLS} from '../../shared/cardspec/tools.mjs'
import {TOOL_BINDING_GUIDE} from '../../server/cardspec/tool-disclosure.mjs'
import {CARD_JS_LANGUAGE_CORE} from '../../server/cardspec/language-core.mjs'
import {registryReference} from '../../shared/cardspec/registry.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {makeScope,createStore,executeAction} from '../../shared/cardspec/store.mjs'
import {canonicalInput} from '../../shared/cardspec/prefetch.mjs'
import {cases,ROOT,DEST} from './cases.mjs'
const key=loadApiKey();if(!key.ok)throw Error('Gateway credential unavailable')
const model='deepseek-v4-flash',round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model}),results=[]
const goals={feed:'把两处来源合并，按来源筛选，点击内容查看概要。不要混算播放量和点赞量。',trip:'地点和天气放在同一任务卡，选择地点后搜索其附近餐厅。切换出游日期显示对应天气。',movie:'选一部电影，按所选电影名搜索B站解读，作为相关资料。返回后保留选择。'}
for(const c of cases){
 const id='model4-'+c.id,seed=JSON.parse(await readFile(DEST+'/runs/'+c.id+'-native.json','utf8')).spec.prefetched
 const messages=[{role:'system',content:'生成一个CardSpec v1文档，只输出<card schemaVersion="1" actionMode="snapshot">。JSON值用{...}，字符串属性加引号。使用binding/state/derive/action和task-board实现任务。'+COMPOSITION_REFERENCE+'\n最小接口：state id/type/initial；binding id/tool/input/load(visible|manual)，初始为空items可省略；derive id/value表达式；task-board view/label/onSelect/onDateChange。action中set target/value与invoke binding/input。选择事件event.id是view键，event.item.title是内容标题；日期event.date。先set再invoke用next读取新状态，普通state是动作入口快照。不要生成原始数据或多余界面。'},{role:'user',content:JSON.stringify({goal:goals[c.id],main:{tool:c.tool,input:c.input},support:{tool:c.secondary.tool,input:c.secondary.input},tools:[c.tool,c.secondary.tool,...(c.id==='trip'?['opencli.wttr.forecast']:[])].map(id=>({id,inputSchema:TOOLS[id].inputSchema})),weather:c.id==='trip'?{input:{location:'Hangzhou',days:3},initialDate:'2026-11-04'}:undefined})}]
 messages[0].content+='\n'+CARD_JS_LANGUAGE_CORE+'\n'+TOOL_BINDING_GUIDE+'\n'+registryReference({names:['task-board']})+'\n'+COMPOSITION_REFERENCE
 const start=Date.now(),r={id,case:c.id,mode:'native',model}
 try{
  const response=await round(messages,{temperature:.3,maxTokens:3000,thinking:{type:'disabled'},signal:AbortSignal.timeout(90000)});r.ms=Date.now()-start;r.usage=response.usage;r.source=response.message.content.trim().replace(/^```[^\n]*\n|\n```$/g,'')
  const compiled=compileCard(r.source,{final:true,cardId:id,context:{expressionDialect:'js-v1'}});r.diagnostics=compiled.diagnostics;r.complete=compiled.complete
  await writeFile(ROOT+'/'+id+'-trace.json',JSON.stringify({messages,response,ms:r.ms},null,2))
  if(compiled.complete){r.spec=compiled.spec;r.spec.prefetched=seed;const store=createStore(),bindings={};makeScope(r.spec,store)
   for(const [bid,b]of Object.entries(r.spec.bindings)){const record=seed.find(s=>s.tool===b.tool);if(record)bindings[bid]={tool:b.tool,value:record.value,valueInputKey:canonicalInput(record.input),status:'success'}}
   const scope=makeScope(r.spec,store,{bindings}),views=Object.keys(r.spec.derived).map(k=>scope.derived[k]).filter(v=>v?.version===1),view=views[0]
   if(!view?.items?.length)throw Error('No composed candidates')
   if(view.items.length!==(c.id==='feed'?4:2))throw Error('Candidate composition dropped a requested source')
   const find=n=>Array.isArray(n)?n.flatMap(find):n&&typeof n==='object'?[...(n.type==='task-board'?[n]:[]),...Object.values(n).flatMap(v=>v&&typeof v==='object'?find(v):[])]:[]
   const board=find(r.spec)[0];if(!board)throw Error('No task-board')
   const action=evaluate(board.props.onSelect,scope),effects=[]
   executeAction(r.spec,store,action,{bindings,event:{id:view.items[0].id,item:view.items[0]},effects})
   const nextScope=makeScope(r.spec,store,{bindings}),selected=Object.keys(r.spec.derived).map(k=>nextScope.derived[k]).find(v=>v?.version===1&&v.focus)
   if(!selected)throw Error('Selection did not update composed focus')
   if(c.id!=='feed'&&!effects.some(e=>e.tool===c.secondary.tool||r.spec.bindings[e.binding]?.tool===c.secondary.tool))throw Error('Selection did not request related data')
   if(c.id!=='feed'&&!effects.some(e=>JSON.stringify(e.input).includes(selected.focus.title)))throw Error('Dependent input is not selected title')
   r.semantic={items:view.items.length,selected:selected.focus.title,effects};r.passed=true
  }
 }catch(e){r.error=e.message;r.passed=false;r.ms=Date.now()-start}
 await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));results.push(r);await writeFile(ROOT+'/model4.json',JSON.stringify(results,null,2));console.log(JSON.stringify({id,complete:r.complete,passed:r.passed,ms:r.ms,error:r.error}))
}
